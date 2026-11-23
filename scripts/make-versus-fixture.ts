/**
 * 대결 E2E용 합성 기록 (실제 데이터 아님): 준비 자세 4초 → 찌르기 5회 (팔 뻗기 + 런지 + 폰 가속도 펄스).
 * 사용법: npm run make:fixture:versus -- [출력 경로=e2e/fixtures/versus-replay.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SESSION_VERSION, validateSession } from '@fc/core';
import { makeVersusSession } from '../packages/core/src/test-utils/synthetic-session';

const out = process.argv[2] ?? 'e2e/fixtures/versus-replay.json';
const { poseFrames, imuSamples, thrustTimes } = makeVersusSession({ thrusts: 5 });
const session = {
  version: SESSION_VERSION,
  recordedAt: '2026-11-23T00:00:00.000Z',
  device: { laptop: 'synthetic', phone: 'synthetic' },
  clockOffsetMs: 0,
  poseFrames,
  imuSamples,
  labels: thrustTimes.map((tMs) => ({ tMs, kind: 'thrust' as const })),
};
const check = validateSession(session);
if (!check.ok) {
  console.error(check.errors.join('\n'));
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(session));
console.log(`저장: ${out} (포즈 ${poseFrames.length}, IMU ${imuSamples.length}, 찌르기 ${thrustTimes.length}회)`);
