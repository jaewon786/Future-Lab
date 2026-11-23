import { describe, expect, it } from 'vitest';
import { estimateClockOffset, percentile, phoneToLaptopMs, type PingSample } from './clock-sync';

/** 테스트용 결정적 난수 (선형 합동 생성기) */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** 폰 시계 = 노트북 시계 + trueOffset 인 상황을 흉내 낸 ping 샘플 */
function simulate(trueOffsetMs: number, count: number, seed: number): PingSample[] {
  const rand = rng(seed);
  const out: PingSample[] = [];
  for (let i = 0; i < count; i++) {
    const send = 1000 + i * 100;
    const up = 5 + rand() * 40; // 노트북 → 폰 지연 5~45ms
    const down = 5 + rand() * 40; // 폰 → 노트북 지연 5~45ms
    out.push({ laptopSendMs: send, phoneTimeMs: send + up + trueOffsetMs, laptopRecvMs: send + up + down });
  }
  return out;
}

describe('estimateClockOffset', () => {
  it('지연이 대칭이면 시계 차이를 정확히 구한다', () => {
    const samples: PingSample[] = [
      { laptopSendMs: 100, phoneTimeMs: 5110, laptopRecvMs: 120 },
      { laptopSendMs: 200, phoneTimeMs: 5210, laptopRecvMs: 220 },
    ];
    const r = estimateClockOffset(samples);
    expect(r?.offsetMs).toBeCloseTo(5000);
    expect(r?.rttMs).toBeCloseTo(20);
  });

  it('지터가 있어도 왕복 시간이 짧은 샘플 위주로 5ms 이내 오차', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = estimateClockOffset(simulate(-123456, 40, seed));
      expect(r).not.toBeNull();
      expect(Math.abs((r?.offsetMs ?? 0) - -123456)).toBeLessThan(5);
    }
  });

  it('사용한 샘플 수는 유효 샘플의 하위 25% (최소 1개)', () => {
    expect(estimateClockOffset(simulate(0, 40, 9))?.usedSamples).toBe(10);
    expect(estimateClockOffset(simulate(0, 2, 9))?.usedSamples).toBe(1);
  });

  it('왕복 시간이 음수이거나 숫자가 아닌 샘플은 버린다', () => {
    const r = estimateClockOffset([
      { laptopSendMs: 100, phoneTimeMs: 0, laptopRecvMs: 50 },
      { laptopSendMs: Number.NaN, phoneTimeMs: 0, laptopRecvMs: 50 },
      { laptopSendMs: 100, phoneTimeMs: 1110, laptopRecvMs: 120 },
    ]);
    expect(r?.offsetMs).toBeCloseTo(1000);
    expect(r?.usedSamples).toBe(1);
  });

  it('유효 샘플이 없으면 null', () => {
    expect(estimateClockOffset([])).toBeNull();
    expect(estimateClockOffset([{ laptopSendMs: 10, phoneTimeMs: 0, laptopRecvMs: 5 }])).toBeNull();
  });
});

describe('phoneToLaptopMs', () => {
  it('폰 시각에서 시계 차이를 빼 노트북 시각으로 바꾼다', () => {
    expect(phoneToLaptopMs(6000, 5000)).toBe(1000);
  });
});

describe('percentile', () => {
  it('p50과 p95를 선형 보간으로 구한다', () => {
    const v = Array.from({ length: 101 }, (_, i) => i); // 0..100
    expect(percentile(v, 50)).toBeCloseTo(50);
    expect(percentile(v, 95)).toBeCloseTo(95);
    expect(percentile([10, 20], 50)).toBeCloseTo(15);
  });

  it('정렬되지 않은 입력도 처리하고 원본을 바꾸지 않는다', () => {
    const v = [30, 10, 20];
    expect(percentile(v, 0)).toBe(10);
    expect(percentile(v, 100)).toBe(30);
    expect(v).toEqual([30, 10, 20]);
  });

  it('빈 배열이면 NaN', () => {
    expect(percentile([], 50)).toBeNaN();
  });
});
