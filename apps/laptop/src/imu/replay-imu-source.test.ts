import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImuRecord } from '@fc/core';
import { ReplayImuSource } from './replay-imu-source';

const sample = (tMs: number): ImuRecord => ({
  tMs,
  accel: { x: 0, y: tMs / 100, z: 0 },
  rotation: { alpha: 0, beta: 0, gamma: 0 },
});

describe('ReplayImuSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('기록의 시각 간격대로 샘플을 내보낸다', async () => {
    const got: ImuRecord[] = [];
    const src = new ReplayImuSource([sample(0), sample(16), sample(33)]);
    await src.start((s) => got.push(s));
    expect(got.map((s) => s.tMs)).toEqual([0]);
    vi.advanceTimersByTime(16);
    expect(got.map((s) => s.tMs)).toEqual([0, 16]);
    vi.advanceTimersByTime(17);
    expect(got.map((s) => s.tMs)).toEqual([0, 16, 33]);
  });

  it('stop 후에는 내보내지 않는다', async () => {
    const got: ImuRecord[] = [];
    const src = new ReplayImuSource([sample(0), sample(16)]);
    await src.start((s) => got.push(s));
    src.stop();
    vi.advanceTimersByTime(100);
    expect(got).toHaveLength(1);
  });

  it('빈 기록도 문제없다', async () => {
    const src = new ReplayImuSource([]);
    await expect(src.start(() => {})).resolves.toBeUndefined();
  });
});
