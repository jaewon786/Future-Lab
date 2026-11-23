// Task 7: 노트북 포즈 추정 속도 측정. G2 기준: 15fps 이상.
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { el, fmt, showAndCopyJson } from './common';
import { createPose, drawPose, openCamera, type Delegate } from '../pose/mediapipe';

const DURATION_MS = 30_000;
const WARMUP_MS = 2_000;

const video = el<HTMLVideoElement>('video');
const canvas = el<HTMLCanvasElement>('overlay');
const status = el('status');
const stats = el('stats');
const startBtn = el<HTMLButtonElement>('start');
const copyBtn = el<HTMLButtonElement>('copy');
const resolution = el<HTMLSelectElement>('resolution');
const delegateSel = el<HTMLSelectElement>('delegate');

let landmarker: PoseLandmarker | null = null;
let stream: MediaStream | null = null;
let result: Record<string, unknown> | null = null;

async function run(): Promise<void> {
  startBtn.disabled = true;
  copyBtn.disabled = true;
  stream?.getTracks().forEach((t) => t.stop());
  landmarker?.close();

  const [w, h] = resolution.value.split('x').map(Number) as [number, number];
  status.textContent = '카메라와 모델을 준비하는 중…';
  stream = await openCamera(video, w, h);
  const made = await createPose(delegateSel.value as Delegate);
  landmarker = made.landmarker;
  const pose = landmarker;

  let frames = 0;
  let inferTotalMs = 0;
  let lastVideoTime = -1;
  const t0 = performance.now();
  let measureStart = 0;
  status.textContent = `측정 중 (${made.delegate}${made.delegate !== delegateSel.value ? ', GPU 실패로 CPU 사용' : ''})`;

  const fail = (err: unknown) => {
    status.textContent = `측정 중 오류: ${err instanceof Error ? err.message : String(err)}`;
    startBtn.disabled = false;
  };
  const loop = () => {
    try {
      step();
    } catch (err) {
      fail(err);
    }
  };
  const step = () => {
    const now = performance.now();
    if (document.hidden) {
      status.textContent = '탭이 가려져 측정이 왜곡됨 — 이 탭을 앞에 두고 다시 측정하세요.';
    }
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const s = performance.now();
      const r = pose.detectForVideo(video, s);
      const infer = performance.now() - s;
      drawPose(canvas, video, r);
      if (now - t0 >= WARMUP_MS) {
        if (measureStart === 0) measureStart = now;
        frames++;
        inferTotalMs += infer;
      }
    }
    const measuredS = measureStart ? (now - measureStart) / 1000 : 0;
    const fps = measuredS > 0 ? frames / measuredS : Number.NaN;
    stats.textContent = `처리 ${fmt(fps)}fps (목표 15 이상) · 추론 평균 ${fmt(inferTotalMs / frames)}ms · ${fmt(measuredS, 0)}s / ${DURATION_MS / 1000}s`;

    if (measureStart && now - measureStart >= DURATION_MS) {
      result = {
        userAgent: navigator.userAgent,
        cameraRequested: resolution.value,
        cameraActual: `${video.videoWidth}x${video.videoHeight}`,
        delegateRequested: delegateSel.value,
        delegateUsed: made.delegate,
        fps: Number(fps.toFixed(2)),
        inferenceAvgMs: Number((inferTotalMs / frames).toFixed(2)),
        frames,
        durationS: DURATION_MS / 1000,
      };
      status.textContent = '측정 끝 — 결과를 복사해 docs/spike-report.md에 붙이세요.';
      startBtn.disabled = false;
      copyBtn.disabled = false;
      return;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', () => {
  run().catch((err: unknown) => {
    status.textContent = `실패: ${err instanceof Error ? err.message : String(err)}`;
    startBtn.disabled = false;
  });
});

copyBtn.addEventListener('click', async () => {
  const ok = await showAndCopyJson(result, el('result'));
  copyBtn.textContent = ok ? '복사됨' : '아래 내용을 직접 복사하세요';
});
