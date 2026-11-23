import type { ImuRecord } from '@fc/core';
import { playTimeline } from '../shared/timeline';
import type { ImuSource } from './imu-source';

/** 세션 기록의 IMU 샘플을 원래 간격대로 재생한다 (E2E·시연용). */
export class ReplayImuSource implements ImuSource {
  private readonly samples: readonly ImuRecord[];
  private stopFn: (() => void) | null = null;

  constructor(samples: readonly ImuRecord[]) {
    this.samples = samples;
  }

  async start(onSample: (sample: ImuRecord) => void): Promise<void> {
    this.stopFn = playTimeline(this.samples, onSample);
  }

  stop(): void {
    this.stopFn?.();
    this.stopFn = null;
  }
}
