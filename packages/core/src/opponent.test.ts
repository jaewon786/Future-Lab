import { describe, expect, it } from 'vitest';
import { createOpponent, type OpponentInput, type OpponentStep } from './opponent';

const TICK = 50;

/** 사용자 위치를 고정하고 durationMs 동안 상대를 돌린다 */
function simulate(opts: Parameters<typeof createOpponent>[0], input: Partial<OpponentInput>, durationMs: number) {
  const opp = createOpponent(opts);
  const steps: OpponentStep[] = [];
  for (let t = 0; t <= durationMs; t += TICK) {
    steps.push(opp.step({ nowMs: t, userXM: 0, userReachM: 1.5, ...input }));
  }
  return steps;
}

describe('createOpponent', () => {
  it('같은 시드면 같은 행동을 한다', () => {
    const a = simulate({ difficulty: 'normal', seed: 7, startXM: 3 }, {}, 5000);
    const b = simulate({ difficulty: 'normal', seed: 7, startXM: 3 }, {}, 5000);
    expect(a).toEqual(b);
  });

  it('멀리 있으면 다가오고, 너무 가까우면 물러난다', () => {
    const far = simulate({ difficulty: 'normal', seed: 1, startXM: 6 }, {}, 1000);
    expect(far.at(-1)!.state.xM).toBeLessThan(6);
    const near = simulate({ difficulty: 'normal', seed: 1, startXM: 0.8 }, {}, 1000);
    expect(near.at(-1)!.state.xM).toBeGreaterThan(0.8);
  });

  it('공격은 자기 도달 거리 안에서만 한다', () => {
    const steps = simulate({ difficulty: 'hard', seed: 3, startXM: 6 }, {}, 20_000);
    const attacks = steps.filter((s) => s.attack);
    expect(attacks.length).toBeGreaterThan(0);
    for (const s of attacks) expect(s.attack!.distanceM).toBeLessThanOrEqual(s.state.reachM + 1e-9);
  });

  it('사용자가 위협 거리에 들어오면 반응 지연 뒤에 막기를 할 수 있다 (난이도별 지연)', () => {
    const firstParry = (difficulty: 'easy' | 'hard') => {
      // parryChance 1로 확률 영향을 없애고 지연만 비교
      const steps = simulate({ difficulty, seed: 2, startXM: 1.6, parryChance: 1, attackRatePerS: 0 }, {}, 2000);
      return steps.find((s) => s.state.parrying)?.nowMs ?? Infinity;
    };
    expect(firstParry('hard')).toBeGreaterThanOrEqual(200);
    expect(firstParry('easy')).toBeGreaterThanOrEqual(400);
    expect(firstParry('hard')).toBeLessThan(firstParry('easy'));
  });

  it('막기는 일정 시간 뒤에 풀린다', () => {
    const steps = simulate({ difficulty: 'hard', seed: 2, startXM: 1.6, parryChance: 1, attackRatePerS: 0 }, {}, 3000);
    const start = steps.findIndex((s) => s.state.parrying);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(steps.slice(start).some((s) => !s.state.parrying)).toBe(true);
  });

  it('reset은 위치와 상태를 처음으로 되돌린다', () => {
    const opp = createOpponent({ difficulty: 'normal', seed: 1, startXM: 3 });
    for (let t = 0; t < 2000; t += TICK) opp.step({ nowMs: t, userXM: 0, userReachM: 1.5 });
    opp.reset(2000);
    expect(opp.step({ nowMs: 2000, userXM: 0, userReachM: 1.5 }).state.xM).toBeCloseTo(3, 1);
  });
});
