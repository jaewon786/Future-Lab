import { describe, expect, it } from 'vitest';
import { ClockSession } from './clock-session';
import type { Message } from './protocol';

function setup() {
  const sent: Message[] = [];
  let now = 1000;
  const session = new ClockSession({ send: (m) => (sent.push(m), true) }, () => now);
  return { sent, session, advance: (ms: number) => (now += ms) };
}

describe('ClockSession', () => {
  it('ping은 순번과 보낸 시각을 담아 보낸다', () => {
    const { sent, session } = setup();
    session.ping();
    session.ping();
    expect(sent).toEqual([
      { type: 'ping', seq: 0, laptopSendMs: 1000 },
      { type: 'ping', seq: 1, laptopSendMs: 1000 },
    ]);
  });

  it('pong을 받으면 왕복 샘플을 남기고 시계 차이를 추정한다', () => {
    const { session, advance } = setup();
    session.ping();
    advance(20);
    // 폰 시계 = 노트북 + 5000, 왕복 20ms
    expect(session.handle({ type: 'pong', seq: 0, laptopSendMs: 1000, phoneTimeMs: 6010 })).toBe(true);
    expect(session.estimate()?.offsetMs).toBeCloseTo(5000);
    expect(session.rttsMs()).toEqual([20]);
  });

  it('보낸 시각은 폰이 돌려준 값 대신 기억한 값을 쓴다', () => {
    const { session, advance } = setup();
    session.ping();
    advance(20);
    session.handle({ type: 'pong', seq: 0, laptopSendMs: 0, phoneTimeMs: 6010 });
    expect(session.rttsMs()).toEqual([20]);
  });

  it('모르는 순번의 pong은 무시하고, pong이 아니면 false', () => {
    const { session } = setup();
    expect(session.handle({ type: 'pong', seq: 9, laptopSendMs: 0, phoneTimeMs: 1 })).toBe(true);
    expect(session.samples).toEqual([]);
    expect(session.handle({ type: 'ping', seq: 0, laptopSendMs: 0 })).toBe(false);
  });

  it('reset 후에는 이전 ping의 pong을 받지 않는다', () => {
    const { session } = setup();
    session.ping();
    session.reset();
    session.handle({ type: 'pong', seq: 0, laptopSendMs: 1000, phoneTimeMs: 6010 });
    expect(session.samples).toEqual([]);
  });

  it('폰 시각을 노트북 시각으로 바꾼다 (추정 전에는 null)', () => {
    const { session, advance } = setup();
    expect(session.toLaptopMs(6000)).toBeNull();
    session.ping();
    advance(20);
    session.handle({ type: 'pong', seq: 0, laptopSendMs: 1000, phoneTimeMs: 6010 });
    expect(session.toLaptopMs(6100)).toBeCloseTo(1100);
  });
});
