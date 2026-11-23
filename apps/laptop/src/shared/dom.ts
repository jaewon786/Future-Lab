import type { Handedness } from '@fc/core';
import type { PoseSource } from '../pose/pose-source';
import type { SetupUpdate } from './setup-flow';

/** id로 요소를 찾는다. 없으면 페이지 구성 오류이므로 바로 알린다. */
export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} 요소가 없음`);
  return e as T;
}

/** data-screen 섹션 중 하나만 보이게 하고 body[data-screen]에 기록한다 (E2E가 이 값을 본다) */
export function show(screen: string): void {
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach((s) => {
    s.hidden = s.dataset.screen !== screen;
  });
  document.body.dataset.screen = screen;
}

/** 위치 안내·보정 화면을 SetupFlow 결과로 그린다 (#hints, #cal-progress, #cal-error) */
export function renderSetup(u: SetupUpdate, calibrationFrames: number): void {
  if (u.stage === 'setup') {
    show('setup');
    el('hints').textContent = u.hints.length === 0 ? '좋습니다. 그대로 준비 자세를 잡으세요.' : u.hints.join('\n');
  } else if (u.stage === 'calibrate') {
    show('calibrate');
    el('cal-progress').textContent = `${u.progress} / ${calibrationFrames}`;
    if (u.calibrationError) el('cal-error').textContent = `${u.calibrationError} — 다시 잽니다.`;
  } else {
    el('cal-error').textContent = '';
  }
}

/** 카메라 영상 또는 재생(영상 없음)에 맞춰 관절 캔버스 크기를 정한다 */
export function fitCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement, source: PoseSource): void {
  if (video.hidden) {
    canvas.width = 640;
    canvas.height = Math.round(640 / source.aspect);
  } else if (video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

/**
 * 안전 확인 화면: 두 확인 상자를 체크해야 시작 버튼이 켜지고, 손잡이 설정을 기억한다.
 * 시작을 누르면 onStart(손잡이)를 부르고, 실패하면 #error에 이유를 보여 준다.
 */
export function wireSafety(
  load: () => Handedness,
  save: (h: Handedness) => void,
  onStart: (hand: Handedness) => Promise<void>,
): void {
  const strap = el<HTMLInputElement>('strap');
  const space = el<HTMLInputElement>('space');
  const begin = el<HTMLButtonElement>('begin');
  const errorBox = el('error');
  const saved = load();
  document.querySelectorAll<HTMLInputElement>('input[name="hand"]').forEach((r) => {
    r.checked = r.value === saved;
  });
  const update = () => {
    begin.disabled = !(strap.checked && space.checked);
  };
  strap.addEventListener('change', update);
  space.addEventListener('change', update);
  show('safety');

  begin.addEventListener('click', () => {
    const hand: Handedness =
      document.querySelector<HTMLInputElement>('input[name="hand"]:checked')?.value === 'left' ? 'left' : 'right';
    save(hand);
    begin.disabled = true;
    onStart(hand).catch((err: unknown) => {
      errorBox.hidden = false;
      errorBox.textContent = `시작 실패: ${err instanceof Error ? err.message : String(err)}`;
      begin.disabled = false;
    });
  });
}
