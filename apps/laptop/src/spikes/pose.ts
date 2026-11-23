import { DrawingUtils, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { POSE_LANDMARK_COUNT, type Landmark } from '@fc/core';

export type Delegate = 'GPU' | 'CPU';

/**
 * 포즈 추정기를 만든다. WASM은 Vite가 빌드 결과에 함께 넣고, 모델은 같은 사이트의
 * models/ 에서 읽는다(scripts/prepare-mediapipe.mjs). 외부 CDN을 쓰지 않는다.
 * GPU 위임이 실패하면 CPU로 다시 시도하고, 실제로 쓴 위임 방식을 돌려준다.
 */
export async function createPose(delegate: Delegate): Promise<{ landmarker: PoseLandmarker; delegate: Delegate }> {
  const base = import.meta.env.BASE_URL;
  const vision = { wasmLoaderPath, wasmBinaryPath };
  const make = (d: Delegate) =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: `${base}models/pose_landmarker_lite.task`, delegate: d },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  try {
    return { landmarker: await make(delegate), delegate };
  } catch (err) {
    if (delegate === 'GPU') return { landmarker: await make('CPU'), delegate: 'CPU' };
    throw err;
  }
}

export async function openCamera(video: HTMLVideoElement, width: number, height: number): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: width }, height: { ideal: height } },
    audio: false,
  });
  video.srcObject = stream;
  try {
    await video.play();
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    throw err;
  }
  return stream;
}

/** 첫 번째 사람의 관절을 세션 기록 형식으로 바꾼다. 사람이 없으면 null. */
export function toLandmarks(result: PoseLandmarkerResult): Landmark[] | null {
  const first = result.landmarks[0];
  if (!first || first.length !== POSE_LANDMARK_COUNT) return null;
  return first.map((l) => ({ x: l.x, y: l.y, visibility: Math.min(1, Math.max(0, l.visibility ?? 0)) }));
}

export function drawPose(canvas: HTMLCanvasElement, video: HTMLVideoElement, result: PoseLandmarkerResult): void {
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const draw = new DrawingUtils(ctx);
  for (const lm of result.landmarks) {
    draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: '#3b82f6', lineWidth: 3 });
    draw.drawLandmarks(lm, { color: '#ef4444', radius: 3 });
  }
}
