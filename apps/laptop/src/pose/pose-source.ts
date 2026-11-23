import type { Landmark } from '@fc/core';

/** 포즈 입력 한 프레임. 사람이 안 보이면 landmarks는 null. */
export interface PoseSourceFrame {
  readonly tMs: number;
  readonly landmarks: readonly Landmark[] | null;
}

/** 카메라(MediaPipe)와 기록 재생을 같은 방식으로 다루기 위한 입력원 */
export interface PoseSource {
  /** 화면 너비 ÷ 높이 (start 이후 확정) */
  readonly aspect: number;
  start(onFrame: (frame: PoseSourceFrame) => void): Promise<void>;
  stop(): void;
}
