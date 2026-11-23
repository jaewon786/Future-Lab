// 테스트 전용: 대결용 합성 기록 (포즈 15fps + IMU 60Hz). 실제 데이터 아님.
// 준비 자세 readyMs → 찌르기 cycles회. 찌르기마다 팔을 빠르게 펴며 런지하고, 팔이 다 펴지는 순간 폰 y축 가속도 펄스.
import type { ImuRecord, PoseFrame } from '../session';
import { LUNGE_SPEC, READY_SPEC, lerpSpec, makePose, type PoseSpec } from './synthetic-pose';

export const POSE_FRAME_MS = 1000 / 15;
const IMU_SAMPLE_MS = 1000 / 60;

export interface VersusSessionOptions {
  readonly readyMs?: number;
  readonly thrusts?: number;
  /** 찌르기 사이 준비 자세 유지 프레임 (득점 후 리셋 1.5초보다 길게) */
  readonly holdFrames?: number;
  readonly peakAccel?: number;
}

export interface SyntheticSession {
  readonly poseFrames: PoseFrame[];
  readonly imuSamples: ImuRecord[];
  /** 팔이 다 펴진(찌르기) 시각들 */
  readonly thrustTimes: number[];
}

export function makeVersusSession(opts: VersusSessionOptions = {}): SyntheticSession {
  const readyFrames = Math.round((opts.readyMs ?? 4000) / POSE_FRAME_MS);
  const holdFrames = opts.holdFrames ?? 25;
  const specs: PoseSpec[] = Array.from({ length: readyFrames }, () => READY_SPEC);
  const thrustFrames: number[] = [];

  for (let n = 0; n < (opts.thrusts ?? 5); n++) {
    for (let i = 0; i < holdFrames; i++) specs.push(READY_SPEC);
    for (let i = 1; i <= 4; i++) specs.push(lerpSpec(READY_SPEC, LUNGE_SPEC, i / 4));
    thrustFrames.push(specs.length - 1);
    for (let i = 0; i < 4; i++) specs.push(LUNGE_SPEC);
    for (let i = 3; i >= 0; i--) specs.push(lerpSpec(READY_SPEC, LUNGE_SPEC, i / 4));
  }

  const poseFrames = specs.map((spec, i) => ({ tMs: Math.round(i * POSE_FRAME_MS), landmarks: makePose(spec) }));
  const thrustTimes = thrustFrames.map((i) => Math.round(i * POSE_FRAME_MS));
  const endMs = poseFrames.at(-1)?.tMs ?? 0;
  const peak = opts.peakAccel ?? 25;

  const imuSamples: ImuRecord[] = [];
  for (let t = 0; t <= endMs; t += IMU_SAMPLE_MS) {
    const y = thrustTimes.reduce((sum, p) => sum + peak * Math.exp(-((t - p) ** 2) / (2 * 40 * 40)), 0);
    imuSamples.push({ tMs: Math.round(t), accel: { x: 0, y, z: 0 }, rotation: { alpha: 0, beta: 0, gamma: 0 } });
  }
  return { poseFrames, imuSamples, thrustTimes };
}
