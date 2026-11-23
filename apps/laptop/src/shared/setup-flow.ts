import { calibrate, checkFraming, DEFAULT_CALIBRATION, type Calibration, type Handedness, type Landmark } from '@fc/core';

export type SetupStage = 'setup' | 'calibrate' | 'ready';

export interface SetupFlowOptions {
  /** 위치가 연속으로 좋아야 보정으로 넘어가는 프레임 수 (15fps 기준 1초) */
  readonly framingOkFrames: number;
  /** 보정에 쓰는 준비 자세 프레임 수 */
  readonly calibrationFrames: number;
}

export const DEFAULT_SETUP_FLOW: SetupFlowOptions = {
  framingOkFrames: 15,
  calibrationFrames: DEFAULT_CALIBRATION.minFrames,
};

export interface SetupUpdate {
  readonly stage: SetupStage;
  /** 위치 안내 문구 (setup 단계) */
  readonly hints: readonly string[];
  /** 보정에 모은 프레임 수 */
  readonly progress: number;
  readonly calibrationError: string | null;
  readonly calibration: Calibration | null;
}

/**
 * 연습·대결 공통 준비 단계: 위치 안내 → 보정(준비 자세 유지) → 준비 완료.
 * 화면과 분리된 상태기계라 프레임만 넣으면 되고, 화면은 돌려받은 SetupUpdate로 그린다.
 */
export class SetupFlow {
  private readonly hand: Handedness;
  private readonly aspect: () => number;
  private readonly opts: SetupFlowOptions;
  private stage: SetupStage = 'setup';
  private okFrames = 0;
  private frames: Landmark[][] = [];
  private calibration: Calibration | null = null;

  constructor(hand: Handedness, aspect: () => number, opts: SetupFlowOptions = DEFAULT_SETUP_FLOW) {
    this.hand = hand;
    this.aspect = aspect;
    this.opts = opts;
  }

  handle(landmarks: readonly Landmark[] | null): SetupUpdate {
    if (this.stage === 'setup') return this.handleSetup(landmarks);
    if (this.stage === 'calibrate') return this.handleCalibrate(landmarks);
    return this.update([], null);
  }

  private handleSetup(landmarks: readonly Landmark[] | null): SetupUpdate {
    const framing = landmarks
      ? checkFraming(landmarks)
      : { ok: false as const, hints: ['사람이 보이지 않습니다 — 카메라 앞에 서세요'] };
    this.okFrames = framing.ok ? this.okFrames + 1 : 0;
    if (this.okFrames >= this.opts.framingOkFrames) {
      this.stage = 'calibrate';
      this.frames = [];
    }
    return this.update(framing.ok ? [] : framing.hints, null);
  }

  private handleCalibrate(landmarks: readonly Landmark[] | null): SetupUpdate {
    if (landmarks) this.frames.push([...landmarks]);
    if (this.frames.length < this.opts.calibrationFrames) return this.update([], null);

    const result = calibrate(this.frames, this.hand, this.aspect());
    this.frames = [];
    if (!result.ok) return this.update([], result.errors.join(' '));
    this.calibration = result.calibration;
    this.stage = 'ready';
    return this.update([], null);
  }

  private update(hints: readonly string[], calibrationError: string | null): SetupUpdate {
    return {
      stage: this.stage,
      hints,
      progress: this.frames.length,
      calibrationError,
      calibration: this.calibration,
    };
  }
}
