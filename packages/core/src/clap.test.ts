import { describe, expect, it } from 'vitest';
import { POSE_LANDMARK_COUNT, type ImuRecord, type Landmark, type PoseFrame } from './session';
import { DEFAULT_POSE_CLAP, LEFT_WRIST, RIGHT_WRIST, detectClapsImu, detectClapsPose, pairClapOffsets } from './clap';

function poseWithWristGap(tMs: number, gap: number, wristVisibility = 0.9): PoseFrame {
  const landmarks: Landmark[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  landmarks[LEFT_WRIST] = { x: 0.5 - gap / 2, y: 0.4, visibility: wristVisibility };
  landmarks[RIGHT_WRIST] = { x: 0.5 + gap / 2, y: 0.4, visibility: 0.9 };
  return { tMs, landmarks };
}

describe('detectClapsPose', () => {
  it('두 손목이 가장 가까워지는 순간을 박수로 본다', () => {
    const gaps = [0.4, 0.3, 0.1, 0.02, 0.1, 0.3, 0.4];
    const frames = gaps.map((g, i) => poseWithWristGap(i * 33, g));
    expect(detectClapsPose(frames)).toEqual([99]);
  });

  it('화면 비율을 반영해 거리를 잰다 (x는 너비, y는 높이 기준 정규화)', () => {
    // x 차이 0.04는 4:3 화면에서 실제로 0.04 × 4/3 ≈ 0.053 (높이 단위)이라 0.05 기준을 넘는다
    const frames = [0.4, 0.04, 0.4].map((g, i) => poseWithWristGap(i * 33, g));
    expect(detectClapsPose(frames, { ...DEFAULT_POSE_CLAP, aspectRatio: 4 / 3 })).toEqual([]);
    expect(detectClapsPose(frames, { ...DEFAULT_POSE_CLAP, aspectRatio: 1 })).toEqual([33]);
  });

  it('손목 신뢰도가 낮은 프레임은 건너뛴다', () => {
    const frames = [
      poseWithWristGap(0, 0.4),
      poseWithWristGap(33, 0.02, 0.1),
      poseWithWristGap(66, 0.4),
    ];
    expect(detectClapsPose(frames)).toEqual([]);
  });
});

describe('detectClapsImu', () => {
  it('가속도 크기 스파이크를 박수로 본다', () => {
    const samples: ImuRecord[] = [0, 2, 45, 3, 0].map((m, i) => ({
      tMs: i * 16,
      accel: { x: m * 0.6, y: m * 0.8, z: 0 },
      rotation: { alpha: 0, beta: 0, gamma: 0 },
    }));
    expect(detectClapsImu(samples)).toEqual([32]);
  });
});

describe('pairClapOffsets', () => {
  it('가장 가까운 짝끼리 IMU − 영상 시각 차이를 돌려준다', () => {
    expect(pairClapOffsets([1000, 5000], [1040, 4980])).toEqual([40, -20]);
  });

  it('최대 거리보다 먼 짝은 버린다', () => {
    expect(pairClapOffsets([1000, 5000], [1040, 9000], 500)).toEqual([40]);
  });

  it('IMU 박수 하나를 두 번 쓰지 않는다', () => {
    expect(pairClapOffsets([1000, 1100], [1050])).toEqual([50]);
  });
});
