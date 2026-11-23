import { describe, expect, it } from 'vitest';
import { calibrate, type Calibration } from './calibration';
import { LUNGE_SPEC, READY_SPEC, makePose, type PoseSpec } from './test-utils/synthetic-pose';
import { createWebcamThrustDetector, type WebcamThrustEvent } from './webcam-thrust';

const FRAME_MS = 1000 / 15;

function calibration(): Calibration {
  const r = calibrate(
    Array.from({ length: 40 }, () => makePose(READY_SPEC)),
    'right',
    4 / 3,
  );
  if (!r.ok) throw new Error(r.errors.join(', '));
  return r.calibration;
}

/** 칼 팔 팔꿈치 각도를 프레임마다 지정한 시퀀스 */
function run(elbows: number[], base: PoseSpec = READY_SPEC): WebcamThrustEvent[] {
  const detect = createWebcamThrustDetector(calibration());
  const events: WebcamThrustEvent[] = [];
  elbows.forEach((swordElbowDeg, i) => {
    const e = detect({ tMs: i * FRAME_MS, landmarks: makePose({ ...base, swordElbowDeg }) });
    if (e) events.push(e);
  });
  return events;
}

const hold = (deg: number, n: number) => Array.from({ length: n }, () => deg);
const ramp = (from: number, to: number, n: number) =>
  Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 1)) / n);

describe('createWebcamThrustDetector', () => {
  it('팔을 빠르게 펴면 찌르기로 감지한다', () => {
    const events = run([...hold(120, 5), ...ramp(120, 175, 4), ...hold(175, 5)]);
    expect(events).toHaveLength(1);
    expect(events[0]!.swordArmDeg).toBeGreaterThanOrEqual(160);
  });

  it('천천히 펴면 찌르기가 아니다', () => {
    expect(run([...hold(120, 5), ...ramp(120, 175, 30), ...hold(175, 5)])).toEqual([]);
  });

  it('팔을 다 펴지 않으면 찌르기가 아니다', () => {
    expect(run([...hold(100, 5), ...ramp(100, 150, 3), ...hold(150, 5)])).toEqual([]);
  });

  it('팔을 다시 굽혔다 펴야 다음 찌르기를 받는다', () => {
    const once = [...hold(120, 5), ...ramp(120, 175, 4), ...hold(175, 10)];
    const twice = [...once, ...ramp(175, 120, 4), ...hold(120, 5), ...ramp(120, 175, 4), ...hold(175, 3)];
    expect(run(once)).toHaveLength(1);
    expect(run(twice)).toHaveLength(2);
  });

  it('런지 자세에서도 감지한다', () => {
    const events = run([...hold(120, 5), ...ramp(120, 175, 4), ...hold(175, 5)], LUNGE_SPEC);
    expect(events).toHaveLength(1);
  });
});
