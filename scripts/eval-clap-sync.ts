/**
 * 웹캠·폰 동기화 오차 평가 (계획서 Task 11, G2 기준: 100ms 이하)
 * 박수 순간을 영상(두 손목 최근접)과 폰(가속도 스파이크)에서 각각 찾아 시각 차이를 잰다.
 * 사용법: npm run eval:clap-sync -- [폴더=fixtures/spike]
 */
import { detectClapsImu, detectClapsPose, pairClapOffsets } from '@fc/core';
import { percentile } from '@fc/link';
import { loadSessions } from './lib/load-sessions';

const TARGET_MS = 100;
const dir = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'fixtures/spike';

const sessions = loadSessions(dir);
if (sessions.length === 0) {
  console.error(`평가할 기록이 없음: ${dir}`);
  process.exit(1);
}

console.log(`\n# 박수 동기화 평가 — ${sessions.length}개 기록\n`);
const all: number[] = [];
for (const { file, session } of sessions) {
  const pose = detectClapsPose(session.poseFrames);
  const imu = detectClapsImu(session.imuSamples);
  const offsets = pairClapOffsets(pose, imu);
  const labeled = session.labels.filter((l) => l.kind === 'clap').length;
  all.push(...offsets);
  const shown = offsets.map((o) => `${o >= 0 ? '+' : ''}${o.toFixed(0)}`).join(', ') || '없음';
  console.log(
    `${file.padEnd(28)} 라벨 ${labeled} / 영상 ${pose.length} / 폰 ${imu.length} / 짝 ${offsets.length}  차이(ms): ${shown}`,
  );
}

if (all.length === 0) {
  console.log('\n짝지은 박수가 없음 — 기록에 박수가 있는지, 손목이 화면에 보였는지 확인\n');
  process.exit(1);
}

const abs = all.map(Math.abs);
const mean = all.reduce((a, b) => a + b, 0) / all.length;
const p95 = percentile(abs, 95);
console.log(`\n짝 ${all.length}개 · 평균 차이 ${mean.toFixed(1)}ms (부호 = 폰이 늦음) · |차이| p95 ${p95.toFixed(1)}ms · 최대 ${Math.max(...abs).toFixed(1)}ms`);
console.log(`G2 동기화 기준: ${p95 <= TARGET_MS ? 'PASS' : 'FAIL'} (|차이| p95 ${p95.toFixed(1)}ms / 목표 ${TARGET_MS}ms 이하)`);
console.log('평균 차이가 크고 흩어짐이 작으면 고정 지연이므로 시작 시 보정값으로 뺄 수 있다.\n');
