// Task 8: 웹캠 포즈 + 폰 IMU + 키보드 라벨을 SessionRecording 형식으로 기록한다.
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import {
  SESSION_VERSION,
  validateSession,
  type ImuRecord,
  type LabelEvent,
  type LabelKind,
  type PoseFrame,
} from '@fc/core';
import { phoneToLaptopMs, type ImuSample } from '@fc/link';
import { hostLink } from '@fc/link/peer';
import { ClockSync, el, phoneSensorUrl, showJoinQr } from './common';
import { createPose, drawPose, openCamera, toLandmarks } from '../pose/mediapipe';

const MIN_SYNC_SAMPLES = 20;
/** 60Hz 기준 약 55분. 상대 기기가 메시지를 쏟아내도 메모리가 넘치지 않게 막는다 */
const MAX_IMU_SAMPLES = 200_000;
/** 물리 키 위치로 판단한다 — 한글 입력 상태에서도 T/O/C 자리를 누르면 라벨이 남는다 */
const KEYS: Record<string, LabelKind> = {
  KeyT: 'thrust',
  KeyO: 'other',
  KeyC: 'clap',
  KeyG: 'lunge-good',
  KeyB: 'lunge-bad',
};

const video = el<HTMLVideoElement>('video');
const canvas = el<HTMLCanvasElement>('overlay');
const status = el('status');
const counts = el('counts');
const recordBtn = el<HTMLButtonElement>('record');
const saveBtn = el<HTMLButtonElement>('save');
const nameInput = el<HTMLInputElement>('name');
const phoneInput = el<HTMLInputElement>('phone');

const { id, link } = await hostLink().catch((err: unknown) => {
  status.textContent = `신호 서버 연결 실패: ${err instanceof Error ? err.message : String(err)} — 새로고침하세요.`;
  throw err;
});
await showJoinQr(el<HTMLCanvasElement>('qr'), el<HTMLAnchorElement>('url'), phoneSensorUrl(id));
const sync = new ClockSync(link);
let phoneLabel = '연결 안 됨';
link.onStatus((s) => {
  phoneLabel = s;
});
window.setInterval(() => sync.ping(), 200);

let recording = false;
let t0 = 0;
let poseFrames: PoseFrame[] = [];
let rawImu: ImuSample[] = [];
let labels: LabelEvent[] = [];
let lastLabel = '';

link.onMessage((msg) => {
  if (sync.handle(msg)) return;
  if (msg.type === 'imu' && recording && rawImu.length < MAX_IMU_SAMPLES) rawImu.push(msg);
});

window.addEventListener('keydown', (e) => {
  const kind = KEYS[e.code];
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  if (!recording || !kind || e.repeat || typing) return;
  labels.push({ tMs: performance.now() - t0, kind });
  lastLabel = `${kind} @ ${((performance.now() - t0) / 1000).toFixed(1)}s`;
});

function render(): void {
  const by = (k: LabelKind) => labels.filter((l) => l.kind === k).length;
  counts.textContent = [
    `폰: ${phoneLabel} · 시계 동기화 샘플 ${sync.samples.length}/${MIN_SYNC_SAMPLES}`,
    `${recording ? '● 기록 중' : '대기'} · 포즈 ${poseFrames.length} · IMU ${rawImu.length}${rawImu.length >= MAX_IMU_SAMPLES ? ' (상한 도달 — 멈추고 저장하세요)' : ''}`,
    `찌르기(T) ${by('thrust')} · 일반 동작(O) ${by('other')} · 박수(C) ${by('clap')} · 좋은 런지(G) ${by('lunge-good')} · 나쁜 런지(B) ${by('lunge-bad')}`,
    `마지막 라벨: ${lastLabel || '—'}`,
  ].join('\n');
  recordBtn.disabled = sync.samples.length < MIN_SYNC_SAMPLES && !recording;
}
window.setInterval(render, 250);

async function startCamera(): Promise<PoseLandmarker> {
  status.textContent = '카메라와 모델을 준비하는 중…';
  await openCamera(video, 640, 480);
  const { landmarker } = await createPose('GPU');
  status.textContent = '준비됨 — 폰을 연결하고 측면에서 전신이 보이게 서세요.';
  return landmarker;
}

const pose = await startCamera().catch((err: unknown) => {
  status.textContent = `카메라/모델 실패: ${err instanceof Error ? err.message : String(err)}`;
  return null;
});

if (pose) {
  let lastVideoTime = -1;
  const loop = () => {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const r = pose.detectForVideo(video, now);
      drawPose(canvas, video, r);
      const landmarks = recording ? toLandmarks(r) : null;
      if (landmarks) poseFrames.push({ tMs: now - t0, landmarks });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

recordBtn.addEventListener('click', () => {
  if (!recording) {
    poseFrames = [];
    rawImu = [];
    labels = [];
    lastLabel = '';
    t0 = performance.now();
    recording = true;
    recordBtn.textContent = '기록 멈춤';
    saveBtn.disabled = true;
    status.textContent = '기록 중: 시작 박수(C) → 찌르기(T)/일반 동작(O) → 끝 박수(C)';
  } else {
    recording = false;
    recordBtn.textContent = '기록 시작';
    saveBtn.disabled = false;
    status.textContent = '기록 멈춤 — 저장하세요.';
  }
});

saveBtn.addEventListener('click', () => {
  const est = sync.estimate();
  if (!est) {
    status.textContent = '시계 동기화 샘플이 없어 저장할 수 없음';
    return;
  }
  // 폰 시각은 기록 끝의 시계 차이 추정으로 한 번에 변환한다 (모든 ping을 쓸 수 있어 가장 정확)
  const imuSamples: ImuRecord[] = rawImu
    .map((s) => ({ tMs: phoneToLaptopMs(s.phoneTimeMs, est.offsetMs) - t0, accel: s.accel, rotation: s.rotation }))
    .filter((s) => s.tMs >= 0)
    .sort((a, b) => a.tMs - b.tMs);

  const session = {
    version: SESSION_VERSION,
    recordedAt: new Date().toISOString(),
    device: { laptop: navigator.userAgent, phone: phoneInput.value.trim() || 'unspecified' },
    clockOffsetMs: est.offsetMs,
    poseFrames,
    imuSamples,
    labels,
  };
  const check = validateSession(session);
  if (!check.ok) {
    status.textContent = `형식 오류로 저장 안 함: ${check.errors.slice(0, 3).join('; ')}`;
    return;
  }
  const name = (nameInput.value.trim() || 'anon').replace(/[^\p{L}\p{N}_]/gu, '');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
  const blob = new Blob([JSON.stringify(session)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${stamp}.json`;
  a.click();
  // 바로 해제하면 일부 브라우저에서 다운로드가 취소된다
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  status.textContent = `저장함: ${a.download} → fixtures/spike/ 로 옮기세요.`;
});
