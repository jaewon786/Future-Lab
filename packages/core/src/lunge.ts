import type { Calibration } from './calibration';
import { distanceAspect, jointAngleAspectDeg } from './geometry';
import { LEFT_ARM, LEFT_LEG, RIGHT_ARM, RIGHT_LEG, type ArmIndices, type LegIndices } from './landmarks';
import type { Landmark } from './session';

/** 런지 한 순간의 측정값. 잴 수 없는 항목은 NaN(각도) 또는 null. */
export interface LungeFeatures {
  /** 앞다리 엉덩이-무릎-발목 각 */
  readonly frontKneeDeg: number;
  readonly backKneeDeg: number;
  /** 수직 기준 상체 기울기 (앞으로 + ) */
  readonly torsoTiltDeg: number;
  /** 칼 팔 어깨-팔꿈치-손목 각 */
  readonly swordArmDeg: number;
  /** 앞무릎이 앞발 끝보다 앞으로 나갔는지 */
  readonly kneePastToe: boolean | null;
  /** 두 발목 간격 ÷ 준비 자세 간격 */
  readonly stanceRatio: number;
}

/** 계획서 7-1의 정상 범위 (초기값, 실측으로 조정) */
export interface LungeRules {
  readonly frontKneeMinDeg: number;
  readonly frontKneeMaxDeg: number;
  readonly backKneeMinDeg: number;
  readonly torsoTiltMaxDeg: number;
  readonly swordArmMinDeg: number;
}

export const DEFAULT_LUNGE_RULES: LungeRules = {
  frontKneeMinDeg: 90,
  frontKneeMaxDeg: 120,
  backKneeMinDeg: 160,
  torsoTiltMaxDeg: 20,
  swordArmMinDeg: 160,
};

export type LungeErrorCode =
  | 'front-knee-shallow'
  | 'front-knee-deep'
  | 'knee-past-toe'
  | 'back-leg-bent'
  | 'torso-tilt'
  | 'arm-bent';

export type LungeCheck = 'front-knee' | 'knee-toe' | 'back-knee' | 'torso' | 'sword-arm';

export interface LungeError {
  readonly code: LungeErrorCode;
  /** 사용자에게 보여 줄 문구 */
  readonly message: string;
}

export interface LungeJudgment {
  /** 판정한 항목에 오류가 없고, 모든 항목이 보류된 것은 아님 */
  readonly ok: boolean;
  readonly errors: readonly LungeError[];
  /** 관절이 가려져 판정하지 못한 항목 */
  readonly skipped: readonly LungeCheck[];
}

const MESSAGES: Record<LungeErrorCode, string> = {
  'front-knee-shallow': '앞무릎을 더 굽히세요',
  'front-knee-deep': '앞무릎이 너무 깊습니다',
  'knee-past-toe': '무릎이 발끝을 넘었습니다',
  'back-leg-bent': '뒷다리를 펴세요',
  'torso-tilt': '상체를 세우세요',
  'arm-bent': '팔을 먼저 뻗으세요',
};

/**
 * 런지 측정. 앞다리는 관절 이름이 아니라 위치(발목이 앞쪽인 다리)로, 칼 팔은 손목이 앞쪽인 팔로 정한다.
 * 측면 촬영에서 MediaPipe가 왼·오른쪽 이름을 바꿔 붙여도 결과가 같다.
 */
