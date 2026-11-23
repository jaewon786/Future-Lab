import { describe, expect, it } from 'vitest';
import { LM } from '@fc/core';
import { READY_SPEC, makePose } from '../../../../packages/core/src/test-utils/synthetic-pose';
import { SetupFlow } from './setup-flow';

const ready = () => makePose(READY_SPEC);

function feed(flow: SetupFlow, n: number, pose: () => ReturnType<typeof makePose> | null = ready) {
  let last = flow.handle(pose());
  for (let i = 1; i < n; i++) last = flow.handle(pose());
  return last;
}

describe('SetupFlow (위치 안내 → 보정)', () => {
  it('위치가 연속으로 좋으면 보정으로 넘어가고, 보정 프레임이 차면 준비 완료', () => {
    const flow = new SetupFlow('right', () => 4 / 3, { framingOkFrames: 5, calibrationFrames: 30 });
    expect(feed(flow, 4).stage).toBe('setup');
    expect(feed(flow, 1).stage).toBe('calibrate');
    const done = feed(flow, 30);
    expect(done.stage).toBe('ready');
    expect(done.calibration?.facing).toBe(1);
  });

  it('위치가 나쁘면 안내 문구를 주고 보정으로 넘어가지 않는다', () => {
    const flow = new SetupFlow('right', () => 4 / 3, { framingOkFrames: 3, calibrationFrames: 30 });
    const u = feed(flow, 10, () => makePose({ ...READY_SPEC, hidden: [LM.LEFT_WRIST] }));
    expect(u.stage).toBe('setup');
    expect(u.hints.join(' ')).toContain('보이게');
  });

  it('사람이 안 보이면 카메라 앞에 서라고 안내', () => {
    const flow = new SetupFlow('right', () => 4 / 3);
    expect(flow.handle(null).hints.join(' ')).toContain('카메라 앞');
  });

  it('위치가 좋다가 나빠지면 연속 카운트를 다시 센다', () => {
    const flow = new SetupFlow('right', () => 4 / 3, { framingOkFrames: 3, calibrationFrames: 30 });
    feed(flow, 2);
    flow.handle(null);
    expect(feed(flow, 2).stage).toBe('setup');
    expect(feed(flow, 1).stage).toBe('calibrate');
  });

  it('보정 중 움직이면 오류를 알리고 처음부터 다시 잰다', () => {
    const flow = new SetupFlow('right', () => 4 / 3, { framingOkFrames: 1, calibrationFrames: 30 });
    feed(flow, 1);
    let i = 0;
    const u = feed(flow, 30, () => makePose({ ...READY_SPEC, frontThighDeg: 35 + Math.sin(i++) * 25 }));
    expect(u.stage).toBe('calibrate');
    expect(u.calibrationError).toContain('유지');
    expect(u.progress).toBe(0);
  });
});
