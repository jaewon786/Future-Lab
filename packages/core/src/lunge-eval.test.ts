import { describe, expect, it } from 'vitest';
import { evaluateLungeLabels } from './lunge-eval';
import type { LabelEvent } from './session';

const ev = (tMs: number, ok: boolean) => ({ tMs, judgment: { ok } });

describe('evaluateLungeLabels', () => {
  const labels: LabelEvent[] = [
    { tMs: 1000, kind: 'lunge-good' },
    { tMs: 3000, kind: 'lunge-bad' },
    { tMs: 5000, kind: 'lunge-good' },
    { tMs: 6000, kind: 'thrust' },
  ];

  it('감지한 런지와 사람 라벨을 짝지어 판정 일치율을 센다', () => {
    const r = evaluateLungeLabels([ev(900, true), ev(2800, false), ev(4700, false)], labels, 1000);
    expect(r).toMatchObject({ lungeLabels: 3, matched: 3, agreed: 2, missed: 0, extra: 0 });
    expect(r.agreement).toBeCloseTo(2 / 3);
    expect(r.detectionRate).toBe(1);
  });

  it('짝이 없는 라벨은 놓친 것, 짝이 없는 감지는 추가 감지로 센다', () => {
    const r = evaluateLungeLabels([ev(1100, true), ev(8000, true)], labels, 1000);
    expect(r).toMatchObject({ matched: 1, missed: 2, extra: 1 });
    expect(r.detectionRate).toBeCloseTo(1 / 3);
  });

  it('라벨 하나에 감지 하나만 짝짓는다', () => {
    const r = evaluateLungeLabels([ev(900, true), ev(1100, true)], labels, 1000);
    expect(r.matched).toBe(1);
    expect(r.extra).toBe(1);
  });

  it('런지 라벨이 없으면 비율은 NaN', () => {
    const r = evaluateLungeLabels([], [], 1000);
    expect(r.agreement).toBeNaN();
    expect(r.detectionRate).toBeNaN();
  });
});
