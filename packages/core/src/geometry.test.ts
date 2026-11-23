import { describe, expect, it } from 'vitest';
import { distanceAspect, jointAngleAspectDeg, jointAngleDeg, toAspectSpace } from './geometry';

describe('jointAngleDeg', () => {
  it('직각이면 90°', () => {
    expect(jointAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });

  it('곧게 편 관절이면 180°', () => {
    expect(jointAngleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180);
  });

  it('완전히 접힌 관절이면 0°', () => {
    expect(jointAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 3, y: 0 })).toBeCloseTo(0);
  });

  it('돌아가는 방향과 무관하게 0~180° 범위', () => {
    const a = { x: 1, y: 1 };
    const b = { x: 0, y: 0 };
    const c = { x: 1, y: -1 };
    expect(jointAngleDeg(a, b, c)).toBeCloseTo(90);
    expect(jointAngleDeg(c, b, a)).toBeCloseTo(90);
  });

  it('런지 앞무릎 예시(엉덩이-무릎-발목)는 약 107°', () => {
    // 측면 카메라 화면 좌표(y 아래 방향)로 만든 예시
    const hip = { x: 0, y: 0 };
    const knee = { x: 0.5, y: 0.4 };
    const ankle = { x: 0.3, y: 0.9 };
    expect(jointAngleDeg(hip, knee, ankle)).toBeGreaterThan(100);
    expect(jointAngleDeg(hip, knee, ankle)).toBeLessThan(110);
  });

  it('두 점이 겹쳐 각도를 정할 수 없으면 NaN (판정 보류용)', () => {
    expect(jointAngleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNaN();
    expect(jointAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNaN();
  });
});

describe('화면비 보정 (toAspectSpace, jointAngleAspectDeg, distanceAspect)', () => {
  it('4:3 화면에서는 정규화 좌표의 직각이 실제로는 직각이 아니다', () => {
    const a = { x: 0.6, y: 0.6 };
    const b = { x: 0.5, y: 0.5 };
    const c = { x: 0.6, y: 0.4 };
    expect(jointAngleDeg(a, b, c)).toBeCloseTo(90);
    expect(jointAngleAspectDeg(a, b, c, 4 / 3)).toBeCloseTo(73.74, 1);
  });

  it('화면비 1이면 원래 각도와 같다', () => {
    const a = { x: 0.6, y: 0.6 };
    const b = { x: 0.5, y: 0.5 };
    const c = { x: 0.6, y: 0.4 };
    expect(jointAngleAspectDeg(a, b, c, 1)).toBeCloseTo(jointAngleDeg(a, b, c));
  });

  it('toAspectSpace는 x에만 화면비를 곱한다', () => {
    expect(toAspectSpace({ x: 0.3, y: 0.4 }, 2)).toEqual({ x: 0.6, y: 0.4 });
  });

  it('distanceAspect는 화면비 공간에서 거리를 잰다', () => {
    expect(distanceAspect({ x: 0, y: 0 }, { x: 0.3, y: 0.4 }, 4 / 3)).toBeCloseTo(Math.hypot(0.4, 0.4));
  });
});
