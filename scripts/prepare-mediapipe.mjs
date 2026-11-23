// MediaPipe WASM 파일을 apps/laptop/public 으로 복사한다 (외부 CDN 의존 제거).
// --fetch-model 을 주면 포즈 모델(pose_landmarker_lite)이 없을 때 Google 공식 저장소에서 내려받는다.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'apps', 'laptop', 'public');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(pub, 'mediapipe', 'wasm');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
const modelDst = join(pub, 'models', 'pose_landmarker_lite.task');

mkdirSync(wasmDst, { recursive: true });
cpSync(wasmSrc, wasmDst, { recursive: true });
console.log(`WASM 복사: ${wasmDst}`);

if (process.argv.includes('--fetch-model')) {
  if (existsSync(modelDst)) {
    console.log(`모델 있음: ${modelDst}`);
  } else {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`모델 다운로드 실패: HTTP ${res.status}`);
    mkdirSync(dirname(modelDst), { recursive: true });
    writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
    console.log(`모델 저장: ${modelDst}`);
  }
} else if (!existsSync(modelDst)) {
  console.log('포즈 모델 없음 — 포즈 페이지를 쓰려면: node scripts/prepare-mediapipe.mjs --fetch-model');
}
