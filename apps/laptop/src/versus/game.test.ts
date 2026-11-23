import { describe, expect, it } from 'vitest';
import { calibrate, type BoutEvent, type Calibration } from '@fc/core';
import { READY_SPEC, makePose } from '../../../../packages/core/src/test-utils/synthetic-pose';
import { makeVersusSession } from '../../../../packages/core/src/test-utils/synthetic-session';
import { createVersusGame, type VersusOptions } from './game';

function calibration(): Calibration {
  const r = calibrate(
    Array.from({ length: 40 }, () => makePose(READY_SPEC)),
    'right',
    4 / 3,
  );
  if (!r.ok) throw new Error(r.errors.join(', '));
  return r.calibration;
}

/** 합성 기록을 시간순으로 게임에 넣는다 (포즈와 IMU를 섞어서) */
function play(options: VersusOptions, thrusts = 5) {
  const session = makeVersusSession({ thrusts });
  const game = createVersusGame(calibration(), options);
  const events: BoutEvent[] = [];
  let imu = 0;
  for (const frame of session.poseFrames) {
    while (imu < session.imuSamples.length && session.imuSamples[imu]!.tMs <= frame.tMs) {
      game.onImu(session.imuSamples[imu++]!);
    }
    events.push(...game.onPose(frame).events);
  }
  return { game, events };
}

describe('createVersusGame', () => {
  it('웹캠 모드: 허수아비 상대에게 5번 찔러 5:0으로 이긴다', () => {
    const { game, events } = play({ mode: 'webcam', difficulty: 'normal', seed: 1, dummy: true });
    expect(game.state().score).toEqual({ user: 5, opponent: 0 });
    expect(game.state().winner).toBe('user');
    expect(events.filter((e) => e.type === 'touch')).toHaveLength(5);
  });

  it('폰 모드: IMU 찌르기를 칼 팔 각도로 확인해 같은 결과', () => {
    const { game } = play({ mode: 'phone', difficulty: 'normal', seed: 1, dummy: true });
    expect(game.state().score).toEqual({ user: 5, opponent: 0 });
  });

  it('폰 모드에서 IMU가 없으면 찌르기가 없다', () => {
    const session = makeVersusSession({ thrusts: 2 });
    const game = createVersusGame(calibration(), { mode: 'phone', difficulty: 'normal', seed: 1, dummy: true });
    for (const f of session.poseFrames) game.onPose(f);
    expect(game.state().log).toEqual([]);
  });

  it('상대가 도달 거리 밖이면 빗나감으로 기록되고 점수는 없다', () => {
    const { game } = play({ mode: 'webcam', difficulty: 'normal', seed: 1, dummy: true, dummyGapM: 3 }, 2);
    expect(game.state().score).toEqual({ user: 0, opponent: 0 });
    expect(game.state().log.map((l) => l.result)).toEqual(['miss', 'miss']);
  });

  it('화면용 상태: 런지 중에는 lunge·arm 값이 커진다', () => {
    const session = makeVersusSession({ thrusts: 1 });
    const game = createVersusGame(calibration(), { mode: 'webcam', difficulty: 'normal', seed: 1, dummy: true });
    const views = session.poseFrames.map((f) => game.onPose(f).view.user);
    expect(Math.max(...views.map((v) => v.lunge))).toBeGreaterThan(0.8);
    expect(Math.max(...views.map((v) => v.arm))).toBeGreaterThan(0.9);
    expect(views[0]!.lunge).toBeLessThan(0.1);
  });
});
