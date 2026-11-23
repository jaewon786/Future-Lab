import type { Calibration } from './calibration';
import { LEFT_ARM, RIGHT_ARM } from './landmarks';
import { measureLunge } from './lunge';
import type { LungeFrame } from './lunge-detector';

export interface WebcamThrustOptions {
  /** 이 각도 이상으로 칼 팔이 펴져야 찌르기 */
  readonly minArmDeg: number;
  /** 이 각도 밑으로 굽혀야 다음 찌르기를 받음 */
  readonly rearmArmDeg: number;
  /** 칼 손목 앞쪽 속도 최소값 (팔 길이/초) */
  readonly minForwardSpeed: number;
  /** 속도를 재는 구간 */
  readonly speedWindowMs: number;
  readonly debounceMs: number;
  readonly minVisibility: number;
}

export const DEFAULT_WEBCAM_THRUST: WebcamThrustOptions = {
  minArmDeg: 160,
  rearmArmDeg: 140,
  minForwardSpeed: 0.6,
  speedWindowMs: 150,
  debounceMs: 500,
  minVisibility: 0.5,
};

export interface WebcamThrustEvent {
  readonly tMs: number;
  readonly swordArmDeg: number;
  /** 팔 길이/초 */
  readonly forwardSpeed: number;
}

/**
 * 웹캠만으로 찌르기 감지 (폰 센서를 못 쓸 때의 대체 방식).
 * 칼 팔이 빠르게 앞으로 펴지는 순간 — 팔 각도 ≥ minArmDeg 이면서 손목 앞쪽 속도 ≥ minForwardSpeed — 을 찌르기로 본다.
 * 칼 팔은 손목이 앞쪽에 있는 팔이다 (lunge.ts와 같은 기준).
 */
export function createWebcamThrustDetector(
  cal: Calibration,
  opts: WebcamThrustOptions = DEFAULT_WEBCAM_THRUST,
): (frame: LungeFrame) => WebcamThrustEvent | null {
  const history: { tMs: number; x: number }[] = [];
  let armed = true;
  let lastEmitMs = Number.NEGATIVE_INFINITY;

  return ({ tMs, landmarks }) => {
    const armDeg = measureLunge(landmarks, cal, opts.minVisibility).swordArmDeg;
    const wrists = [LEFT_ARM.wrist, RIGHT_ARM.wrist]
      .map((i) => landmarks[i])
      .filter((l) => l !== undefined && l.visibility >= opts.minVisibility)
      .map((l) => (l as { x: number }).x * cal.aspect * cal.facing);
    if (Number.isNaN(armDeg) || wrists.length === 0) return null;

    if (armDeg < opts.rearmArmDeg) armed = true;
    const x = Math.max(...wrists);
    history.push({ tMs, x });
    while (history.length > 0 && tMs - (history[0] as { tMs: number }).tMs > opts.speedWindowMs) history.shift();
    const oldest = history[0] as { tMs: number; x: number };
    const dtS = (tMs - oldest.tMs) / 1000;
    const forwardSpeed = dtS > 0 ? (x - oldest.x) / dtS / cal.armLength : 0;

    if (!armed || armDeg < opts.minArmDeg || forwardSpeed < opts.minForwardSpeed) return null;
    if (tMs - lastEmitMs < opts.debounceMs) return null;
    armed = false;
    lastEmitMs = tMs;
    return { tMs, swordArmDeg: armDeg, forwardSpeed };
  };
}
