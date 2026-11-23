import { describe, expect, it } from 'vitest';
import type { Landmark } from './session';
import { createLandmarkSmoother } from './smoothing';

const frame = (x: number, visibility = 0.9): Landmark[] =>
  Array.from({ length: 33 }, () => ({ x, y: x, visibility }));

describe('createLandmarkSmoother', () => {
  it('첫 프레임은 그대로 통과한다', () => {
    const smooth = createLandmarkSmoother(0.5);
    expect(smooth(frame(0.3))[0]).toEqual({ x: 0.3, y: 0.3, visibility: 0.9 });
  });

  it('계단 입력을 지수 이동 평균으로 따라간다', () => {
    const smooth = createLandmarkSmoother(0.5);
    smooth(frame(0));
    expect(smooth(frame(1))[5]!.x).toBeCloseTo(0.5);
    expect(smooth(frame(1))[5]!.x).toBeCloseTo(0.75);
  });

  it('신뢰도 낮은 관절은 이전 위치를 유지하고 신뢰도만 갱신한다', () => {
    const smooth = createLandmarkSmoother(0.5);
    smooth(frame(0));
    const low = smooth(frame(1, 0.2));
    expect(low[0]).toEqual({ x: 0, y: 0, visibility: 0.2 });
    expect(smooth(frame(1))[0]!.x).toBeCloseTo(0.5);
  });

  it('alpha 1이면 필터 없이 그대로', () => {
    const smooth = createLandmarkSmoother(1);
    smooth(frame(0));
    expect(smooth(frame(0.8))[0]!.x).toBeCloseTo(0.8);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const smooth = createLandmarkSmoother(0.5);
    smooth(frame(0));
    const input = frame(1);
    smooth(input);
    expect(input[0]!.x).toBe(1);
  });
});
