/** MediaPipe Pose 관절 번호 (33개 중 이 앱이 쓰는 것) */
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT: 31,
  RIGHT_FOOT: 32,
} as const;

/** 한쪽 다리의 관절 번호 */
export interface LegIndices {
  readonly hip: number;
  readonly knee: number;
  readonly ankle: number;
  readonly heel: number;
  readonly foot: number;
}

/** 한쪽 팔의 관절 번호 */
export interface ArmIndices {
  readonly shoulder: number;
  readonly elbow: number;
  readonly wrist: number;
}

export const LEFT_LEG: LegIndices = {
  hip: LM.LEFT_HIP,
  knee: LM.LEFT_KNEE,
  ankle: LM.LEFT_ANKLE,
  heel: LM.LEFT_HEEL,
  foot: LM.LEFT_FOOT,
};
export const RIGHT_LEG: LegIndices = {
  hip: LM.RIGHT_HIP,
  knee: LM.RIGHT_KNEE,
  ankle: LM.RIGHT_ANKLE,
  heel: LM.RIGHT_HEEL,
  foot: LM.RIGHT_FOOT,
};
export const LEFT_ARM: ArmIndices = { shoulder: LM.LEFT_SHOULDER, elbow: LM.LEFT_ELBOW, wrist: LM.LEFT_WRIST };
export const RIGHT_ARM: ArmIndices = { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST };
