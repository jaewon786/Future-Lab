import type { Handedness } from '@fc/core';

const KEY = 'fencing-coach.handedness';

/** 저장된 손잡이 설정 (없거나 저장소를 못 쓰면 오른손) */
export function loadHandedness(): Handedness {
  try {
    return localStorage.getItem(KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

export function saveHandedness(h: Handedness): void {
  try {
    localStorage.setItem(KEY, h);
  } catch {
    // 사생활 보호 모드 등에서 저장이 막혀도 이번 연습에는 영향 없음
  }
}
