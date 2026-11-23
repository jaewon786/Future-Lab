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

/** 프레임마다 IMU 샘플을 넣는 실시간 찌르기 감지기 */
export interface ThrustDetector {
  /** 샘플을 넣고, 확정된 찌르기를 돌려준다 (대부분 빈 배열) */
  push(sample: ImuRecord): ThrustDetection[];
  /** 남은 후보를 지금까지의 샘플로 확정한다 (기록 끝에서 호출) */
  flush(): ThrustDetection[];
}

interface Candidate {
  readonly tMs: number;
  readonly value: number;
}

/**
 * 실시간 찌르기 감지: y축 가속도 극대점 → 피크 전후 rotationWindowMs 회전 검사 → 디바운스.
 * 회전 검사에 피크 뒤 샘플이 필요하므로 찌르기는 피크보다 rotationWindowMs 늦게 확정되지만,
 * 돌려주는 tMs는 피크 시각이다. 디바운스 안에서는 먼저 온 찌르기가 남는다 (경기에서 바로 알리기 위해).
 */
export function createThrustDetector(params: ThrustParams): ThrustDetector {
  const buffer: ImuRecord[] = [];
  const pending: Candidate[] = [];
  let prev: number | null = null;
  let candidate: Candidate | null = null;
  let lastEmitMs = Number.NEGATIVE_INFINITY;
  const keepMs = 2 * params.rotationWindowMs + 200;

  const confirm = (p: Candidate): ThrustDetection | null => {
    const swing = buffer.some(
      (s) => Math.abs(s.tMs - p.tMs) <= params.rotationWindowMs && rotationMagnitude(s) > params.maxRotationDegPerSec,
    );
    if (swing || p.tMs - lastEmitMs < params.debounceMs) return null;
    lastEmitMs = p.tMs;
    return { tMs: p.tMs, peakAccel: p.value };
  };

  const release = (nowMs: number | null): ThrustDetection[] => {
    const out: ThrustDetection[] = [];
    while (pending.length > 0 && (nowMs === null || nowMs - (pending[0] as Candidate).tMs > params.rotationWindowMs)) {
      const d = confirm(pending.shift() as Candidate);
      if (d) out.push(d);
    }
    return out;
  };

  return {
    push(sample) {
      buffer.push(sample);
      while (buffer.length > 0 && sample.tMs - (buffer[0] as ImuRecord).tMs > keepMs) buffer.shift();

      const v = sample.accel.y * params.direction;
      if (!Number.isFinite(v)) {
        prev = null;
        candidate = null;
      } else {
        // 오르면 후보, 같으면(평평한 꼭대기) 유지, 내려가면 후보를 피크로 확정
        if (prev !== null && v > prev) candidate = { tMs: sample.tMs, value: v };
        else if (prev !== null && v < prev && candidate) {
          if (candidate.value >= params.accelThreshold) pending.push(candidate);
          candidate = null;
        }
        prev = v;
      }
      return release(sample.tMs);
    },
    flush() {
      return release(null);
    },
  };
}

/** 기록 전체(시간순)에서 찌르기를 찾는다. 실시간 감지기와 같은 결과를 낸다. */
export function detectThrusts(samples: readonly ImuRecord[], params: ThrustParams): ThrustDetection[] {
  const detector = createThrustDetector(params);
  return [...samples.flatMap((s) => detector.push(s)), ...detector.flush()];
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
