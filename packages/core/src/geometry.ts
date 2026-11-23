/** 화면 좌표의 2D 점 (MediaPipe 정규화 좌표 등) */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * 관절 b에서 a와 c가 이루는 각도(0~180°).
 * 예: 엉덩이-무릎-발목 → 무릎 각도.
 * 두 점이 겹쳐 방향을 정할 수 없으면 NaN을 돌려준다. 호출 쪽은 NaN을 "판정 보류"로 다룬다.
 */
export function jointAngleDeg(a: Point2D, b: Point2D, c: Point2D): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);
  if (len1 === 0 || len2 === 0) return Number.NaN;

  const cos = (v1x * v2x + v1y * v2y) / (len1 * len2);
  // 부동소수점 오차로 [-1, 1]을 살짝 벗어나는 경우를 막는다
  const clamped = Math.min(1, Math.max(-1, cos));
  return (Math.acos(clamped) * 180) / Math.PI;
}
