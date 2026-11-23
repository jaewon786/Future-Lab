// 테스트 전용: 관절 각도로부터 측면 촬영 포즈(33개 관절)를 만든다.
// 계산은 "화면비 공간"(x에 화면비를 곱한 좌표, 높이 단위)에서 하고 마지막에 정규화 좌표로 되돌린다.
import { LEFT_ARM, LEFT_LEG, LM, RIGHT_ARM, RIGHT_LEG, type ArmIndices, type LegIndices } from '../landmarks';
import { POSE_LANDMARK_COUNT, type Landmark } from '../session';

export interface PoseSpec {
  /** +1: 화면 오른쪽(x 증가 방향)을 봄, −1: 왼쪽 */
  readonly facing: 1 | -1;
  /** 엉덩이 중심 (화면비 공간) */
  readonly hipX: number;
  readonly hipY: number;
  /** 허벅지 방향: 수직 아래 기준 각도, 앞쪽이 + */
  readonly frontThighDeg: number;
  /** 엉덩이-무릎-발목 각 */
  readonly frontKneeDeg: number;
  readonly backThighDeg: number;
  readonly backKneeDeg: number;
  /** 수직 기준 상체 기울기, 앞으로 기울면 + */
  readonly torsoTiltDeg: number;
  /** 칼 팔의 어깨-팔꿈치-손목 각 */
  readonly swordElbowDeg: number;
  /** 앞다리·칼 팔에 붙일 관절 이름 쪽 */
  readonly swordSide: 'right' | 'left';
  /** 카메라 화면 너비 ÷ 높이 */
  readonly aspect: number;
  readonly visibility?: number;
  /** 신뢰도를 0.1로 낮출 관절 번호 */
  readonly hidden?: readonly number[];
  /** MediaPipe가 왼·오른 다리 이름을 바꿔 붙인 상황 */
  readonly swapLegs?: boolean;
}

export const SEGMENT = { thigh: 0.22, shin: 0.22, torso: 0.28, upperArm: 0.14, forearm: 0.14, foot: 0.06, heel: 0.02, head: 0.1 };

/** 오른손잡이, 오른쪽을 보는 준비 자세 (앙 가르드) */
export const READY_SPEC: PoseSpec = {
  facing: 1,
  hipX: 0.6,
  hipY: 0.5,
  frontThighDeg: 35,
  frontKneeDeg: 140,
  backThighDeg: -35,
  backKneeDeg: 140,
  torsoTiltDeg: 0,
  swordElbowDeg: 120,
  swordSide: 'right',
  aspect: 4 / 3,
};

/** 7-1 규칙을 모두 만족하는 런지 정점 */
export const LUNGE_SPEC: PoseSpec = {
  ...READY_SPEC,
  frontThighDeg: 80,
  frontKneeDeg: 100,
  backThighDeg: -55,
  backKneeDeg: 170,
  torsoTiltDeg: 5,
  swordElbowDeg: 175,
};

interface P {
  x: number;
  y: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** from에서 len만큼, 수직 아래 기준 deg(앞쪽 +) 방향으로 간 점 */
function step(from: P, len: number, deg: number, facing: number): P {
  return { x: from.x + len * Math.sin(rad(deg)) * facing, y: from.y + len * Math.cos(rad(deg)) };
}

/** 두 스펙 사이를 t(0~1)로 보간한다. 숫자 필드만 보간하고 나머지는 a를 따른다. */
export function lerpSpec(a: PoseSpec, b: PoseSpec, t: number): PoseSpec {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    ...a,
    hipX: mix(a.hipX, b.hipX),
    hipY: mix(a.hipY, b.hipY),
    frontThighDeg: mix(a.frontThighDeg, b.frontThighDeg),
    frontKneeDeg: mix(a.frontKneeDeg, b.frontKneeDeg),
    backThighDeg: mix(a.backThighDeg, b.backThighDeg),
    backKneeDeg: mix(a.backKneeDeg, b.backKneeDeg),
    torsoTiltDeg: mix(a.torsoTiltDeg, b.torsoTiltDeg),
    swordElbowDeg: mix(a.swordElbowDeg, b.swordElbowDeg),
  };
}

