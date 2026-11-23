import { describe, expect, it } from 'vitest';
import type { LungeEvent } from '@fc/core';
import { describeEvent, summarize } from './feedback';

const features = {
  frontKneeDeg: 104.4,
  backKneeDeg: 171,
  torsoTiltDeg: 4.6,
  swordArmDeg: 175,
  kneePastToe: false,
  stanceRatio: 2.5,
};
const good: LungeEvent = { tMs: 1000, features, judgment: { ok: true, errors: [], skipped: [] } };
const bad: LungeEvent = {
  tMs: 3000,
  features: { ...features, torsoTiltDeg: 30 },
  judgment: { ok: false, errors: [{ code: 'torso-tilt', message: '상체를 세우세요' }], skipped: [] },
};
const partial: LungeEvent = {
  tMs: 5000,
  features: { ...features, frontKneeDeg: Number.NaN },
  judgment: { ok: true, errors: [], skipped: ['front-knee', 'knee-toe'] },
};

describe('describeEvent', () => {
  it('정상 런지는 좋은 런지와 앞무릎 각도를 보여 준다', () => {
    const d = describeEvent(good);
    expect(d.ok).toBe(true);
    expect(d.title).toBe('좋은 런지');
    expect(d.lines.join(' ')).toContain('앞무릎 104°');
  });

  it('오류 런지는 고칠 점 문구를 보여 준다', () => {
    const d = describeEvent(bad);
    expect(d.ok).toBe(false);
    expect(d.title).toBe('고칠 점 1개');
    expect(d.lines).toContain('상체를 세우세요');
  });

  it('판정 못 한 항목을 알려 준다', () => {
    expect(describeEvent(partial).lines.join(' ')).toContain('판정 못 함: 앞무릎, 무릎-발끝');
  });
});

describe('summarize', () => {
  it('횟수, 좋은 런지 수, 오류별 횟수를 센다', () => {
    expect(summarize([good, bad, bad, partial])).toEqual({
      total: 4,
      good: 2,
      byError: { '상체를 세우세요': 2 },
    });
  });

  it('빈 목록', () => {
    expect(summarize([])).toEqual({ total: 0, good: 0, byError: {} });
  });
});
