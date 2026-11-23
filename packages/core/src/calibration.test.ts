import { describe, expect, it } from 'vitest';
import { calibrate } from './calibration';
import { LM } from './landmarks';
import type { Landmark } from './session';
import { READY_SPEC, makePose, type PoseSpec } from './test-utils/synthetic-pose';

const A = 4 / 3;

/** 준비 자세 n프레임. wobbleDeg만큼 앞 허벅지 각도가 프레임마다 흔들린다 */
function frames(spec: PoseSpec, n: number, wobbleDeg = 0): Landmark[][] {
  return Array.from({ length: n }, (_, i) =>
    makePose({ ...spec, frontThighDeg: spec.frontThighDeg + Math.sin(i) * wobbleDeg }),
  );
}

describe('calibrate', () => {
  it('오른쪽을 보는 준비 자세에서 방향·보폭·팔 길이·다리 길이를 구한다', () => {
    const r = calibrate(frames(READY_SPEC, 40), 'right', A);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.calibration.facing).toBe(1);
    expect(r.calibration.stanceWidth).toBeCloseTo(0.214, 2);
    expect(r.calibration.armLength).toBeCloseTo(0.28, 2);
    expect(r.calibration.legLength).toBeCloseTo(0.44, 2);
    expect(r.calibration.handedness).toBe('right');
    expect(r.calibration.aspect).toBeCloseTo(A);
  });

  it('왼쪽을 보면 facing −1', () => {
    const r = calibrate(frames({ ...READY_SPEC, facing: -1 }, 40), 'right', A);
    expect(r.ok && r.calibration.facing).toBe(-1);
  });

  it('조금 흔들리는 것은 괜찮다', () => {
    expect(calibrate(frames(READY_SPEC, 40, 1), 'right', A).ok).toBe(true);
  });

  it('보폭이 크게 바뀌면 자세를 유지하라고 안내', () => {
    const r = calibrate(frames(READY_SPEC, 40, 25), 'right', A);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('유지');
  });

  it('발목이 안 보여 쓸 수 있는 프레임이 부족하면 실패', () => {
    const r = calibrate(frames({ ...READY_SPEC, hidden: [LM.LEFT_ANKLE] }, 40), 'right', A);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('충분');
  });

  it('다리 이름이 바뀌어 붙어도 결과가 같다', () => {
    const a = calibrate(frames(READY_SPEC, 40), 'right', A);
    const b = calibrate(frames({ ...READY_SPEC, swapLegs: true }, 40), 'right', A);
    expect(b).toEqual(a);
  });
});