export function measureLunge(landmarks: readonly Landmark[], cal: Calibration, minVisibility = 0.5): LungeFeatures {
  const ok = (i: number) => (landmarks[i]?.visibility ?? 0) >= minVisibility;
  const at = (i: number) => landmarks[i] as Landmark;
  const f = cal.facing;
  const a = cal.aspect;
  const angle = (i: number, j: number, k: number) =>
    ok(i) && ok(j) && ok(k) ? jointAngleAspectDeg(at(i), at(j), at(k), a) : Number.NaN;

  // 앞쪽 정도: 발목, 안 보이면 무릎의 x 위치 (앞쪽 방향 기준)
  const forward = (l: LegIndices) => (ok(l.ankle) ? at(l.ankle).x * f : ok(l.knee) ? at(l.knee).x * f : Number.NaN);
  const defaultFront = cal.handedness === 'right' ? RIGHT_LEG : LEFT_LEG;
  const fl = forward(LEFT_LEG);
  const fr = forward(RIGHT_LEG);
  const front = Number.isNaN(fl) || Number.isNaN(fr) ? defaultFront : fl > fr ? LEFT_LEG : RIGHT_LEG;
  const back = front === LEFT_LEG ? RIGHT_LEG : LEFT_LEG;

  const armOk = (arm: ArmIndices) => [arm.shoulder, arm.elbow, arm.wrist].every(ok);
  const defaultArm = cal.handedness === 'right' ? RIGHT_ARM : LEFT_ARM;
  const sword =
    armOk(LEFT_ARM) && armOk(RIGHT_ARM)
      ? at(LEFT_ARM.wrist).x * f > at(RIGHT_ARM.wrist).x * f
        ? LEFT_ARM
        : RIGHT_ARM
      : defaultArm;

  const center = (i: number, j: number) => {
    const pts = [i, j].filter(ok).map(at);
    if (pts.length === 0) return null;
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  };
  const shoulder = center(LEFT_ARM.shoulder, RIGHT_ARM.shoulder);
  const hip = center(LEFT_LEG.hip, RIGHT_LEG.hip);
  const torsoTiltDeg =
    shoulder && hip && hip.y > shoulder.y
      ? (Math.atan2((shoulder.x - hip.x) * a * f, hip.y - shoulder.y) * 180) / Math.PI
      : Number.NaN;

  return {
    frontKneeDeg: angle(front.hip, front.knee, front.ankle),
    backKneeDeg: angle(back.hip, back.knee, back.ankle),
    torsoTiltDeg,
    swordArmDeg: angle(sword.shoulder, sword.elbow, sword.wrist),
    kneePastToe: ok(front.knee) && ok(front.foot) ? (at(front.knee).x - at(front.foot).x) * f > 0 : null,
    stanceRatio:
      ok(LEFT_LEG.ankle) && ok(RIGHT_LEG.ankle)
        ? distanceAspect(at(LEFT_LEG.ankle), at(RIGHT_LEG.ankle), a) / cal.stanceWidth
        : Number.NaN,
  };
}

/** 측정값을 규칙과 비교한다. 잴 수 없었던 항목은 오류가 아니라 skipped에 넣는다. */
export function judgeLunge(features: LungeFeatures, rules: LungeRules = DEFAULT_LUNGE_RULES): LungeJudgment {
  const errors: LungeError[] = [];
  const skipped: LungeCheck[] = [];
  const fail = (code: LungeErrorCode) => errors.push({ code, message: MESSAGES[code] });

  if (Number.isNaN(features.frontKneeDeg)) skipped.push('front-knee');
  else if (features.frontKneeDeg > rules.frontKneeMaxDeg) fail('front-knee-shallow');
  else if (features.frontKneeDeg < rules.frontKneeMinDeg) fail('front-knee-deep');

  if (features.kneePastToe === null) skipped.push('knee-toe');
  else if (features.kneePastToe) fail('knee-past-toe');

  if (Number.isNaN(features.backKneeDeg)) skipped.push('back-knee');
  else if (features.backKneeDeg < rules.backKneeMinDeg) fail('back-leg-bent');

  if (Number.isNaN(features.torsoTiltDeg)) skipped.push('torso');
  else if (Math.abs(features.torsoTiltDeg) > rules.torsoTiltMaxDeg) fail('torso-tilt');

  if (Number.isNaN(features.swordArmDeg)) skipped.push('sword-arm');
  else if (features.swordArmDeg < rules.swordArmMinDeg) fail('arm-bent');

  return { ok: errors.length === 0 && skipped.length < 5, errors, skipped };
}
