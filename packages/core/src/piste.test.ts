import { describe, expect, it } from 'vitest';
import { calibrate, type Calibration } from './calibration';
import {
  BLADE_LENGTH_M,
  DEFAULT_LEG_LENGTH_M,
  PISTE_HALF_LENGTH_M,
  createPisteTracker,
  isOffPiste,
  legLengthFromHeight,
  reachMeters,
} from './piste';
import { READY_SPEC, makePose } from './test-utils/synthetic-pose';

function calibration(facing: 1 | -1 = 1): Calibration {
  const r = calibrate(
    Array.from({ length: 40 }, () => makePose({ ...READY_SPEC, facing })),
    'right',
    4 / 3,
  );
  if (!r.ok) throw new Error(r.errors.join(', '));
  return r.calibration;
}

describe('piste', () => {
  it('도달 거리 = 팔 길이(미터 환산) + 칼 길이 + 런지 전진', () => {
    const cal = calibration();
    // 합성 포즈: 다리 0.44, 팔 0.28 (화면 높이 단위) → 다리 0.9m 가정이면 팔 ≈ 0.573m
    expect(reachMeters(cal)).toBeCloseTo(0.9 * (0.28 / 0.44) + BLADE_LENGTH_M, 2);
    expect(reachMeters(cal, DEFAULT_LEG_LENGTH_M, 0.5)).toBeCloseTo(reachMeters(cal) + 0.5, 6);
  });

  it('키를 넣으면 다리 길이를 키 × 0.47로 쓴다', () => {
    expect(legLengthFromHeight(1.7)).toBeCloseTo(0.799, 3);
  });

  it('추적기는 첫 프레임을 시작 위치로 두고 앞쪽 이동을 미터로 바꾼다', () => {
    const cal = calibration();
    const track = createPisteTracker(cal, { startM: -2 });
    expect(track(makePose(READY_SPEC))).toBeCloseTo(-2);
    // 화면비 공간에서 0.22(다리 절반) 앞으로 → 0.45m
    expect(track(makePose({ ...READY_SPEC, hipX: READY_SPEC.hipX + 0.22 }))).toBeCloseTo(-2 + 0.45, 2);
  });

  it('왼쪽을 보고 서면 화면 왼쪽으로 가는 것이 앞쪽이다', () => {
    const cal = calibration(-1);
    const track = createPisteTracker(cal, { startM: 0 });
    track(makePose({ ...READY_SPEC, facing: -1 }));
    expect(track(makePose({ ...READY_SPEC, facing: -1, hipX: READY_SPEC.hipX - 0.22 }))).toBeGreaterThan(0.4);
  });

  it('엉덩이가 안 보이면 마지막 위치를 유지한다', () => {
    const cal = calibration();
    const track = createPisteTracker(cal, { startM: 1 });
    track(makePose(READY_SPEC));
    expect(track(makePose({ ...READY_SPEC, hidden: [23, 24] }))).toBeCloseTo(1);
  });

  it('피스트 끝(±7m)을 넘으면 밖', () => {
    expect(isOffPiste(6.9)).toBe(false);
    expect(isOffPiste(-7.1)).toBe(true);
    expect(PISTE_HALF_LENGTH_M).toBe(7);
  });
});
