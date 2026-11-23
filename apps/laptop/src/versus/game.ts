// 대결 1판의 규칙 연결: 포즈·IMU 입력 → 찌르기 판정 → 상대 AI → 경기 진행 → 화면 상태.
// 화면(DOM·Three.js)과 분리되어 있어 합성 기록으로 단위 테스트한다.
import {
  createBout,
  createOpponent,
  createPisteTracker,
  createThrustDetector,
  createWebcamThrustDetector,
  DEFAULT_FUSION,
  DEFAULT_LEG_LENGTH_M,
  DEFAULT_THRUST_PARAMS,
  fuseThrust,
  measureLunge,
  reachMeters,
  type BoutEvent,
  type BoutState,
  type Calibration,
  type Difficulty,
  type FusionResult,
  type ImuRecord,
  type LungeFrame,
  type OpponentState,
  type ThrustParams,
} from '@fc/core';
import type { ArenaView } from '../arena/scene';

export type InputMode = 'phone' | 'webcam';

export interface VersusOptions {
  /** phone: 폰 IMU + 웹캠 칼 팔 확인, webcam: 웹캠만 */
  readonly mode: InputMode;
  readonly difficulty: Difficulty;
  readonly seed: number;
  /** 움직이지도 공격하지도 막지도 않는 연습용 상대 */
  readonly dummy?: boolean;
  /** 허수아비와의 거리 (기본 1.3m, 찌르면 닿는 거리) */
  readonly dummyGapM?: number;
  /** 시작 거리 (기본 4m, 경기 규정 준비선) */
  readonly startGapM?: number;
  readonly legLengthM?: number;
  readonly thrustParams?: ThrustParams;
}

export interface VersusFrameResult {
  readonly view: ArenaView;
  readonly events: BoutEvent[];
  /** 이번 프레임에 판정한 폰 찌르기 결과 (팔 덜 폄 피드백용) */
  readonly fusion: FusionResult | null;
  readonly distanceM: number;
}

export interface VersusGame {
  onPose(frame: LungeFrame): VersusFrameResult;
  onImu(sample: ImuRecord): void;
  state(): BoutState;
  readonly reachM: number;
}

const ARM_HISTORY_MS = 1000;
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function createVersusGame(cal: Calibration, opts: VersusOptions): VersusGame {
  const legLengthM = opts.legLengthM ?? DEFAULT_LEG_LENGTH_M;
  const reachM = reachMeters(cal, legLengthM);
  const gap = opts.dummy ? (opts.dummyGapM ?? 1.3) : (opts.startGapM ?? 4);
  const userStart = -gap / 2;
  const newTracker = () => createPisteTracker(cal, { startM: userStart, legLengthM });

  let track = newTracker();
  const opponent = createOpponent({
    difficulty: opts.difficulty,
    seed: opts.seed,
    startXM: gap / 2,
    ...(opts.dummy ? { speedMps: 0, attackRatePerS: 0, parryChance: 0 } : {}),
  });
  const bout = createBout();
  const webcam = createWebcamThrustDetector(cal);
  const imu = createThrustDetector(opts.thrustParams ?? DEFAULT_THRUST_PARAMS);
  const imuThrusts: number[] = [];
  const armHistory: { tMs: number; swordArmDeg: number }[] = [];
  let started = false;
  let userX = userStart;
  let opp: OpponentState = { xM: gap / 2, phase: 'keep', parrying: false, lunge: 0, reachM: 1.5 };

  /** 이번 프레임에서 인정된 사용자 찌르기 시각들 */
  const userThrusts = (frame: LungeFrame): { times: number[]; fusion: FusionResult | null } => {
    if (opts.mode === 'webcam') {
      const e = webcam(frame);
      return { times: e ? [e.tMs] : [], fusion: null };
    }
    // 폰 찌르기는 칼 팔 각도를 전후 windowMs 동안 본 뒤에 판정한다
    const times: number[] = [];
    let fusion: FusionResult | null = null;
    while (imuThrusts.length > 0 && frame.tMs >= (imuThrusts[0] as number) + DEFAULT_FUSION.windowMs) {
      const t = imuThrusts.shift() as number;
      fusion = fuseThrust(t, armHistory);
      if (fusion.accepted) times.push(t);
    }
    return { times, fusion };
  };

  return {
    reachM,

    onImu(sample) {
      imuThrusts.push(...imu.push(sample).map((d) => d.tMs));
    },

    onPose(frame) {
      if (!started) {
        opponent.reset(frame.tMs);
        started = true;
      }
      userX = track(frame.landmarks);
      const f = measureLunge(frame.landmarks, cal);
      armHistory.push({ tMs: frame.tMs, swordArmDeg: f.swordArmDeg });
      while (armHistory.length > 0 && frame.tMs - (armHistory[0] as { tMs: number }).tMs > ARM_HISTORY_MS) {
        armHistory.shift();
      }

      const { times, fusion } = userThrusts(frame);
      if (bout.state().phase === 'fencing') {
        const step = opponent.step({ nowMs: frame.tMs, userXM: userX, userReachM: reachM });
        opp = step.state;
        for (const tMs of times) {
          bout.thrust('user', { tMs, distanceM: opp.xM - userX, reachM, blocked: opp.parrying });
        }
        if (step.attack) {
          bout.thrust('opponent', {
            tMs: step.attack.tMs,
            distanceM: step.attack.distanceM,
            reachM: opp.reachM,
            blocked: false,
          });
        }
      }

      const events = bout.tick(frame.tMs);
      if (events.some((e) => e.type === 'resume')) {
        // 득점 뒤: 사용자의 지금 위치를 다시 준비선으로 보고, 상대도 준비 위치로
        track = newTracker();
        userX = track(frame.landmarks);
        opponent.reset(frame.tMs);
        opp = { ...opp, xM: gap / 2, phase: 'keep', lunge: 0, parrying: false };
      }

      const attacking = opp.phase === 'lunge' || opp.phase === 'recover';
      return {
        events,
        fusion,
        distanceM: opp.xM - userX,
        view: {
          user: {
            x: userX,
            lunge: clamp01((f.stanceRatio - 1) / 0.8),
            arm: clamp01((f.swordArmDeg - 90) / 80),
            parry: false,
          },
          opponent: { x: opp.xM, lunge: opp.lunge, arm: attacking ? opp.lunge : 0.3, parry: opp.parrying },
        },
      };
    },

    state: () => bout.state(),
  };
}
