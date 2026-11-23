export type Side = 'user' | 'opponent';

export interface BoutOptions {
  readonly touchesToWin: number;
  readonly durationMs: number;
  /** 에페 동시 타격 창 */
  readonly doubleWindowMs: number;
  /** 득점 후 다시 시작하기까지 (찌르기를 받지 않고 시계도 멈춤) */
  readonly resetMs: number;
}

/** 5점 또는 3분, 동시 타격 40ms */
export const DEFAULT_BOUT: BoutOptions = { touchesToWin: 5, durationMs: 180_000, doubleWindowMs: 40, resetMs: 1500 };

export interface ThrustInput {
  readonly tMs: number;
  /** 찌르는 쪽에서 상대까지 거리 */
  readonly distanceM: number;
  /** 찌르는 쪽 도달 거리 */
  readonly reachM: number;
  /** 상대가 막았는지 */
  readonly blocked: boolean;
}

export type ThrustResult = 'hit' | 'miss' | 'blocked';

export interface BoutLogEntry {
  readonly side: Side;
  readonly tMs: number;
  readonly distanceM: number;
  readonly result: ThrustResult;
}

export type BoutEvent =
  | { readonly type: 'touch'; readonly who: Side | 'double'; readonly tMs: number }
  | { readonly type: 'resume'; readonly tMs: number }
  | { readonly type: 'end'; readonly winner: Side | 'draw'; readonly tMs: number };

export interface BoutState {
  readonly phase: 'fencing' | 'touch' | 'ended';
  readonly score: { readonly user: number; readonly opponent: number };
  /** 실제 경기 시간 (득점 후 멈춘 시간 제외) */
  readonly elapsedMs: number;
  readonly winner: Side | 'draw' | null;
  readonly log: readonly BoutLogEntry[];
}

export interface Bout {
  thrust(side: Side, input: ThrustInput): void;
  /** 시간을 진행하고 그 사이 일어난 일을 돌려준다 */
  tick(nowMs: number): BoutEvent[];
  state(): BoutState;
}

/**
 * 에페 1판 진행. 찌르기는 도달 거리 안이고 막히지 않으면 유효하며,
 * 첫 유효 찌르기 후 doubleWindowMs 안에 상대도 유효하면 동시 타격(둘 다 1점)이다.
 */
export function createBout(options: Partial<BoutOptions> = {}): Bout {
  const opts = { ...DEFAULT_BOUT, ...options };
  let phase: BoutState['phase'] = 'fencing';
  const score = { user: 0, opponent: 0 };
  let elapsedMs = 0;
  let lastTick: number | null = null;
  let touchUntil = 0;
  let winner: BoutState['winner'] = null;
  const log: BoutLogEntry[] = [];
  let pending: { side: Side; tMs: number }[] = [];

  const finish = (tMs: number): BoutEvent => {
    phase = 'ended';
    winner = score.user > score.opponent ? 'user' : score.opponent > score.user ? 'opponent' : 'draw';
    return { type: 'end', winner, tMs };
  };

  const resolve = (nowMs: number): BoutEvent[] => {
    if (pending.length === 0) return [];
    const first = pending.reduce((a, b) => (b.tMs < a.tMs ? b : a));
    const other = pending.find((p) => p.side !== first.side && Math.abs(p.tMs - first.tMs) <= opts.doubleWindowMs);
    if (!other && nowMs - first.tMs <= opts.doubleWindowMs) return [];

    pending = [];
    if (other) {
      score.user++;
      score.opponent++;
    } else score[first.side]++;
    const events: BoutEvent[] = [{ type: 'touch', who: other ? 'double' : first.side, tMs: first.tMs }];
    if (score.user >= opts.touchesToWin || score.opponent >= opts.touchesToWin) {
      events.push(finish(nowMs));
    } else {
      phase = 'touch';
      touchUntil = nowMs + opts.resetMs;
    }
    return events;
  };

  return {
    thrust(side, input) {
      if (phase !== 'fencing') return;
      const result: ThrustResult = input.blocked ? 'blocked' : input.distanceM <= input.reachM ? 'hit' : 'miss';
      log.push({ side, tMs: input.tMs, distanceM: input.distanceM, result });
      if (result === 'hit') pending.push({ side, tMs: input.tMs });
    },

    tick(nowMs) {
      if (phase === 'ended') return [];
      const events: BoutEvent[] = [];
      if (phase === 'fencing' && lastTick !== null) elapsedMs += Math.max(0, nowMs - lastTick);
      lastTick = nowMs;

      if (phase === 'touch' && nowMs >= touchUntil) {
        phase = 'fencing';
        events.push({ type: 'resume', tMs: nowMs });
      }
      if (phase === 'fencing') events.push(...resolve(nowMs));
      if (phase === 'fencing' && elapsedMs >= opts.durationMs) events.push(finish(nowMs));
      return events;
    },

    state() {
      return { phase, score: { ...score }, elapsedMs, winner, log: [...log] };
    },
  };
}
