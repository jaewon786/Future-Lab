import { describe, expect, it } from 'vitest';
import { findPeaks } from './peaks';

const t = [0, 10, 20, 30, 40, 50, 60, 70, 80];

describe('findPeaks', () => {
  it('임계값을 넘는 극대점을 찾는다', () => {
    const v = [0, 2, 9, 3, 0, 1, 12, 4, 0];
    expect(findPeaks(t, v, { threshold: 5, minIntervalMs: 0 })).toEqual([
      { index: 2, tMs: 20, value: 9 },
      { index: 6, tMs: 60, value: 12 },
    ]);
  });

  it('최소 간격 안의 피크는 더 큰 것 하나만 남긴다', () => {
    const v = [0, 2, 9, 3, 0, 1, 12, 4, 0];
    expect(findPeaks(t, v, { threshold: 5, minIntervalMs: 50 })).toEqual([{ index: 6, tMs: 60, value: 12 }]);
  });

  it('평평한 꼭대기는 첫 지점 하나로 센다', () => {
    const v = [0, 7, 7, 7, 0, 0, 0, 0, 0];
    expect(findPeaks(t, v, { threshold: 5, minIntervalMs: 0 })).toEqual([{ index: 1, tMs: 10, value: 7 }]);
  });

  it('평평한 구간 뒤에 값이 더 오르면 그 구간은 피크가 아니다', () => {
    const v = [0, 5, 5, 9, 0, 0, 0, 0, 0];
    expect(findPeaks(t, v, { threshold: 4, minIntervalMs: 0 })).toEqual([{ index: 3, tMs: 30, value: 9 }]);
  });

  it('끝까지 평평하면 떨어지는 지점이 없으므로 피크가 아니다', () => {
    const v = [0, 0, 0, 0, 0, 0, 7, 7, 7];
    expect(findPeaks(t, v, { threshold: 5, minIntervalMs: 0 })).toEqual([]);
  });

  it('min 모드는 임계값 아래의 극소점을 찾는다', () => {
    const v = [5, 4, 0.5, 3, 5, 5, 5, 5, 5];
    expect(findPeaks(t, v, { threshold: 1, minIntervalMs: 0, mode: 'min' })).toEqual([
      { index: 2, tMs: 20, value: 0.5 },
    ]);
  });

  it('양 끝 값과 NaN은 피크로 보지 않는다', () => {
    const v = [9, 0, Number.NaN, 0, 0, 0, 0, 0, 9];
    expect(findPeaks(t, v, { threshold: 5, minIntervalMs: 0 })).toEqual([]);
  });

  it('배열 길이가 다르면 짧은 쪽에 맞춘다', () => {
    expect(findPeaks([0, 10, 20], [0, 9, 0, 9, 0], { threshold: 5, minIntervalMs: 0 })).toHaveLength(1);
  });
});
