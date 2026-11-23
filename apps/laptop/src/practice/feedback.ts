import type { LungeCheck, LungeEvent } from '@fc/core';

export const CHECK_LABELS: Record<LungeCheck, string> = {
  'front-knee': '앞무릎',
  'knee-toe': '무릎-발끝',
  'back-knee': '뒷다리',
  torso: '상체',
  'sword-arm': '칼 팔',
};

export interface EventDescription {
  readonly ok: boolean;
  readonly title: string;
  readonly lines: readonly string[];
}

const deg = (v: number) => (Number.isFinite(v) ? `${Math.round(v)}°` : '—');

/** 런지 1회 결과를 화면 카드 문구로 바꾼다 */
export function describeEvent(e: LungeEvent): EventDescription {
  const { judgment: j, features: f } = e;
  const lines: string[] = j.errors.map((err) => err.message);
  lines.push(`앞무릎 ${deg(f.frontKneeDeg)} · 뒷다리 ${deg(f.backKneeDeg)} · 상체 ${deg(f.torsoTiltDeg)} · 칼 팔 ${deg(f.swordArmDeg)}`);
  if (j.skipped.length > 0) lines.push(`판정 못 함: ${j.skipped.map((c) => CHECK_LABELS[c]).join(', ')}`);
  const ok = j.errors.length === 0;
  return { ok, title: ok ? '좋은 런지' : `고칠 점 ${j.errors.length}개`, lines };
}

export interface PracticeStats {
  readonly total: number;
  readonly good: number;
  /** 피드백 문구 → 횟수 */
  readonly byError: Readonly<Record<string, number>>;
}

/** 지금까지의 런지 결과 요약 */
export function summarize(events: readonly LungeEvent[]): PracticeStats {
  const byError: Record<string, number> = {};
  let good = 0;
  for (const e of events) {
    if (e.judgment.errors.length === 0) good++;
    for (const err of e.judgment.errors) byError[err.message] = (byError[err.message] ?? 0) + 1;
  }
  return { total: events.length, good, byError };
}
