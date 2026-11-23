import type { LabelEvent } from './session';

export interface LungeLabelEvaluation {
  /** lunge-good + lunge-bad 라벨 수 */
  readonly lungeLabels: number;
  /** 라벨과 짝지어진 감지 수 */
  readonly matched: number;
  /** 짝지어진 것 중 판정(ok)이 라벨(good/bad)과 같은 수 */
  readonly agreed: number;
  /** 짝이 없는 라벨 수 (감지 못 함) */
  readonly missed: number;
  /** 짝이 없는 감지 수 (라벨 없는 런지 또는 잘못 감지) */
  readonly extra: number;
  /** agreed / matched — PRD 지표 "판정 일치율" */
  readonly agreement: number;
  /** matched / lungeLabels */
  readonly detectionRate: number;
}

/**
 * 감지한 런지(정점 시각·판정)를 사람이 붙인 G/B 라벨과 비교한다.
 * 라벨마다 toleranceMs 안의 가장 가까운 미사용 감지와 짝짓는다.
 */
export function evaluateLungeLabels(
  events: readonly { readonly tMs: number; readonly judgment: { readonly ok: boolean } }[],
  labels: readonly LabelEvent[],
  toleranceMs: number,
): LungeLabelEvaluation {
  const lungeLabels = labels.filter((l) => l.kind === 'lunge-good' || l.kind === 'lunge-bad');
  const used = new Set<number>();
  let matched = 0;
  let agreed = 0;

  for (const label of lungeLabels) {
    let best = -1;
    let bestDist = Infinity;
    events.forEach((e, i) => {
      const dist = Math.abs(e.tMs - label.tMs);
      if (!used.has(i) && dist <= toleranceMs && dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    if (best < 0) continue;
    used.add(best);
    matched++;
    if ((events[best] as (typeof events)[number]).judgment.ok === (label.kind === 'lunge-good')) agreed++;
  }

  return {
    lungeLabels: lungeLabels.length,
    matched,
    agreed,
    missed: lungeLabels.length - matched,
    extra: events.length - matched,
    agreement: agreed / matched,
    detectionRate: matched / lungeLabels.length,
  };
}
