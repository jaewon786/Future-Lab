import { describe, expect, it } from 'vitest';
import { calibrate, type Calibration } from './calibration';
import { LM } from './landmarks';
import { DEFAULT_LUNGE_RULES, judgeLunge, measureLunge } from './lunge';
import { LUNGE_SPEC, READY_SPEC, makePose, type PoseSpec } from './test-utils/synthetic-pose';

const A = 4 / 3;

function calibrationFor(spec: PoseSpec = READY_SPEC): Calibration {
  const r = calibrate(
    Array.from({ length: 40 }, () => makePose(spec)),
    spec.swordSide,
    A,
  );
  if (!r.ok) throw new Error(r.errors.join(', '));
  return r.calibration;
}

const codes = (spec: PoseSpec, cal = calibrationFor()) =>
  judgeLunge(measureLunge(makePose(spec), cal)).errors.map((e) => e.code);

describe('measureLunge', () => {
  it('정상 런지의 각도와 보폭비를 잰다', () => {
    const f = measureLunge(makePose(LUNGE_SPEC), calibrationFor());
    expect(f.frontKneeDeg).toBeCloseTo(100, 0);
    expect(f.backKneeDeg).toBeCloseTo(170, 0);
    expect(f.torsoTiltDeg).toBeCloseTo(5, 0);
    expect(f.swordArmDeg).toBeCloseTo(175, 0);
    expect(f.kneePastToe).toBe(false);
    expect(f.stanceRatio).toBeGreaterThan(2.4);
  });

  it('MediaPipe가 다리 이름을 바꿔 붙여도 앞다리를 위치로 찾는다', () => {
    const cal = calibrationFor();
    expect(measureLunge(makePose({ ...LUNGE_SPEC, swapLegs: true }), cal)).toEqual(
      measureLunge(makePose(LUNGE_SPEC), cal),
    );
  });

  it('왼쪽을 보고 서도 같은 값을 잰다', () => {
    const left = { ...LUNGE_SPEC, facing: -1 as const };
    const f = measureLunge(makePose(left), calibrationFor({ ...READY_SPEC, facing: -1 }));
    expect(f.frontKneeDeg).toBeCloseTo(100, 0);
    expect(f.torsoTiltDeg).toBeCloseTo(5, 0);
  });

  it('왼손잡이는 왼쪽 관절의 팔을 칼 팔로 잰다', () => {
    const lefty = { ...LUNGE_SPEC, swordSide: 'left' as const };
    const f = measureLunge(makePose(lefty), calibrationFor({ ...READY_SPEC, swordSide: 'left' }));
    expect(f.swordArmDeg).toBeCloseTo(175, 0);
  });

  it('가려진 관절이 들어간 항목은 NaN/null (판정 보류)', () => {
    const f = measureLunge(makePose({ ...LUNGE_SPEC, hidden: [LM.RIGHT_KNEE] }), calibrationFor());
    expect(f.frontKneeDeg).toBeNaN();
    expect(f.kneePastToe).toBeNull();
    expect(f.backKneeDeg).toBeCloseTo(170, 0);
  });
});

describe('judgeLunge', () => {
  it('정상 런지는 오류 없음', () => {
    const r = judgeLunge(measureLunge(makePose(LUNGE_SPEC), calibrationFor()));
    expect(r).toEqual({ ok: true, errors: [], skipped: [] });
  });

  it.each([
    ['앞무릎을 덜 굽힘', { frontThighDeg: 60, frontKneeDeg: 135 }, 'front-knee-shallow'],
    ['앞무릎이 너무 깊음', { frontKneeDeg: 80 }, 'front-knee-deep'],
    ['무릎이 발끝을 넘음', { frontThighDeg: 60, frontKneeDeg: 95 }, 'knee-past-toe'],
    ['뒷다리가 굽음', { backKneeDeg: 140 }, 'back-leg-bent'],
    ['상체가 기울어짐', { torsoTiltDeg: 30 }, 'torso-tilt'],
    ['칼 팔을 덜 폄', { swordElbowDeg: 130 }, 'arm-bent'],
  ] as const)('%s → %s', (_name, change, code) => {
    expect(codes({ ...LUNGE_SPEC, ...change })).toContain(code);
  });

  it('오류마다 한국어 피드백 문구가 있다', () => {
    const r = judgeLunge(measureLunge(makePose({ ...LUNGE_SPEC, torsoTiltDeg: 30 }), calibrationFor()));
    expect(r.errors[0]?.message).toBe('상체를 세우세요');
  });

  it('가려진 항목은 오류 대신 판정 보류 목록에 들어간다', () => {
    const r = judgeLunge(measureLunge(makePose({ ...LUNGE_SPEC, hidden: [LM.RIGHT_KNEE] }), calibrationFor()));
    expect(r.skipped).toEqual(expect.arrayContaining(['front-knee', 'knee-toe']));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('규칙 값을 바꿀 수 있다', () => {
    const f = measureLunge(makePose(LUNGE_SPEC), calibrationFor());
    const strict = judgeLunge(f, { ...DEFAULT_LUNGE_RULES, torsoTiltMaxDeg: 3 });
    expect(strict.errors.map((e) => e.code)).toEqual(['torso-tilt']);
  });
});
