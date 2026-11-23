/** 폰 ↔ 노트북 메시지 형식. 형식이 바뀌면 버전을 올린다. */
export const PROTOCOL_VERSION = 1;

/** 가속도 허용 범위 (m/s²). 사람 팔 동작은 이보다 훨씬 작다. */
export const MAX_ABS_ACCEL = 200;
/** 회전 속도 허용 범위 (°/s) */
export const MAX_ABS_ROTATION = 5000;

export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RotationRate {
  readonly alpha: number;
  readonly beta: number;
  readonly gamma: number;
}

/** 폰 → 노트북: DeviceMotion 샘플 1개. 시각은 폰 시계 기준(ms). */
export interface ImuSample {
  readonly type: 'imu';
  readonly phoneTimeMs: number;
  /** 중력을 뺀 가속도 (m/s²) */
  readonly accel: Vector3;
  /** 회전 속도 (°/s) */
  readonly rotation: RotationRate;
}

/** 노트북 → 폰: 시계 동기화용 ping */
export interface PingMessage {
  readonly type: 'ping';
  readonly seq: number;
  readonly laptopSendMs: number;
}

/** 폰 → 노트북: ping에 대한 응답. 받은 순간의 폰 시각을 담는다. */
export interface PongMessage {
  readonly type: 'pong';
  readonly seq: number;
  readonly laptopSendMs: number;
  readonly phoneTimeMs: number;
}

export type Message = ImuSample | PingMessage | PongMessage;

type Fields = Record<string, unknown>;

function isObject(v: unknown): v is Fields {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteIn(v: unknown, maxAbs: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= maxAbs;
}

function isTimeMs(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isSeq(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

function parseImu(m: Fields): ImuSample | null {
  const { accel, rotation } = m;
  if (!isTimeMs(m.phoneTimeMs) || !isObject(accel) || !isObject(rotation)) return null;
  if (
    !isFiniteIn(accel.x, MAX_ABS_ACCEL) ||
    !isFiniteIn(accel.y, MAX_ABS_ACCEL) ||
    !isFiniteIn(accel.z, MAX_ABS_ACCEL) ||
    !isFiniteIn(rotation.alpha, MAX_ABS_ROTATION) ||
    !isFiniteIn(rotation.beta, MAX_ABS_ROTATION) ||
    !isFiniteIn(rotation.gamma, MAX_ABS_ROTATION)
  ) {
    return null;
  }
  return {
    type: 'imu',
    phoneTimeMs: m.phoneTimeMs,
    accel: { x: accel.x, y: accel.y, z: accel.z },
    rotation: { alpha: rotation.alpha, beta: rotation.beta, gamma: rotation.gamma },
  };
}

/**
 * 데이터 채널로 받은 값을 검증한다. 상대 기기는 신뢰하지 않는 입력원이므로
 * 형식이나 범위가 맞지 않으면 예외 대신 null을 돌려주고, 호출 쪽은 그 메시지를 버린다.
 * 알 수 없는 필드는 결과에서 빠진다.
 */
export function parseMessage(raw: unknown): Message | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isObject(value)) return null;

  switch (value.type) {
    case 'imu':
      return parseImu(value);
    case 'ping':
      if (!isSeq(value.seq) || !isTimeMs(value.laptopSendMs)) return null;
      return { type: 'ping', seq: value.seq, laptopSendMs: value.laptopSendMs };
    case 'pong':
      if (!isSeq(value.seq) || !isTimeMs(value.laptopSendMs) || !isTimeMs(value.phoneTimeMs)) {
        return null;
      }
      return {
        type: 'pong',
        seq: value.seq,
        laptopSendMs: value.laptopSendMs,
        phoneTimeMs: value.phoneTimeMs,
      };
    default:
      return null;
  }
}
