import { findPeaks } from './peaks';
import type { ImuRecord, PoseFrame } from './session';

/** MediaPipe Pose 관절 번호 */
export const LEFT_WRIST = 15;
export const RIGHT_WRIST = 16;

export interface PoseClapOptions {
  /** 두 손목 거리(화면 높이 단위)가 이 값 이하인 극소점만 박수로 봄 */
  readonly maxWristGap: number;
  /** 손목 신뢰도가 이보다 낮은 프레임은 건너뜀 */
  readonly minVisibility: number;
  readonly minIntervalMs: number;
  /** 카메라 화면 너비 ÷ 높이. 관절 x는 너비, y는 높이 기준이라 거리 계산 전에 맞춘다 */
  readonly aspectRatio: number;
}

/** 기록기는 640×480(4:3)으로 촬영한다 */
export const DEFAULT_POSE_CLAP: PoseClapOptions = {
  maxWristGap: 0.05,
  minVisibility: 0.5,
  minIntervalMs: 1000,
  aspectRatio: 4 / 3,
};

/** 웹캠 포즈에서 두 손목이 가장 가까워지는 순간(박수)의 시각 목록 */
export function detectClapsPose(frames: readonly PoseFrame[], opts: PoseClapOptions = DEFAULT_POSE_CLAP): number[] {
  const times: number[] = [];
  const gaps: number[] = [];
  for (const f of frames) {
    const l = f.landmarks[LEFT_WRIST];
    const r = f.landmarks[RIGHT_WRIST];
    if (!l || !r || l.visibility < opts.minVisibility || r.visibility < opts.minVisibility) continue;
    times.push(f.tMs);
    gaps.push(Math.hypot((l.x - r.x) * opts.aspectRatio, l.y - r.y));
  }
  return findPeaks(times, gaps, { threshold: opts.maxWristGap, minIntervalMs: opts.minIntervalMs, mode: 'min' }).map(
    (p) => p.tMs,
  );
}

export interface ImuClapOptions {
  /** 가속도 크기(m/s²)가 이 값 이상인 스파이크만 박수로 봄 */
  readonly minAccel: number;
  readonly minIntervalMs: number;
}

export const DEFAULT_IMU_CLAP: ImuClapOptions = { minAccel: 30, minIntervalMs: 1000 };

/** 폰 IMU에서 박수 충격(가속도 크기 스파이크)의 시각 목록 */
export function detectClapsImu(samples: readonly ImuRecord[], opts: ImuClapOptions = DEFAULT_IMU_CLAP): number[] {
  const times = samples.map((s) => s.tMs);
  const mags = samples.map((s) => Math.hypot(s.accel.x, s.accel.y, s.accel.z));
  return findPeaks(times, mags, { threshold: opts.minAccel, minIntervalMs: opts.minIntervalMs }).map((p) => p.tMs);
}

/**
 * 영상 박수마다 maxPairMs 안의 가장 가까운 미사용 IMU 박수와 짝짓고
 * (IMU 시각 − 영상 시각)을 돌려준다. 이 값의 크기가 동기화 오차다.
 */
export function pairClapOffsets(
  poseTimes: readonly number[],
  imuTimes: readonly number[],
  maxPairMs = 500,
): number[] {
  const used = new Set<number>();
  const offsets: number[] = [];
  for (const p of poseTimes) {
    let best = -1;
    let bestDist = Infinity;
    imuTimes.forEach((t, i) => {
      const dist = Math.abs(t - p);
      if (!used.has(i) && dist <= maxPairMs && dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    if (best >= 0) {
      used.add(best);
      offsets.push((imuTimes[best] as number) - p);
    }
  }
  return offsets;
}
