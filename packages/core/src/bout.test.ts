import { describe, expect, it } from 'vitest';
import { createBout } from './bout';

const inReach = { distanceM: 1.2, reachM: 1.5, blocked: false };

describe('createBout (에페 경기)', () => {
  it('도달 거리 안의 찌르기는 득점', () => {
    const bout = createBout();
    bout.thrust('user', { tMs: 1000, ...inReach });
    const events = bout.tick(1100);
    expect(events).toEqual([{ type: 'touch', who: 'user', tMs: 1000 }]);
    expect(bout.state().score).toEqual({ user: 1, opponent: 0 });
  });

  it('도달 거리 밖이면 빗나감, 막히면 무효 — 점수 없음, 기록은 남음', () => {
    const bout = createBout();
    bout.thrust('user', { tMs: 1000, distanceM: 2, reachM: 1.5, blocked: false });
    bout.thrust('user', { tMs: 2000, ...inReach, blocked: true });
    bout.tick(2500);
    expect(bout.state().score).toEqual({ user: 0, opponent: 0 });
    expect(bout.state().log.map((l) => l.result)).toEqual(['miss', 'blocked']);
  });

  it('40ms 안의 양쪽 득점은 동시 타격(둘 다 1점)', () => {
    const bout = createBout();
    bout.thrust('user', { tMs: 1000, ...inReach });
    bout.thrust('opponent', { tMs: 1039, ...inReach });
    expect(bout.tick(1100)).toEqual([{ type: 'touch', who: 'double', tMs: 1000 }]);
    expect(bout.state().score).toEqual({ user: 1, opponent: 1 });
  });

  it('41ms 뒤의 상대 찌르기는 이미 득점이 난 뒤라 무시', () => {
    const bout = createBout();
    bout.thrust('user', { tMs: 1000, ...inReach });
    bout.tick(1041);
    bout.thrust('opponent', { tMs: 1041, ...inReach });
    bout.tick(1200);
    expect(bout.state().score).toEqual({ user: 1, opponent: 0 });
  });

  it('득점 후 리셋 시간 동안은 찌르기를 받지 않고 시계도 멈춘다', () => {
    const bout = createBout({ resetMs: 1500 });
    bout.tick(0);
    bout.thrust('user', { tMs: 1000, ...inReach });
    bout.tick(1100);
    expect(bout.state().phase).toBe('touch');
    bout.thrust('opponent', { tMs: 1500, ...inReach });
    bout.tick(2000);
    expect(bout.state().score.opponent).toBe(0);
    expect(bout.tick(2700)).toEqual([{ type: 'resume', tMs: 2700 }]);
    expect(bout.state().phase).toBe('fencing');
    expect(bout.state().elapsedMs).toBeCloseTo(1100, -1);
  });

  it('5점을 먼저 내면 끝', () => {
    const bout = createBout({ resetMs: 0 });
    for (let i = 0; i < 5; i++) {
      bout.thrust('user', { tMs: i * 1000 + 10, ...inReach });
      bout.tick(i * 1000 + 100);
      bout.tick(i * 1000 + 200);
    }
    expect(bout.state().phase).toBe('ended');
    expect(bout.state().winner).toBe('user');
  });

  it('3분이 지나면 점수가 높은 쪽이 이기고, 같으면 무승부', () => {
    const win = createBout({ durationMs: 1000, resetMs: 0 });
    win.tick(0);
    win.thrust('opponent', { tMs: 100, ...inReach });
    win.tick(200);
    win.tick(300);
    expect(win.tick(1300)).toEqual([{ type: 'end', winner: 'opponent', tMs: 1300 }]);

    const draw = createBout({ durationMs: 1000 });
    draw.tick(0);
    draw.tick(1001);
    expect(draw.state().winner).toBe('draw');
  });
});
