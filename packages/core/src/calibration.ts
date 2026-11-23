import { distanceAspect } from './geometry';
import { LEFT_ARM, LEFT_LEG, RIGHT_ARM, RIGHT_LEG, type ArmIndices, type LegIndices } from './landmarks';
import type { Landmark } from './session';

export type Handedness = 'right' | 'left';

/** 준비 자세에서 잰 사람별 기준값. 길이는 화면 높이 단위(화면비 보정). */
export interface Calibration {
  /** +1: 화면 오른쪽을 보고 섬, −1: 왼쪽 */
  readonly facing: 1 | -1;
  /** 준비 자세 두 발목 간격 */
  readonly stanceWidth: number;
  /** 칼 팔 길이 (어깨-팔꿈치 + 팔꿈치-손목) */
  readonly armLength: number;
  /** 다리 길이 (엉덩이-무릎 + 무릎-발목, 양 다리 평균) */
  readonly legLength: number;
  readonly handedness: Handedness;
  /** 카메라 화면 너비 ÷ 높이 */
  readonly aspect: number;
}

export interface CalibrationOptions {
  readonly minFrames: number;
  /** 보폭 (최대−최소)/중앙값 허용치 */
  readonly maxStanceVariation: number;
  readonly minVisibility: number;
}

/** 15fps에서 약 2초 이상 쓸 수 있는 프레임이 필요 */
export const DEFAULT_CALIBRATION: CalibrationOptions = { minFrames: 30, maxStanceVariation: 0.1, minVisibility: 0.5 };

export type CalibrationResult =
  | { readonly ok: true; readonly calibration: Calibration }
  | { readonly ok: false; readonly errors: readonly string[] };

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * 준비 자세(앙 가르드)를 유지한 프레임들로 기준값을 만든다.
 * 앞쪽 방향은 발끝이 발뒤꿈치보다 앞에 있는 쪽으로 정한다 (관절의 왼·오른 이름은 쓰지 않음).
 */
export function calibrate(
  frames: readonly (readonly Landmark[])[],
  handedness: Handedness,
  aspect: number,
  opts: CalibrationOptions = DEFAULT_CALIBRATION,
): CalibrationResult {
  const stances: number[] = [];
  const legs: number[] = [];
  const arms: number[] = [];
  let facingVote = 0;

  for (const lm of frames) {
    const ok = (i: number) => (lm[i]?.visibility ?? 0) >= opts.minVisibility;
    const at = (i: number) => lm[i] as Landmark;
    const legOk = (l: LegIndices) => [l.hip, l.knee, l.ankle, l.heel, l.foot].every(ok);
    const armOk = (a: ArmIndices) => [a.shoulder, a.elbow, a.wrist].every(ok);
    if (!legOk(LEFT_LEG) || !legOk(RIGHT_LEG) || !(armOk(LEFT_ARM) || armOk(RIGHT_ARM))) continue;

    const vote =
      at(LEFT_LEG.foot).x - at(LEFT_LEG.heel).x + (at(RIGHT_LEG.foot).x - at(RIGHT_LEG.heel).x);
    const frameFacing = vote >= 0 ? 1 : -1;
    facingVote += vote;

    const legLen = (l: LegIndices) =>
      distanceAspect(at(l.hip), at(l.knee), aspect) + distanceAspect(at(l.knee), at(l.ankle), aspect);
    // 칼 팔: 손목이 앞쪽에 있는 팔 (보이는 팔이 하나면 그 팔)
    const candidates = [LEFT_ARM, RIGHT_ARM].filter(armOk);
    const sword = candidates.reduce((best, a) =>
      at(a.wrist).x * frameFacing > at(best.wrist).x * frameFacing ? a : best,
    );

    stances.push(distanceAspect(at(LEFT_LEG.ankle), at(RIGHT_LEG.ankle), aspect));
    legs.push((legLen(LEFT_LEG) + legLen(RIGHT_LEG)) / 2);
    arms.push(
      distanceAspect(at(sword.shoulder), at(sword.elbow), aspect) +
        distanceAspect(at(sword.elbow), at(sword.wrist), aspect),
    );
  }

  if (stances.length < opts.minFrames) {
    return { ok: false, errors: ['준비 자세가 충분히 잡히지 않았습니다 — 전신이 보이게 서서 다시 시도하세요'] };
  }
  const stanceWidth = median(stances);
  if ((Math.max(...stances) - Math.min(...stances)) / stanceWidth > opts.maxStanceVariation) {
    return { ok: false, errors: ['움직이지 말고 준비 자세를 유지하세요'] };
  }

  return {
    ok: true,
    calibration: {
      facing: facingVote >= 0 ? 1 : -1,
      stanceWidth,
      armLength: median(arms),
      legLength: median(legs),
      handedness,
      aspect,
    },
  };
}
