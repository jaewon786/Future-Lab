export interface FusionOptions {
  /** 폰 찌르기 시각 전후로 칼 팔 각도를 볼 범위 */
  readonly windowMs: number;
  readonly minArmDeg: number;
}

/** 계획서 7-1: ±150ms 안에 칼 팔 160° 이상 */
export const DEFAULT_FUSION: FusionOptions = { windowMs: 150, minArmDeg: 160 };

export type FusionReason = 'arm-extended' | 'arm-bent' | 'arm-not-visible';

export interface FusionResult {
  readonly accepted: boolean;
  readonly reason: FusionReason;
}

/**
 * 폰 IMU가 감지한 찌르기를 웹캠의 칼 팔 각도로 확인한다.
 * 범위 안에 잰 각도가 있으면 최댓값으로 판정하고(덜 폈으면 거부 → "팔을 더 뻗으세요"),
 * 팔이 안 보여 잴 수 없었으면 폰 감지만으로 인정한다.
 */
export function fuseThrust(
  imuThrustMs: number,
  armSamples: readonly { readonly tMs: number; readonly swordArmDeg: number }[],
  opts: FusionOptions = DEFAULT_FUSION,
): FusionResult {
  const seen = armSamples
    .filter((s) => Math.abs(s.tMs - imuThrustMs) <= opts.windowMs && Number.isFinite(s.swordArmDeg))
    .map((s) => s.swordArmDeg);
  if (seen.length === 0) return { accepted: true, reason: 'arm-not-visible' };
  return Math.max(...seen) >= opts.minArmDeg
    ? { accepted: true, reason: 'arm-extended' }
    : { accepted: false, reason: 'arm-bent' };
}
