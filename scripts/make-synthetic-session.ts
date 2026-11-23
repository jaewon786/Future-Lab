/**
 * 합성 세션 기록을 만든다 (실제 데이터 아님). E2E 재생 입력과 평가 스크립트 스모크 테스트에 쓴다.
 * 구성: 준비 자세 4초 → 런지 3회(정상, 상체 기울어짐, 정상), 각 런지 정점 직후 G/B 라벨.
 * 사용법: npm run make:fixture -- [출력 경로=e2e/fixtures/practice-replay.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SESSION_VERSION, validateSession, type LabelEvent, type PoseFrame } from '@fc/core';
import { LUNGE_SPEC, READY_SPEC, lerpSpec, makePose, type PoseSpec } from '../packages/core/src/test-utils/synthetic-pose';

const out = process.argv[2] ?? 'e2e/fixtures/practice-replay.json';
const FRAME_MS = 1000 / 15;

const poseFrames: PoseFrame[] = [];
const labels: LabelEvent[] = [];
let t = 0;
const push = (spec: PoseSpec) => {
  poseFrames.push({ tMs: Math.round(t), landmarks: makePose(spec) });
  t += FRAME_MS;
};

for (let i = 0; i < 60; i++) push(READY_SPEC); // 4초 준비 자세

const lunges: { peak: PoseSpec; good: boolean }[] = [
  { peak: LUNGE_SPEC, good: true },
  { peak: { ...LUNGE_SPEC, torsoTiltDeg: 30 }, good: false },
  { peak: LUNGE_SPEC, good: true },
];
for (const { peak, good } of lunges) {
  for (let i = 1; i <= 6; i++) push(lerpSpec(READY_SPEC, peak, i / 6));
  for (let i = 0; i < 3; i++) push(peak);
  labels.push({ tMs: Math.round(t), kind: good ? 'lunge-good' : 'lunge-bad' });
  for (let i = 5; i >= 0; i--) push(lerpSpec(READY_SPEC, peak, i / 6));
  for (let i = 0; i < 15; i++) push(READY_SPEC);
}

const session = {
  version: SESSION_VERSION,
  recordedAt: '2026-11-23T00:00:00.000Z',
  device: { laptop: 'synthetic', phone: 'none' },
  clockOffsetMs: 0,
  poseFrames,
  imuSamples: [],
  labels,
};
const check = validateSession(session);
if (!check.ok) {
  console.error(check.errors.join('\n'));
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(session));
console.log(`저장: ${out} (포즈 ${poseFrames.length}프레임, 런지 ${lunges.length}회, ${(t / 1000).toFixed(1)}초)`);
