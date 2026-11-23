// MediaPipe 포즈 모델(pose_landmarker_lite)을 apps/laptop/public/models/ 에 받아 둔다.
// 이미 있으면 건너뛴다. WASM은 Vite가 패키지에서 직접 번들하므로 여기서 다루지 않는다.
// 사용법: node scripts/prepare-mediapipe.mjs   (pages.yml이 배포 전에 실행)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
const modelDst = join(root, 'apps', 'laptop', 'public', 'models', 'pose_landmarker_lite.task');

if (existsSync(modelDst)) {
  console.log(`모델 있음: ${modelDst}`);
} else {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`모델 다운로드 실패: HTTP ${res.status}`);
  mkdirSync(dirname(modelDst), { recursive: true });
  writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
  console.log(`모델 저장: ${modelDst}`);
}
