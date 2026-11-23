import { findPeaks, thinByInterval } from './peaks';
import type { ImuRecord, LabelEvent } from './session';

export interface ThrustParams {
  /** 찌르기 방향 가속도 임계값 (m/s², 중력 제외). 보정값으로 바꾼다: thresholdFromCalibration */
  readonly accelThreshold: number;
  /** 피크 주변 회전 속도가 이보다 크면 휘두르기로 보고 거부 (°/s) */
  readonly maxRotationDegPerSec: number;
  /** 회전 검사 범위: 피크 전후 ms */
  readonly rotationWindowMs: number;
  /** 이 시간 안의 다음 찌르기는 받지 않음 (ms) */
  readonly debounceMs: number;
  /** 폰 y축의 어느 방향이 앞인지 (+1: 화면 위쪽 끝이 앞) */
  readonly direction: 1 | -1;
}

/** 계획서 7-1 초기값. accelThreshold는 보정 전 임시값이다. */
export const DEFAULT_THRUST_PARAMS: ThrustParams = {
  accelThreshold: 15,
  maxRotationDegPerSec: 300,
  rotationWindowMs: 300,
  debounceMs: 500,
  direction: 1,
};

export interface ThrustDetection {
  readonly tMs: number;
  /** 찌르기 방향 가속도 피크 (m/s², 방향 보정 후 양수) */
  readonly peakAccel: number;
}

function rotationMagnitude(s: ImuRecord): number {
  const { alpha, beta, gamma } = s.rotation;
  return Math.hypot(alpha, beta, gamma);
}

/**
 * 폰 IMU 샘플(시간순)에서 찌르기를 찾는다.
 * y축 가속도 피크 → 피크 전후 회전 속도 검사 → 디바운스 순서로 거른다.
 */
export function detectThrusts(samples: readonly ImuRecord[], params: ThrustParams): ThrustDetection[] {
  const times = samples.map((s) => s.tMs);
  const forward = samples.map((s) => s.accel.y * params.direction);
  const peaks = findPeaks(times, forward, { threshold: params.accelThreshold, minIntervalMs: 0 });

  const notSwing = peaks.filter((p) => {
    for (let i = p.index; i >= 0 && p.tMs - (times[i] as number) <= params.rotationWindowMs; i--) {
      if (rotationMagnitude(samples[i] as ImuRecord) > params.maxRotationDegPerSec) return false;
    }
    for (let i = p.index + 1; i < samples.length && (times[i] as number) - p.tMs <= params.rotationWindowMs; i++) {
      if (rotationMagnitude(samples[i] as ImuRecord) > params.maxRotationDegPerSec) return false;
    }
    return true;
  });

  return thinByInterval(notSwing, params.debounceMs).map((p) => ({ tMs: p.tMs, peakAccel: p.value }));
}

/** 보정 때 잰 찌르기 최대 가속도들의 중앙값 × ratio. 보정 값이 없으면 기본 임계값. */
export function thresholdFromCalibration(calibrationPeaks: readonly number[], ratio = 0.6): number {
  if (calibrationPeaks.length === 0) return DEFAULT_THRUST_PARAMS.accelThreshold;
  const sorted = [...calibrationPeaks].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  return median * ratio;
}

export interface ThrustEvaluation {
  readonly thrustLabels: number;
  readonly otherLabels: number;
  readonly truePositives: number;
  /** 어느 찌르기 라벨에도 짝지어지지 않은 감지 수 */
  readonly falsePositives: number;
  /** truePositives / thrustLabels (라벨 없으면 NaN) */
  readonly recall: number;
  /**
   * falsePositives / otherLabels — 일반 동작 1회당 오탐 수. 라벨 사이의 빈 시간에 생긴 오탐도
   * 포함하므로 100%를 넘을 수 있다. 일반 동작 라벨이 없으면 NaN.
   */
  readonly falsePositiveRate: number;
}

/**
 * 감지 결과를 사람이 붙인 라벨과 비교한다. 감지마다 toleranceMs 안의
 * 가장 가까운 미사용 찌르기 라벨과 짝짓고, 짝이 없으면 오탐으로 센다.
 */
export function evaluateThrusts(
  detections: readonly { readonly tMs: number }[],
  labels: readonly LabelEvent[],
  toleranceMs: number,
): ThrustEvaluation {
  const thrusts = labels.filter((l) => l.kind === 'thrust').map((l) => l.tMs);
  const otherLabels = labels.filter((l) => l.kind === 'other').length;
  const used = new Set<number>();
  let truePositives = 0;

  for (const d of detections) {
    let best = -1;
    let bestDist = Infinity;
    thrusts.forEach((t, i) => {
      const dist = Math.abs(t - d.tMs);
      if (!used.has(i) && dist <= toleranceMs && dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    if (best >= 0) {
      used.add(best);
      truePositives++;
    }
  }

  const falsePositives = detections.length - truePositives;
  return {
    thrustLabels: thrusts.length,
    otherLabels,
    truePositives,
    falsePositives,
    recall: truePositives / thrusts.length,
    falsePositiveRate: falsePositives / otherLabels,
  };
}
