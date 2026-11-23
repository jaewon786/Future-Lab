import { describe, expect, it } from 'vitest';
import type { ImuRecord, LabelEvent } from './session';
import { DEFAULT_THRUST_PARAMS, detectThrusts, evaluateThrusts, thresholdFromCalibration } from './thrust';

interface Pulse {
  readonly tMs: number;
  readonly peak: number;
  readonly rotation?: number;
  readonly axis?: 'x' | 'y';
}

/** 60Hz 샘플을 만들고, 지정한 시각에 가속도 펄스(폭 약 100ms)와 회전을 넣는다 */
function signal(pulses: readonly Pulse[], durationMs = 3000): ImuRecord[] {
  const out: ImuRecord[] = [];
  for (let tMs = 0; tMs <= durationMs; tMs += 1000 / 60) {
    let x = 0;
    let y = 0;
    let rot = 0;
    for (const p of pulses) {
      const d = tMs - p.tMs;
      const shape = Math.exp(-(d * d) / (2 * 40 * 40));
      if (p.axis === 'x') x += p.peak * shape;
      else y += p.peak * shape;
      if (Math.abs(d) < 150) rot = Math.max(rot, p.rotation ?? 0);
    }
    out.push({ tMs, accel: { x, y, z: 0 }, rotation: { alpha: rot, beta: 0, gamma: 0 } });
  }
  return out;
}

const params = { ...DEFAULT_THRUST_PARAMS, accelThreshold: 10 };

describe('detectThrusts', () => {
  it('y축 가속도 펄스를 찌르기로 감지한다', () => {
    const d = detectThrusts(signal([{ tMs: 1000, peak: 20 }]), params);
    expect(d).toHaveLength(1);
    expect(d[0]?.tMs).toBeGreaterThan(980);
    expect(d[0]?.tMs).toBeLessThan(1020);
    expect(d[0]?.peakAccel).toBeGreaterThan(19);
  });

  it('임계값보다 약한 움직임은 무시한다', () => {
    expect(detectThrusts(signal([{ tMs: 1000, peak: 6 }]), params)).toEqual([]);
  });

  it('다른 축 움직임은 무시한다', () => {
    expect(detectThrusts(signal([{ tMs: 1000, peak: 30, axis: 'x' }]), params)).toEqual([]);
  });

  it('회전이 큰 움직임은 휘두르기로 보고 거부한다', () => {
    expect(detectThrusts(signal([{ tMs: 1000, peak: 25, rotation: 400 }]), params)).toEqual([]);
  });

  it('디바운스 안의 두 번째 피크는 버린다', () => {
    const d = detectThrusts(
      signal([
        { tMs: 1000, peak: 20 },
        { tMs: 1300, peak: 15 },
      ]),
      params,
    );
    expect(d).toHaveLength(1);
  });

  it('충분히 떨어진 두 번의 찌르기는 둘 다 감지한다', () => {
    const d = detectThrusts(
      signal([
        { tMs: 800, peak: 20 },
        { tMs: 2000, peak: 18 },
      ]),
      params,
    );
    expect(d).toHaveLength(2);
  });

  it('direction -1이면 음의 y 방향을 찌르기로 본다', () => {
    const d = detectThrusts(signal([{ tMs: 1000, peak: -20 }]), { ...params, direction: -1 });
    expect(d).toHaveLength(1);
    expect(d[0]?.peakAccel).toBeGreaterThan(19);
  });
});

describe('thresholdFromCalibration', () => {
  it('보정 찌르기 최대값 중앙값의 비율', () => {
    expect(thresholdFromCalibration([20, 30, 25], 0.6)).toBeCloseTo(15);
  });

  it('보정 값이 없으면 기본 임계값', () => {
    expect(thresholdFromCalibration([])).toBe(DEFAULT_THRUST_PARAMS.accelThreshold);
  });
});

describe('evaluateThrusts', () => {
  const labels: LabelEvent[] = [
    { tMs: 1000, kind: 'thrust' },
    { tMs: 2000, kind: 'thrust' },
    { tMs: 3000, kind: 'other' },
    { tMs: 4000, kind: 'other' },
    { tMs: 4500, kind: 'clap' },
  ];

  it('허용 오차 안의 감지를 정답으로 센다', () => {
    const r = evaluateThrusts([{ tMs: 1100 }, { tMs: 1900 }], labels, 300);
    expect(r).toMatchObject({ thrustLabels: 2, otherLabels: 2, truePositives: 2, falsePositives: 0 });
    expect(r.recall).toBe(1);
    expect(r.falsePositiveRate).toBe(0);
  });

  it('놓친 찌르기와 잘못 감지한 동작을 센다', () => {
    const r = evaluateThrusts([{ tMs: 1000 }, { tMs: 3050 }, { tMs: 5000 }], labels, 300);
    expect(r.truePositives).toBe(1);
    expect(r.falsePositives).toBe(2);
    expect(r.recall).toBe(0.5);
    expect(r.falsePositiveRate).toBe(1);
  });

  it('라벨 하나에 감지 두 개가 붙으면 하나만 정답, 나머지는 오탐', () => {
    const r = evaluateThrusts([{ tMs: 950 }, { tMs: 1050 }], labels, 300);
    expect(r.truePositives).toBe(1);
    expect(r.falsePositives).toBe(1);
  });

  it('라벨이 없으면 비율은 NaN', () => {
    const r = evaluateThrusts([], [], 300);
    expect(r.recall).toBeNaN();
    expect(r.falsePositiveRate).toBeNaN();
  });
});
