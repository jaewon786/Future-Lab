import { describe, expect, it } from 'vitest';
import { LM } from './landmarks';
import { checkFraming } from './pose-quality';
import type { Landmark } from './session';
import { READY_SPEC, makePose } from './test-utils/synthetic-pose';

/** 화면 가운데(0.5, 0.5)를 기준으로 확대·이동 */
function transform(p: Landmark[], scale: number, dx = 0, dy = 0): Landmark[] {
  return p.map((l) => ({ ...l, x: 0.5 + (l.x - 0.5) * scale + dx, y: 0.5 + (l.y - 0.5) * scale + dy }));
}

const hintsOf = (p: Landmark[]) => {
  const r = checkFraming(p);
  return r.ok ? [] : r.hints;
};

describe('checkFraming', () => {
  it('측면 준비 자세가 화면에 잘 들어오면 ok', () => {
    expect(checkFraming(makePose(READY_SPEC))).toEqual({ ok: true });
  });

  it('손목이 안 보이면 전신과 양손이 보이게 안내', () => {
    const hints = hintsOf(makePose({ ...READY_SPEC, hidden: [LM.LEFT_WRIST] }));
    expect(hints.some((h) => h.includes('보이게'))).toBe(true);
  });

  it('너무 가까우면 물러나라고 안내', () => {
    expect(hintsOf(transform(makePose(READY_SPEC), 1.3)).some((h) => h.includes('물러나'))).toBe(true);
  });

  it('너무 멀면 앞으로 오라고 안내', () => {
    expect(hintsOf(transform(makePose(READY_SPEC), 0.4)).some((h) => h.includes('앞으로'))).toBe(true);
  });

  it('발이 화면 아래로 잘리면 알려 준다', () => {
    expect(hintsOf(transform(makePose(READY_SPEC), 1, 0, 0.15)).some((h) => h.includes('발'))).toBe(true);
  });

  it('옆으로 치우쳐 잘리면 가운데로 오라고 안내', () => {
    expect(hintsOf(transform(makePose(READY_SPEC), 1, 0.5)).some((h) => h.includes('가운데'))).toBe(true);
  });
});
