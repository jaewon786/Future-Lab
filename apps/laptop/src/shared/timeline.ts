/**
 * 시각(tMs)이 있는 항목을 원래 간격대로 하나씩 내보낸다. 첫 항목은 바로 내보낸다.
 * 돌려주는 함수를 부르면 멈춘다. 포즈·IMU 재생이 같은 순간에 시작하면 서로 맞물린다.
 * 타이머 지연이 쌓이지 않도록 매번 "시작 후 경과 시간" 기준으로 다음 항목까지 기다린다
 * (16ms 간격 IMU 1,000개를 상대 간격으로 이으면 브라우저에서 수 초씩 밀린다).
 */
export function playTimeline<T extends { readonly tMs: number }>(
  items: readonly T[],
  onItem: (item: T) => void,
  onEnd?: () => void,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const startWall = Date.now();
  const t0 = items[0]?.tMs ?? 0;

  const play = (i: number) => {
    if (stopped) return;
    const item = items[i];
    if (!item) {
      onEnd?.();
      return;
    }
    onItem(item);
    const next = items[i + 1];
    const wait = next ? next.tMs - t0 - (Date.now() - startWall) : 0;
    timer = setTimeout(() => play(i + 1), Math.max(0, wait));
  };
  play(0);

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
  };
}
