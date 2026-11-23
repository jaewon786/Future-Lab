/**
 * 시각(tMs)이 있는 항목을 원래 간격대로 하나씩 내보낸다. 첫 항목은 바로 내보낸다.
 * 돌려주는 함수를 부르면 멈춘다. 포즈·IMU 재생이 같은 순간에 시작하면 서로 맞물린다.
 */
export function playTimeline<T extends { readonly tMs: number }>(
  items: readonly T[],
  onItem: (item: T) => void,
  onEnd?: () => void,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const play = (i: number) => {
    if (stopped) return;
    const item = items[i];
    if (!item) {
      onEnd?.();
      return;
    }
    onItem(item);
    const next = items[i + 1];
    timer = setTimeout(() => play(i + 1), next ? Math.max(0, next.tMs - item.tMs) : 0);
  };
  play(0);

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
  };
}
