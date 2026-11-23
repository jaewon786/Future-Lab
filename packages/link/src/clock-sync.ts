/** ping 1회의 시각 기록. laptop*은 노트북 시계, phoneTimeMs는 폰 시계 기준(ms). */
export interface PingSample {
  readonly laptopSendMs: number;
  readonly phoneTimeMs: number;
  readonly laptopRecvMs: number;
}

export interface ClockOffsetEstimate {
  /** 폰 시계 − 노트북 시계 (ms) */
  readonly offsetMs: number;
  /** 유효 샘플 전체의 왕복 시간 중앙값 (ms) */
  readonly rttMs: number;
  /** 추정에 쓴 샘플 수 (왕복 시간 하위 25%, 최소 1개) */
  readonly usedSamples: number;
}

/**
 * 여러 번의 ping으로 두 기기의 시계 차이를 추정한다 (NTP 방식).
 * 왕복 시간이 짧은 샘플일수록 위·아래 지연 차이가 작아 오차가 작으므로
 * 하위 25% 샘플의 중앙값을 쓴다. 유효 샘플이 없으면 null.
 */
export function estimateClockOffset(samples: readonly PingSample[]): ClockOffsetEstimate | null {
  const valid = samples
    .filter(
      (s) =>
        Number.isFinite(s.laptopSendMs) &&
        Number.isFinite(s.phoneTimeMs) &&
        Number.isFinite(s.laptopRecvMs) &&
        s.laptopRecvMs >= s.laptopSendMs,
    )
    .map((s) => {
      const rtt = s.laptopRecvMs - s.laptopSendMs;
      return { rtt, offset: s.phoneTimeMs - (s.laptopSendMs + rtt / 2) };
    });
  if (valid.length === 0) return null;

  const byRtt = [...valid].sort((a, b) => a.rtt - b.rtt);
  const used = byRtt.slice(0, Math.max(1, Math.floor(valid.length * 0.25)));

  return {
    offsetMs: percentile(
      used.map((u) => u.offset),
      50,
    ),
    rttMs: percentile(
      valid.map((v) => v.rtt),
      50,
    ),
    usedSamples: used.length,
  };
}

/** 폰 시각을 노트북 시각으로 바꾼다. offsetMs는 estimateClockOffset의 결과. */
export function phoneToLaptopMs(phoneTimeMs: number, offsetMs: number): number {
  return phoneTimeMs - offsetMs;
}

/** p번째 백분위수 (0~100, 선형 보간). 빈 배열이면 NaN. 입력은 바꾸지 않는다. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const loVal = sorted[lo] as number;
  const hiVal = sorted[hi] as number;
  return loVal + (hiVal - loVal) * (idx - lo);
}