export function makePose(spec: PoseSpec): Landmark[] {
  const f = spec.facing;
  const hip: P = { x: spec.hipX, y: spec.hipY };

  const frontKnee = step(hip, SEGMENT.thigh, spec.frontThighDeg, f);
  const frontAnkle = step(frontKnee, SEGMENT.shin, spec.frontThighDeg - (180 - spec.frontKneeDeg), f);
  const backKnee = step(hip, SEGMENT.thigh, spec.backThighDeg, f);
  const backAnkle = step(backKnee, SEGMENT.shin, spec.backThighDeg + (180 - spec.backKneeDeg), f);

  const shoulder: P = {
    x: hip.x + SEGMENT.torso * Math.sin(rad(spec.torsoTiltDeg)) * f,
    y: hip.y - SEGMENT.torso * Math.cos(rad(spec.torsoTiltDeg)),
  };
  const nose: P = { x: shoulder.x + 0.03 * f, y: shoulder.y - SEGMENT.head };
  const swordElbow: P = { x: shoulder.x + SEGMENT.upperArm * f, y: shoulder.y };
  const bend = rad(180 - spec.swordElbowDeg);
  const swordWrist: P = {
    x: swordElbow.x + SEGMENT.forearm * Math.cos(bend) * f,
    y: swordElbow.y + SEGMENT.forearm * Math.sin(bend),
  };
  // 뒷팔은 뒤쪽 위로 든 자세 (칼 팔보다 항상 뒤에 있음)
  const backElbow: P = { x: shoulder.x - 0.08 * f, y: shoulder.y - 0.05 };
  const backWrist: P = { x: shoulder.x - 0.1 * f, y: shoulder.y - 0.15 };

  const vis = spec.visibility ?? 0.95;
  const out: P[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ ...nose }));
  const put = (i: number, p: P) => {
    out[i] = { ...p };
  };

  const swordArm: ArmIndices = spec.swordSide === 'right' ? RIGHT_ARM : LEFT_ARM;
  const backArm: ArmIndices = spec.swordSide === 'right' ? LEFT_ARM : RIGHT_ARM;
  let frontLeg: LegIndices = spec.swordSide === 'right' ? RIGHT_LEG : LEFT_LEG;
  let backLeg: LegIndices = spec.swordSide === 'right' ? LEFT_LEG : RIGHT_LEG;
  if (spec.swapLegs) [frontLeg, backLeg] = [backLeg, frontLeg];

  put(LM.NOSE, nose);
  put(swordArm.shoulder, shoulder);
  put(backArm.shoulder, shoulder);
  put(swordArm.elbow, swordElbow);
  put(swordArm.wrist, swordWrist);
  put(backArm.elbow, backElbow);
  put(backArm.wrist, backWrist);
  for (const [leg, knee, ankle] of [
    [frontLeg, frontKnee, frontAnkle],
    [backLeg, backKnee, backAnkle],
  ] as const) {
    put(leg.hip, hip);
    put(leg.knee, knee);
    put(leg.ankle, ankle);
    put(leg.heel, { x: ankle.x - SEGMENT.heel * f, y: ankle.y });
    put(leg.foot, { x: ankle.x + SEGMENT.foot * f, y: ankle.y });
  }
  // 손가락 관절(17~22)은 손목 위치로
  for (const i of [17, 19, 21]) put(i, out[LM.LEFT_WRIST] as P);
  for (const i of [18, 20, 22]) put(i, out[LM.RIGHT_WRIST] as P);

  const hidden = new Set(spec.hidden ?? []);
  return out.map((p, i) => ({ x: p.x / spec.aspect, y: p.y, visibility: hidden.has(i) ? 0.1 : vis }));
}
