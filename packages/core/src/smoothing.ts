import type { Landmark } from './session';

/**
 * 관절 좌표 떨림을 줄이는 지수 이동 평균 필터를 만든다. 프레임마다 호출한다.
 * alpha: 새 값의 비중(0~1, 1이면 필터 없음). 15fps에서 0.5면 약 2프레임 지연.
 * 신뢰도가 minVisibility 미만인 관절은 이전 위치를 유지하고 신뢰도만 새 값으로 바꾼다
 * (판정 쪽은 신뢰도를 보고 그 관절을 건너뛴다). 입력 배열은 바꾸지 않는다.
 */
export function createLandmarkSmoother(
  alpha = 0.5,
  minVisibility = 0.5,
): (frame: readonly Landmark[]) => Landmark[] {
  let prev: Landmark[] | null = null;
  return (frame) => {
    const next = frame.map((cur, i) => {
      const p = prev?.[i];
      if (!p) return { ...cur };
      if (cur.visibility < minVisibility) return { x: p.x, y: p.y, visibility: cur.visibility };
      return { x: p.x + alpha * (cur.x - p.x), y: p.y + alpha * (cur.y - p.y), visibility: cur.visibility };
    });
    prev = next;
    return next;
  };
}
