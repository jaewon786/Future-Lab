/**
 * 찌르기 감지 평가 (계획서 Task 10, G2 기준: 재현율 90% 이상, 오탐 10% 이하)
 * 사용법: npm run eval:thrust -- [폴더=fixtures/spike] [--tolerance 300]
 */
import {
  DEFAULT_THRUST_PARAMS,
  detectThrusts,
  evaluateThrusts,
  type ThrustEvaluation,
  type ThrustParams,
} from '@fc/core';
import { loadSessions, pct, type LoadedSession } from './lib/load-sessions';

const args = process.argv.slice(2);
const tolIdx = args.indexOf('--tolerance');
const toleranceMs = tolIdx >= 0 ? Number(args[tolIdx + 1]) : 300;
if (!Number.isFinite(toleranceMs) || toleranceMs <= 0) {
  console.error('--tolerance 뒤에 양수(ms)를 주세요. 예: --tolerance 300');
  process.exit(1);
}
const dir = args.find((a, i) => !a.startsWith('--') && (tolIdx < 0 || i !== tolIdx + 1)) ?? 'fixtures/spike';

const RECALL_TARGET = 0.9;
const FPR_TARGET = 0.1;

interface Counts {
  thrustLabels: number;
  otherLabels: number;
  truePositives: number;
  falsePositives: number;
}

function toEvaluation(c: Counts): ThrustEvaluation {
  return { ...c, recall: c.truePositives / c.thrustLabels, falsePositiveRate: c.falsePositives / c.otherLabels };
}

function add(a: Counts, b: Counts): Counts {
  return {
    thrustLabels: a.thrustLabels + b.thrustLabels,
    otherLabels: a.otherLabels + b.otherLabels,
    truePositives: a.truePositives + b.truePositives,
    falsePositives: a.falsePositives + b.falsePositives,
  };
}

const ZERO: Counts = { thrustLabels: 0, otherLabels: 0, truePositives: 0, falsePositives: 0 };

function evaluate(sessions: readonly LoadedSession[], params: ThrustParams): ThrustEvaluation {
  const total = sessions.reduce<Counts>(
    (acc, { session }) =>
      add(acc, evaluateThrusts(detectThrusts(session.imuSamples, params), session.labels, toleranceMs)),
    ZERO,
  );
  return toEvaluation(total);
}

/** 오탐 기준을 만족하는 것 중 재현율이 가장 높은 조합 (같으면 오탐이 낮은 쪽) */
function gridSearch(sessions: readonly LoadedSession[]): { params: ThrustParams; result: ThrustEvaluation } {
  let best: { params: ThrustParams; result: ThrustEvaluation } | null = null;
  for (let accelThreshold = 6; accelThreshold <= 40; accelThreshold += 2) {
    for (const maxRotationDegPerSec of [200, 300, 400, 600]) {
      const params = { ...DEFAULT_THRUST_PARAMS, accelThreshold, maxRotationDegPerSec };
      const result = evaluate(sessions, params);
      if (best === null) {
        best = { params, result };
        continue;
      }
      const ok = result.falsePositiveRate <= FPR_TARGET;
      const bestOk = best.result.falsePositiveRate <= FPR_TARGET;
      const better =
        (ok && !bestOk) ||
        (ok === bestOk &&
          (result.recall > best.result.recall ||
            (result.recall === best.result.recall && result.falsePositiveRate < best.result.falsePositiveRate)));
      if (better) best = { params, result };
    }
  }
  return best as { params: ThrustParams; result: ThrustEvaluation };
}

function line(name: string, r: ThrustEvaluation): string {
  return `${name.padEnd(28)} 찌르기 ${r.truePositives}/${r.thrustLabels} (재현율 ${pct(r.recall)})  오탐 ${r.falsePositives}/${r.otherLabels} (${pct(r.falsePositiveRate)})`;
}

const sessions = loadSessions(dir);
if (sessions.length === 0) {
  console.error(`평가할 기록이 없음: ${dir}`);
  process.exit(1);
}

console.log(`\n# 찌르기 감지 평가 — ${sessions.length}개 기록, 허용 오차 ±${toleranceMs}ms\n`);
console.log('## 파일별 (기본 파라미터)');
for (const s of sessions) console.log(line(s.file, evaluate([s], DEFAULT_THRUST_PARAMS)));

const { params, result } = gridSearch(sessions);
console.log('\n## 전체 데이터 최적 파라미터 (참고용, 과적합 가능)');
console.log(`accelThreshold=${params.accelThreshold}, maxRotationDegPerSec=${params.maxRotationDegPerSec}`);
console.log(line('전체', result));

const people = [...new Set(sessions.map((s) => s.person))];
let verdict = result;
if (people.length >= 2) {
  console.log('\n## 사람별 교차 검증 (나머지 사람으로 파라미터를 정하고 이 사람으로 평가)');
  let total = ZERO;
  for (const person of people) {
    const chosen = gridSearch(sessions.filter((s) => s.person !== person)).params;
    const r = evaluate(
      sessions.filter((s) => s.person === person),
      chosen,
    );
    total = add(total, r);
    console.log(line(`${person} (임계 ${chosen.accelThreshold})`, r));
  }
  verdict = toEvaluation(total);
  console.log(line('교차 검증 합계', verdict));
} else {
  console.log('\n(기록한 사람이 1명이라 교차 검증 생략 — 판정은 과적합 가능성이 있음)');
}

if (verdict.otherLabels === 0) {
  console.log('\n경고: 일반 동작(O) 라벨이 없어 오탐률을 계산할 수 없음 — 일반 동작도 기록하세요.');
}
console.log('오탐률 = 찌르기 라벨과 짝이 안 된 감지 수 ÷ 일반 동작(O) 라벨 수 (일반 동작 1회당 오탐, 100%를 넘을 수 있음)');
const pass = verdict.recall >= RECALL_TARGET && verdict.falsePositiveRate <= FPR_TARGET;
console.log(
  `\nG2 찌르기 기준: ${pass ? 'PASS' : 'FAIL'} (재현율 ${pct(verdict.recall)} / 목표 ${pct(RECALL_TARGET)}, 오탐 ${pct(verdict.falsePositiveRate)} / 목표 ${pct(FPR_TARGET)} 이하)\n`,
);
