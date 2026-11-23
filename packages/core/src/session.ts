/** 세션 기록 형식 버전. 형식이 바뀌면 올리고 변환기를 둔다. */
export const SESSION_VERSION = 1;
/** MediaPipe Pose 관절 수 */
export const POSE_LANDMARK_COUNT = 33;
const MAX_ERRORS = 20;

export interface Landmark {
  /** 화면 너비 기준 정규화 좌표 (0~1 근처, 화면 밖이면 범위를 벗어날 수 있음) */
  readonly x: number;
  readonly y: number;
  /** 관절 신뢰도 0~1 */
  readonly visibility: number;
}

export interface PoseFrame {
  readonly tMs: number;
  readonly landmarks: readonly Landmark[];
}

export interface ImuRecord {
  readonly tMs: number;
  readonly accel: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotation: { readonly alpha: number; readonly beta: number; readonly gamma: number };
}

export const LABEL_KINDS = ['thrust', 'other', 'clap'] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

export interface LabelEvent {
  readonly tMs: number;
  readonly kind: LabelKind;
}

/**
 * 웹캠 포즈 + 폰 IMU + 사람이 누른 라벨을 한 번에 담는 기록.
 * 모든 tMs는 기록 시작 기준 노트북 시계(ms)이며, 폰 시각은 clockOffsetMs로 이미 변환돼 있다.
 * 영상은 담지 않는다.
 */
export interface SessionRecording {
  readonly version: typeof SESSION_VERSION;
  readonly recordedAt: string;
  readonly device: { readonly laptop: string; readonly phone: string };
  /** 기록에 쓴 폰 시계 − 노트북 시계 (ms) */
  readonly clockOffsetMs: number;
  readonly poseFrames: readonly PoseFrame[];
  readonly imuSamples: readonly ImuRecord[];
  readonly labels: readonly LabelEvent[];
}

export type SessionValidation =
  | { readonly ok: true; readonly session: SessionRecording }
  | { readonly ok: false; readonly errors: readonly string[] };

type Fields = Record<string, unknown>;

const isObject = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validLandmark(l: unknown): boolean {
  return (
    isObject(l) && isNum(l.x) && isNum(l.y) && isNum(l.visibility) && l.visibility >= 0 && l.visibility <= 1
  );
}

function validImu(s: Fields): boolean {
  const { accel: a, rotation: r } = s;
  return (
    isObject(a) && isNum(a.x) && isNum(a.y) && isNum(a.z) && isObject(r) && isNum(r.alpha) && isNum(r.beta) && isNum(r.gamma)
  );
}

/**
 * 파일에서 읽은 기록을 검증한다. 파일은 신뢰하지 않는 입력이므로 예외 대신
 * 오류 목록(최대 20개, "경로: 내용" 형식)을 돌려준다.
 */
export function validateSession(raw: unknown): SessionValidation {
  if (!isObject(raw)) return { ok: false, errors: ['기록이 객체가 아님'] };
  const errors: string[] = [];
  const add = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg);
  };

  if (raw.version !== SESSION_VERSION) add(`version: ${SESSION_VERSION}이어야 함`);
  if (typeof raw.recordedAt !== 'string' || Number.isNaN(Date.parse(raw.recordedAt))) {
    add('recordedAt: ISO 날짜 문자열이어야 함');
  }
  const dev = raw.device;
  if (!isObject(dev) || typeof dev.laptop !== 'string' || typeof dev.phone !== 'string') {
    add('device: laptop, phone 문자열이 필요함');
  }
  if (!isNum(raw.clockOffsetMs)) add('clockOffsetMs: 숫자여야 함');

  checkTimeline(raw.poseFrames, 'poseFrames', add, (f) =>
    Array.isArray(f.landmarks) && f.landmarks.length === POSE_LANDMARK_COUNT && f.landmarks.every(validLandmark)
      ? null
      : `관절 ${POSE_LANDMARK_COUNT}개(x, y, visibility 0~1)가 필요함`,
  );
  checkTimeline(raw.imuSamples, 'imuSamples', add, (s) =>
    validImu(s) ? null : 'accel{x,y,z}, rotation{alpha,beta,gamma} 숫자가 필요함',
  );
  checkTimeline(raw.labels, 'labels', add, (l) =>
    (LABEL_KINDS as readonly unknown[]).includes(l.kind) ? null : `kind는 ${LABEL_KINDS.join('/')} 중 하나여야 함`,
  );

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, session: raw as unknown as SessionRecording };
}

/** 배열이고, 각 항목의 tMs가 0 이상이며 줄어들지 않고, 항목별 검사를 통과하는지 본다. */
function checkTimeline(
  value: unknown,
  name: string,
  add: (msg: string) => void,
  checkItem: (item: Fields) => string | null,
): void {
  if (!Array.isArray(value)) {
    add(`${name}: 배열이어야 함`);
    return;
  }
  let prev = 0;
  value.forEach((item: unknown, i) => {
    const path = `${name}[${i}]`;
    if (!isObject(item)) {
      add(`${path}: 객체여야 함`);
      return;
    }
    if (!isNum(item.tMs) || item.tMs < 0) {
      add(`${path}: tMs는 0 이상의 숫자여야 함`);
    } else if (item.tMs < prev) {
      add(`${path}: tMs가 이전 항목보다 작음`);
    } else {
      prev = item.tMs;
    }
    const problem = checkItem(item);
    if (problem) add(`${path}: ${problem}`);
  });
}
