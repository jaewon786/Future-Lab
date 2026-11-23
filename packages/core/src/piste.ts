import type { Calibration } from './calibration';
import { LM } from './landmarks';
import type { Landmark } from './session';

/** 에페 칼 길이 (최대 90cm) */
export const BLADE_LENGTH_M = 0.9;
/** 다리 길이를 모를 때의 가정 (성인 평균 근처, 실측으로 조정) */
export const DEFAULT_LEG_LENGTH_M = 0.9;
/** 피스트 14m의 절반 */
export const PISTE_HALF_LENGTH_M = 7;

/** 키로 다리 길이를 추정 (다리 ≈ 키 × 0.47, 가정) */
export function legLengthFromHeight(heightM: number): number {
  return heightM * 0.47;
}

/** 화면 높이 단위 → 미터 */
export function metersPerUnit(cal: Calibration, legLengthM = DEFAULT_LEG_LENGTH_M): number {
  return legLengthM / cal.legLength;
}

/** 도달 거리 = 팔 길이 + 칼 길이 + 런지 전진량 (계획서 7-1) */
export function reachMeters(cal: Calibration, legLengthM = DEFAULT_LEG_LENGTH_M, lungeAdvanceM = 0): number {
  return cal.armLength * metersPerUnit(cal, legLengthM) + BLADE_LENGTH_M + lungeAdvanceM;
}

export function isOffPiste(xM: number): boolean {
  return Math.abs(xM) > PISTE_HALF_LENGTH_M;
}

export interface PisteTrackerOptions {
  /** 첫 프레임에서의 피스트 위치 (m, 상대 쪽이 +) */
  readonly startM?: number;
  readonly legLengthM?: number;
  readonly minVisibility?: number;
}

/**
 * 웹캠 엉덩이 위치를 피스트 위 미터 좌표로 바꾸는 추적기. 첫 프레임 위치를 startM으로 둔다.
 * 앞쪽(보정 때 정한 facing 방향)으로 가면 값이 커진다. 엉덩이가 안 보이면 마지막 값을 유지한다.
 */
export function createPisteTracker(cal: Calibration, opts: PisteTrackerOptions = {}): (landmarks: readonly Landmark[]) => number {
  const startM = opts.startM ?? 0;
  const mpu = metersPerUnit(cal, opts.legLengthM);
  const minVis = opts.minVisibility ?? 0.5;
  let origin: number | null = null;
  let last = startM;

  return (landmarks) => {
    const hips = [LM.LEFT_HIP, LM.RIGHT_HIP]
      .map((i) => landmarks[i])
      .filter((l): l is Landmark => l !== undefined && l.visibility >= minVis);
    if (hips.length === 0) return last;
    const x = (hips.reduce((s, l) => s + l.x, 0) / hips.length) * cal.aspect * cal.facing;
    if (origin === null) origin = x;
    last = startM + (x - origin) * mpu;
    return last;
  };
}
