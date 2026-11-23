export type Difficulty = 'easy' | 'normal' | 'hard';

interface DifficultyPreset {
  readonly reactionMs: number;
  readonly parryChance: number;
  /** 거리 안에서 초당 공격을 시작할 확률 */
  readonly attackRatePerS: number;
}

/** 계획서 7-1: 난이도는 반응 지연과 막기 확률(+공격 빈도)만 바꾼다 */
export const DIFFICULTY: Readonly<Record<Difficulty, DifficultyPreset>> = {
  easy: { reactionMs: 400, parryChance: 0.2, attackRatePerS: 0.3 },
  normal: { reactionMs: 300, parryChance: 0.35, attackRatePerS: 0.5 },
  hard: { reactionMs: 200, parryChance: 0.5, attackRatePerS: 0.7 },
};

export interface OpponentOptions {
  readonly difficulty: Difficulty;
  /** 같은 시드면 같은 행동 (테스트·재현용) */
  readonly seed: number;
  /** 피스트 위 시작 위치 (m). 사용자는 이보다 작은 쪽에 있다 */
  readonly startXM?: number;
  readonly reactionMs?: number;
  readonly parryChance?: number;
  readonly attackRatePerS?: number;
  readonly speedMps?: number;
  /** 유지하려는 거리 */
  readonly preferredDistanceM?: number;
  /** 상대 도달 거리 (팔+칼) */
  readonly reachM?: number;
  readonly lungeMs?: number;
  readonly parryMs?: number;
  readonly recoverMs?: number;
  /** 사용자 도달 거리 + 이 값 안이면 위협으로 봄 (런지 전진 여유) */
  readonly threatMarginM?: number;
}

export interface OpponentInput {
  readonly nowMs: number;
  readonly userXM: number;
  readonly userReachM: number;
}

export type OpponentPhase = 'keep' | 'approach' | 'lunge' | 'recover';

export interface OpponentState {
  readonly xM: number;
  readonly phase: OpponentPhase;
  readonly parrying: boolean;
  /** 런지 진행 0~1 (아바타 애니메이션용) */
  readonly lunge: number;
  readonly reachM: number;
}

export interface OpponentStep {
  readonly nowMs: number;
  readonly state: OpponentState;
  /** 이번 단계에 런지가 끝나 찌른 경우 */
  readonly attack?: { readonly tMs: number; readonly distanceM: number };
}

export interface Opponent {
  step(input: OpponentInput): OpponentStep;
  /** 득점 후 준비 위치로 */
  reset(nowMs: number): void;
}

const MAX_STEP_MS = 100;

/** 시드 고정 난수 (mulberry32) */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 규칙 기반 상대 (계획서 7-1). 거리 유지 → (확률) 접근 → 런지 → 회복, 위협을 느끼면 반응 지연 뒤 확률적으로 막기.
 * 상대는 피스트 + 쪽에서 − 쪽(사용자)을 본다.
 */
export function createOpponent(opts: OpponentOptions): Opponent {
  const preset = DIFFICULTY[opts.difficulty];
  const cfg = {
    startXM: opts.startXM ?? 3,
    reactionMs: opts.reactionMs ?? preset.reactionMs,
    parryChance: opts.parryChance ?? preset.parryChance,
    attackRatePerS: opts.attackRatePerS ?? preset.attackRatePerS,
    speedMps: opts.speedMps ?? 1,
    preferred: opts.preferredDistanceM ?? 2.5,
    reachM: opts.reachM ?? 1.5,
    lungeMs: opts.lungeMs ?? 300,
    parryMs: opts.parryMs ?? 600,
    recoverMs: opts.recoverMs ?? 500,
    threatMarginM: opts.threatMarginM ?? 1,
  };
  const rand = seededRandom(opts.seed);

  let xM = cfg.startXM;
  let phase: OpponentPhase = 'keep';
  let phaseStart = 0;
  let parrying = false;
  let parryUntil = 0;
  let threatSince: number | null = null;
  let parryDecided = false;
  let lastNow: number | null = null;

  const state = (nowMs: number): OpponentState => ({
    xM,
    phase,
    parrying,
    reachM: cfg.reachM,
    lunge:
      phase === 'lunge'
        ? Math.min(1, (nowMs - phaseStart) / cfg.lungeMs)
        : phase === 'recover'
          ? Math.max(0, 1 - (nowMs - phaseStart) / cfg.recoverMs)
          : 0,
  });

  return {
    reset(nowMs) {
      xM = cfg.startXM;
      phase = 'keep';
      phaseStart = nowMs;
      parrying = false;
      threatSince = null;
      parryDecided = false;
      lastNow = nowMs;
    },

    step({ nowMs, userXM, userReachM }) {
      // 포즈가 끊겼다 돌아오면 시간이 크게 뛴다 — 순간이동·연속 공격을 막으려고 한 번에 MAX_STEP_MS까지만 진행
      const dtMs = lastNow === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, nowMs - lastNow));
      lastNow = nowMs;
      const distance = () => xM - userXM;

      // 막기: 사용자가 위협 거리에 들어오고 반응 지연이 지나면 한 번 결정
      if (distance() <= userReachM + cfg.threatMarginM) {
        threatSince ??= nowMs;
      } else {
        threatSince = null;
        parryDecided = false;
      }
      if (parrying && nowMs >= parryUntil) parrying = false;
      if (!parrying && !parryDecided && threatSince !== null && nowMs - threatSince >= cfg.reactionMs) {
        parryDecided = true;
        if (rand() < cfg.parryChance) {
          parrying = true;
          parryUntil = nowMs + cfg.parryMs;
        }
      }

      let attack: OpponentStep['attack'];
      const move = (dir: 1 | -1) => {
        xM += dir * cfg.speedMps * (dtMs / 1000);
      };

      if (phase === 'lunge') {
        if (nowMs - phaseStart >= cfg.lungeMs) {
          attack = { tMs: nowMs, distanceM: distance() };
          phase = 'recover';
          phaseStart = nowMs;
        }
      } else if (phase === 'recover') {
        if (nowMs - phaseStart >= cfg.recoverMs) {
          phase = 'keep';
          phaseStart = nowMs;
        }
      } else if (!parrying) {
        if (phase === 'approach') {
          if (distance() <= cfg.reachM) {
            phase = 'lunge';
            phaseStart = nowMs;
          } else move(-1);
        } else {
          const attackChance = 1 - Math.exp((-cfg.attackRatePerS * dtMs) / 1000);
          if (distance() <= cfg.preferred + 0.3 && rand() < attackChance) {
            phase = distance() <= cfg.reachM ? 'lunge' : 'approach';
            phaseStart = nowMs;
          } else if (distance() > cfg.preferred + 0.3) move(-1);
          else if (distance() < cfg.preferred - 0.5) move(1);
        }
      }

      return attack ? { nowMs, state: state(nowMs), attack } : { nowMs, state: state(nowMs) };
    },
  };
}
