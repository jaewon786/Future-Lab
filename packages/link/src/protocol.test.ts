import { describe, expect, it } from 'vitest';
import { parseMessage } from './protocol';

const imu = {
  type: 'imu',
  phoneTimeMs: 1000,
  accel: { x: 0.1, y: 12.5, z: -0.3 },
  rotation: { alpha: 10, beta: -20, gamma: 5 },
};

describe('parseMessage', () => {
  it('정상 IMU 샘플을 그대로 돌려준다', () => {
    expect(parseMessage(imu)).toEqual(imu);
  });

  it('JSON 문자열도 받는다 (데이터 채널 수신 형태)', () => {
    expect(parseMessage(JSON.stringify(imu))).toEqual(imu);
  });

  it('ping과 pong을 받는다', () => {
    const ping = { type: 'ping', seq: 3, laptopSendMs: 500.5 };
    const pong = { type: 'pong', seq: 3, laptopSendMs: 500.5, phoneTimeMs: 12000 };
    expect(parseMessage(ping)).toEqual(ping);
    expect(parseMessage(pong)).toEqual(pong);
  });

  it('알 수 없는 필드는 버리고 필요한 필드만 남긴다', () => {
    expect(parseMessage({ ...imu, extra: 'x' })).toEqual(imu);
  });

  it.each([
    ['깨진 JSON', '{"type":'],
    ['null', null],
    ['숫자', 42],
    ['알 수 없는 type', { ...imu, type: 'hack' }],
    ['가속도 범위 초과', { ...imu, accel: { x: 0, y: 500, z: 0 } }],
    ['회전 범위 초과', { ...imu, rotation: { alpha: 0, beta: 9000, gamma: 0 } }],
    ['NaN 값', { ...imu, accel: { x: Number.NaN, y: 0, z: 0 } }],
    ['문자열 숫자', { ...imu, phoneTimeMs: '1000' }],
    ['음수 시각', { ...imu, phoneTimeMs: -1 }],
    ['accel 누락', { type: 'imu', phoneTimeMs: 1, rotation: imu.rotation }],
    ['seq가 정수 아님', { type: 'ping', seq: 1.5, laptopSendMs: 1 }],
    ['pong에 phoneTimeMs 없음', { type: 'pong', seq: 1, laptopSendMs: 1 }],
  ])('%s → null', (_name, raw) => {
    expect(parseMessage(raw)).toBeNull();
  });
});

describe('parseMessage — 시각 상한', () => {
  it('비정상적으로 큰 시각은 버린다', () => {
    expect(parseMessage({ ...imu, phoneTimeMs: 1e300 })).toBeNull();
    expect(parseMessage({ type: 'ping', seq: 1, laptopSendMs: 1e12 })).toBeNull();
  });
});
