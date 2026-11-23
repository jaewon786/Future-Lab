import { describe, expect, it } from 'vitest';
import { jointAngleAspectDeg } from '../geometry';
import { LM } from '../landmarks';
import { LUNGE_SPEC, READY_SPEC, lerpSpec, makePose } from './synthetic-pose';

const A = 4 / 3;

describe('makePose (합성 포즈)', () => {
  it('넣은 관절 각도가 다시 재도 0.5° 이내', () => {
    const p = makePose(LUNGE_SPEC);
    const at = (a: number, b: number, c: number) => jointAngleAspectDeg(p[a]!, p[b]!, p[c]!, A);
    expect(at(LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE)).toBeCloseTo(100, 0);
    expect(at(LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE)).toBeCloseTo(170, 0);
    expect(at(LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST)).toBeCloseTo(175, 0);
  });

  it('33개 관절이 모두 화면 안에 있다', () => {
    for (const spec of [READY_SPEC, LUNGE_SPEC]) {
      const p = makePose(spec);
      expect(p).toHaveLength(33);
      for (const l of p) {
        expect(l.x).toBeGreaterThan(0);
        expect(l.x).toBeLessThan(1);
        expect(l.y).toBeGreaterThan(0);
        expect(l.y).toBeLessThan(1);
      }
    }
  });

  it('facing −1이면 앞발이 엉덩이보다 왼쪽에 있다', () => {
    const p = makePose({ ...LUNGE_SPEC, facing: -1 });
    expect(p[LM.RIGHT_ANKLE]!.x).toBeLessThan(p[LM.RIGHT_HIP]!.x);
  });

  it('swapLegs는 다리 관절 이름만 바꾼다', () => {
    const a = makePose(LUNGE_SPEC);
    const b = makePose({ ...LUNGE_SPEC, swapLegs: true });
    expect(b[LM.LEFT_ANKLE]).toEqual(a[LM.RIGHT_ANKLE]);
    expect(b[LM.RIGHT_ANKLE]).toEqual(a[LM.LEFT_ANKLE]);
  });

  it('hidden 관절은 신뢰도가 낮다', () => {
    const p = makePose({ ...READY_SPEC, hidden: [LM.LEFT_WRIST] });
    expect(p[LM.LEFT_WRIST]!.visibility).toBeLessThan(0.5);
    expect(p[LM.RIGHT_WRIST]!.visibility).toBeGreaterThan(0.5);
  });

  it('lerpSpec는 숫자 필드를 보간한다', () => {
    expect(lerpSpec(READY_SPEC, LUNGE_SPEC, 0.5).frontKneeDeg).toBeCloseTo(120);
  });
});
