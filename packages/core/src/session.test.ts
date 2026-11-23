import { describe, expect, it } from 'vitest';
import { POSE_LANDMARK_COUNT, validateSession } from './session';

const landmarks = Array.from({ length: POSE_LANDMARK_COUNT }, (_, i) => ({ x: i / 40, y: 0.5, visibility: 0.9 }));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    recordedAt: '2026-11-23T05:00:00.000Z',
    device: { laptop: 'Chrome 140 / Windows', phone: 'Safari / iPhone' },
    clockOffsetMs: -12345.6,
    poseFrames: [
      { tMs: 0, landmarks },
      { tMs: 66, landmarks },
    ],
    imuSamples: [
      { tMs: 1, accel: { x: 0, y: 3, z: 0 }, rotation: { alpha: 0, beta: 0, gamma: 0 } },
      { tMs: 17, accel: { x: 0, y: 25, z: 0 }, rotation: { alpha: 1, beta: 2, gamma: 3 } },
    ],
    labels: [
      { tMs: 10, kind: 'clap' },
      { tMs: 40, kind: 'thrust' },
      { tMs: 60, kind: 'other' },
    ],
    ...overrides,
  };
}

describe('validateSession', () => {
  it('올바른 기록은 ok', () => {
    const r = validateSession(makeSession());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.session.labels).toHaveLength(3);
  });

  it('빈 배열도 허용한다 (짧은 테스트 기록)', () => {
    expect(validateSession(makeSession({ poseFrames: [], imuSamples: [], labels: [] })).ok).toBe(true);
  });

  it('객체가 아니면 실패', () => {
    expect(validateSession(null)).toEqual({ ok: false, errors: ['기록이 객체가 아님'] });
    expect(validateSession([]).ok).toBe(false);
  });

  it.each([
    ['버전이 다름', { version: 2 }, 'version'],
    ['recordedAt이 날짜가 아님', { recordedAt: 'yesterday' }, 'recordedAt'],
    ['device 누락', { device: undefined }, 'device'],
    ['device.phone이 문자열 아님', { device: { laptop: 'a', phone: 3 } }, 'device'],
    ['clockOffsetMs가 숫자 아님', { clockOffsetMs: 'x' }, 'clockOffsetMs'],
    ['poseFrames가 배열 아님', { poseFrames: {} }, 'poseFrames'],
    ['관절 수가 33개 아님', { poseFrames: [{ tMs: 0, landmarks: landmarks.slice(0, 10) }] }, 'poseFrames[0]'],
    [
      '관절 visibility 범위 밖',
      { poseFrames: [{ tMs: 0, landmarks: [{ x: 0, y: 0, visibility: 2 }, ...landmarks.slice(1)] }] },
      'poseFrames[0]',
    ],
    [
      'IMU 가속도 누락',
      { imuSamples: [{ tMs: 0, rotation: { alpha: 0, beta: 0, gamma: 0 } }] },
      'imuSamples[0]',
    ],
    ['라벨 종류가 잘못됨', { labels: [{ tMs: 0, kind: 'parry' }] }, 'labels[0]'],
    ['시각이 음수', { labels: [{ tMs: -5, kind: 'clap' }] }, 'labels[0]'],
    [
      '시각이 거꾸로 감',
      {
        labels: [
          { tMs: 50, kind: 'clap' },
          { tMs: 10, kind: 'thrust' },
        ],
      },
      'labels[1]',
    ],
  ])('%s → 실패하고 위치를 알려 준다', (_name, override, path) => {
    const r = validateSession(makeSession(override));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith(path))).toBe(true);
  });

  it('오류는 최대 20개까지만 모은다', () => {
    const bad = Array.from({ length: 50 }, () => ({ tMs: -1, kind: 'x' }));
    const r = validateSession(makeSession({ labels: bad }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(20);
  });
});
