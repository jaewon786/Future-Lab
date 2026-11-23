import type { Calibration } from './calibration';
import { DEFAULT_LUNGE_RULES, judgeLunge, measureLunge, type LungeFeatures, type LungeJudgment, type LungeRules } from './lunge';
import type { Landmark } from './session';

export interface LungeDetectorOptions {
  /** 보폭비가 이 값 이상이면 런지 시작 */
  readonly enterRatio: number;
  /** 보폭비가 이 값 미만이면 준비 자세로 복귀 (enterRatio와의 차이가 떨림을 막는다) */
  readonly exitRatio: number;
  /** 보폭비가 정점의 이 비율 밑으로 내려가면 정점을 지난 것으로 보고 판정 */
  readonly peakDropRatio: number;
  /** 연속 판정 사이 최소 간격 */
  readonly minIntervalMs: number;
  readonly rules: LungeRules;
  readonly minVisibility: number;
}

export const DEFAULT_LUNGE_DETECTOR: LungeDetectorOptions = {
  enterRatio: 1.8,
  exitRatio: 1.4,
  peakDropRatio: 0.95,
  minIntervalMs: 600,
  rules: DEFAULT_LUNGE_RULES,
  minVisibility: 0.5,
};

export interface LungeFrame {
  readonly tMs: number;
  readonly landmarks: readonly Landmark[];
}

/** 런지 1회의 판정 결과. 시각과 측정값은 정점(보폭 최대) 프레임 기준이다. */
export interface LungeEvent {
  readonly tMs: number;
  readonly features: LungeFeatures;
  readonly judgment: LungeJudgment;
}

/**
 * 프레임을 하나씩 넣으면 런지가 정점을 지난 순간 LungeEvent를 한 번 돌려주고, 그 외에는 null.
 * 상태: 준비 → (보폭비 ≥ enterRatio) 내딛는 중 → (정점에서 5% 줄어듦) 판정 → (보폭비 < exitRatio) 준비.
 * 발목이 안 보이는 프레임은 건너뛴다.
 */
export function createLungeDetector(
  cal: Calibration,
  opts: LungeDetectorOptions = DEFAULT_LUNGE_DETECTOR,
): (frame: LungeFrame) => LungeEvent | null {
  let state: 'ready' | 'rising' | 'judged' = 'ready';
  let peak: { ratio: number; frame: LungeFrame } | null = null;
  let lastEventMs = Number.NEGATIVE_INFINITY;

  const emit = (): LungeEvent | null => {
    const p = peak;
    peak = null;
    if (!p || p.frame.tMs - lastEventMs < opts.minIntervalMs) return null;
    lastEventMs = p.frame.tMs;
    const features = measureLunge(p.frame.landmarks, cal, opts.minVisibility);
    return { tMs: p.frame.tMs, features, judgment: judgeLunge(features, opts.rules) };
  };

  return (frame) => {
    const ratio = measureLunge(frame.landmarks, cal, opts.minVisibility).stanceRatio;
    if (Number.isNaN(ratio)) return null;

    switch (state) {
      case 'ready':
        if (ratio >= opts.enterRatio) {
          state = 'rising';
          peak = { ratio, frame };
        }
        return null;
      case 'rising':
        if (peak && ratio > peak.ratio) {
          peak = { ratio, frame };
          return null;
        }
        if (ratio < opts.exitRatio) {
          state = 'ready';
          return emit();
        }
        if (peak && ratio < peak.ratio * opts.peakDropRatio) {
          state = 'judged';
          return emit();
        }
        return null;
      case 'judged':
        if (ratio < opts.exitRatio) state = 'ready';
        return null;
    }
  };
}
