export interface Peak {
  readonly index: number;
  readonly tMs: number;
  readonly value: number;
}

export interface PeakOptions {
  /** max 모드: 이 값 이상인 극대점만. min 모드: 이 값 이하인 극소점만. */
  readonly threshold: number;
  /** 이보다 가까운 피크끼리는 더 극단적인 하나만 남긴다 (ms) */
  readonly minIntervalMs: number;
  readonly mode?: 'max' | 'min';
}

/**
 * 시계열에서 임계값을 넘는 극점을 찾는다. 양 끝 값, NaN, NaN 옆 값은 극점으로 보지 않는다.
 * 평평한 꼭대기는 첫 지점 하나로 센다. times와 values 길이가 다르면 짧은 쪽에 맞춘다.
 */
export function findPeaks(
  times: readonly number[],
  values: readonly number[],
  { threshold, minIntervalMs, mode = 'max' }: PeakOptions,
): Peak[] {
  const sign = mode === 'max' ? 1 : -1;
  const n = Math.min(times.length, values.length);
  const candidates: Peak[] = [];

  for (let i = 1; i < n - 1; i++) {
    const v = (values[i] as number) * sign;
    const prev = (values[i - 1] as number) * sign;
    const next = (values[i + 1] as number) * sign;
    if (!Number.isFinite(v) || !Number.isFinite(prev) || !Number.isFinite(next)) continue;
    if (v >= threshold * sign && v > prev && v >= next) {
      candidates.push({ index: i, tMs: times[i] as number, value: values[i] as number });
    }
  }
  return thinByInterval(candidates, minIntervalMs, mode);
}

/**
 * 시간순 피크 목록에서 minIntervalMs 안에 붙은 것들은 더 극단적인 하나만 남긴다.
 * 입력은 시간순이어야 한다.
 */
export function thinByInterval<T extends { readonly tMs: number; readonly value: number }>(
  peaks: readonly T[],
  minIntervalMs: number,
  mode: 'max' | 'min' = 'max',
): T[] {
  const sign = mode === 'max' ? 1 : -1;
  const kept: T[] = [];
  for (const p of peaks) {
    const last = kept[kept.length - 1];
    if (last && p.tMs - last.tMs < minIntervalMs) {
      if (p.value * sign > last.value * sign) kept[kept.length - 1] = p;
    } else {
      kept.push(p);
    }
  }
  return kept;
}
