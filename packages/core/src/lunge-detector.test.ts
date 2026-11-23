import { describe, expect, it } from 'vitest';
import { calibrate, type Calibration } from './calibration';
import { LM } from './landmarks';
import { createLungeDetector, type LungeEvent } from './lunge-detector';
import type { Landmark } from './session';
import { LUNGE_SPEC, READY_SPEC, lerpSpec, makePose, type PoseSpec } from './test-utils/synthetic-pose';

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

/** 준비 → (peak까지) 내딛기 → 유지 → 복귀 한 번의 포즈 목록 */
function cycle(peak: PoseSpec = LUNGE_SPEC, reach = 1): PoseSpec[] {
  const out: PoseSpec[] = [];
  for (let i = 0; i < 8; i++) out.push(READY_SPEC);
  for (let i = 1; i <= 6; i++) out.push(lerpSpec(READY_SPEC, peak, (i / 6) * reach));
  for (let i = 0; i < 3; i++) out.push(lerpSpec(READY_SPEC, peak, reach));
  for (let i = 5; i >= 0; i--) out.push(lerpSpec(READY_SPEC, peak, (i / 6) * reach));
  return out;
}

function run(specs: PoseSpec[], extra?: (i: number, p: Landmark[]) => Landmark[]): LungeEvent[] {
  const detect = createLungeDetector(calibration());
  const events: LungeEvent[] = [];
  specs.forEach((spec, i) => {
    const pose = makePose(spec);
    const e = detect({ tMs: i * FRAME_MS, landmarks: extra ? extra(i, pose) : pose });
    if (e) events.push(e);
  });
  return events;
}

describe('createLungeDetector', () => {
  it('준비 → 런지 → 복귀 10회를 모두 한 번씩 감지한다', () => {
    const specs = Array.from({ length: 10 }, () => cycle()).flat();
    const events = run(specs);
    expect(events).toHaveLength(10);
    expect(events.every((e) => e.judgment.ok)).toBe(true);
  });

  it('정점에서 판정한 결과가 이벤트에 담긴다', () => {
    const events = run(cycle({ ...LUNGE_SPEC, torsoTiltDeg: 30 }));
    expect(events).toHaveLength(1);
    expect(events[0]!.judgment.errors.map((e) => e.code)).toContain('torso-tilt');
    expect(events[0]!.features.stanceRatio).toBeGreaterThan(2.4);
  });

  it('반쯤 내딛다 멈추면 감지하지 않는다', () => {
    expect(run(cycle(LUNGE_SPEC, 0.3))).toHaveLength(0);
  });

  it('정점 근처에서 조금 들어갔다 다시 나가도 한 번만 감지한다', () => {
    const specs = [
      ...cycle().slice(0, 17),
      lerpSpec(READY_SPEC, LUNGE_SPEC, 0.8),
      lerpSpec(READY_SPEC, LUNGE_SPEC, 0.8),
      LUNGE_SPEC,
      LUNGE_SPEC,
      ...cycle().slice(17),
    ];
    expect(run(specs)).toHaveLength(1);
  });

  it('발목이 안 보이는 프레임은 건너뛰고 계속 감지한다', () => {
    const specs = cycle();
    const events = run(specs, (i, p) =>
      i % 4 === 0 ? p.map((l, j) => (j === LM.LEFT_ANKLE ? { ...l, visibility: 0.1 } : l)) : p,
    );
    expect(events).toHaveLength(1);
  });
});
