/**
 * 런지 자세 판정 일치율 평가 (계획서 마일스톤 2 Task 8·12, PRD 지표: 80% 이상)
 * 기록기에서 G(좋은 런지)/B(나쁜 런지)로 라벨을 붙인 기록을 읽어, 앱과 같은 감지·판정을 돌리고 비교한다.
 * 기록 시작 직후 준비 자세로 몇 초 서 있어야 보정할 수 있다.
 * 사용법: npm run eval:lunge -- [폴더=fixtures/practice] [--left] [--tolerance 1000] [--aspect 1.3333]
 */
import {
  calibrate,
  createLandmarkSmoother,
  createLungeDetector,
  evaluateLungeLabels,
  type Calibration,
  type LungeEvent,
  type PoseFrame,
} from '@fc/core';
import { loadSessions, pct } from './lib/load-sessions';

const args = process.argv.slice(2);
const option = (name: string, fallback: number): number => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(args[i + 1]);
  if (!Number.isFinite(v) || v <= 0) {
    console.error(`${name} 뒤에 양수를 주세요`);
    process.exit(1);
  }
  return v;
};
const toleranceMs = option('--tolerance', 1000);
const aspect = option('--aspect', 4 / 3);
const handedness = args.includes('--left') ? 'left' : 'right';
const valued = new Set(['--tolerance', '--aspect']);
const dir = args.find((a, i) => !a.startsWith('--') && !valued.has(args[i - 1] ?? '')) ?? 'fixtures/practice';

const TARGET = 0.8;
const WINDOW = 45; // 15fps 기준 3초
const MAX_SEARCH_MS = 15_000;

/** 기록 앞부분에서 준비 자세가 안정된 구간을 찾아 보정한다 */
function findCalibration(frames: readonly PoseFrame[]): Calibration | null {
  for (let start = 0; start + WINDOW <= frames.length; start += 15) {
    if ((frames[start] as PoseFrame).tMs > MAX_SEARCH_MS) break;
    const r = calibrate(
      frames.slice(start, start + WINDOW).map((f) => f.landmarks),
      handedness,
      aspect,
    );
    if (r.ok) return r.calibration;
  }
  return null;
}

const sessions = loadSessions(dir);
if (sessions.length === 0) {
  console.error(`평가할 기록이 없음: ${dir}`);
  process.exit(1);
}

console.log(`\n# 런지 판정 일치율 — ${sessions.length}개 기록, 짝 허용 ±${toleranceMs}ms, ${handedness === 'left' ? '왼손' : '오른손'}잡이\n`);
let labels = 0;
let matched = 0;
let agreed = 0;
let extra = 0;

for (const { file, session } of sessions) {
  const cal = findCalibration(session.poseFrames);
  if (!cal) {
    console.log(`${file.padEnd(28)} 보정 실패 — 기록 시작 후 15초 안에 3초 이상 준비 자세로 서 있어야 함`);
    continue;
  }
  const smooth = createLandmarkSmoother();
  const detect = createLungeDetector(cal);
  const events: LungeEvent[] = [];
  for (const f of session.poseFrames) {
    const e = detect({ tMs: f.tMs, landmarks: smooth(f.landmarks) });
    if (e) events.push(e);
  }
  const r = evaluateLungeLabels(events, session.labels, toleranceMs);
  labels += r.lungeLabels;
  matched += r.matched;
  agreed += r.agreed;
  extra += r.extra;
  console.log(
    `${file.padEnd(28)} 라벨 ${r.lungeLabels} · 감지 ${events.length} · 짝 ${r.matched} · 일치 ${r.agreed} (${pct(r.agreement)}) · 놓침 ${r.missed} · 추가 감지 ${r.extra}`,
  );
}

const agreement = agreed / matched;
console.log(`\n전체: 라벨 ${labels} · 짝 ${matched} (감지율 ${pct(matched / labels)}) · 추가 감지 ${extra}`);
console.log(
  `판정 일치율: ${pct(agreement)} — ${agreement >= TARGET ? 'PASS' : 'FAIL'} (목표 ${pct(TARGET)} 이상)\n`,
);
