/** 폰 → 노트북 메시지 형식. 형식이 바뀌면 버전을 올린다. */
export const PROTOCOL_VERSION = 1;

/** 폰 DeviceMotion 샘플 1개. 시각은 폰 시계 기준(ms). */
export interface ImuSample {
  readonly type: 'imu';
  readonly phoneTimeMs: number;
  /** 중력을 뺀 가속도 (m/s²) */
  readonly accel: { readonly x: number; readonly y: number; readonly z: number };
  /** 회전 속도 (°/s) */
  readonly rotation: { readonly alpha: number; readonly beta: number; readonly gamma: number };
}
