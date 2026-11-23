import type { ImuRecord } from '@fc/core';

/** 폰 IMU 입력원. 샘플 시각(tMs)은 노트북 시계 기준으로 맞춰서 내보낸다. */
export interface ImuSource {
  start(onSample: (sample: ImuRecord) => void): Promise<void>;
  stop(): void;
}
