import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoseFrame } from '@fc/core';
import { ReplayPoseSource } from './replay-source';
import type { PoseSourceFrame } from './pose-source';

const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
const frames: PoseFrame[] = [
  { tMs: 0, landmarks: lm },
  { tMs: 66, landmarks: lm },
  { tMs: 133, landmarks: lm },
];

describe('ReplayPoseSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('기록의 시간 간격대로 프레임을 내보낸다', async () => {
    const got: PoseSourceFrame[] = [];
    const src = new ReplayPoseSource(frames);
    await src.start((f) => got.push(f));
    expect(got).toHaveLength(1);
    vi.advanceTimersByTime(65);
    expect(got).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(got).toHaveLength(2);
    vi.advanceTimersByTime(67);
    expect(got.map((f) => f.tMs)).toEqual([0, 66, 133]);
  });

  it('끝나면 onEnd를 부른다', async () => {
    const onEnd = vi.fn();
    const src = new ReplayPoseSource(frames, { onEnd });
    await src.start(() => {});
    vi.advanceTimersByTime(500);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('stop 후에는 더 내보내지 않는다', async () => {
    const got: PoseSourceFrame[] = [];
    const src = new ReplayPoseSource(frames);
    await src.start((f) => got.push(f));
    src.stop();
    vi.advanceTimersByTime(500);
    expect(got).toHaveLength(1);
  });

  it('화면비 기본값은 4:3', () => {
    expect(new ReplayPoseSource(frames).aspect).toBeCloseTo(4 / 3);
  });
});
