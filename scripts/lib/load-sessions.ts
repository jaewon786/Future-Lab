import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { validateSession, type SessionRecording } from '@fc/core';

export interface LoadedSession {
  readonly file: string;
  /** 파일 이름 규칙 {이름}-{날짜}.json의 이름 부분 (사람별 교차 검증에 씀) */
  readonly person: string;
  readonly session: SessionRecording;
}

/** 폴더의 *.json 세션 기록을 읽고 검증한다. 형식이 틀린 파일은 이유와 함께 건너뛴다. */
export function loadSessions(dir: string): LoadedSession[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`폴더를 읽을 수 없음: ${dir}`);
    return [];
  }

  const loaded: LoadedSession[] = [];
  for (const f of files.sort()) {
    const path = join(dir, f);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      console.error(`건너뜀 ${f}: JSON이 아님`);
      continue;
    }
    const r = validateSession(raw);
    if (!r.ok) {
      console.error(`건너뜀 ${f}: ${r.errors.slice(0, 3).join('; ')}`);
      continue;
    }
    loaded.push({ file: f, person: basename(f, '.json').split('-')[0] ?? f, session: r.session });
  }
  return loaded;
}

export function pct(x: number): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—';
}
