// 자세 연습 모드: 안전 확인 → 위치 안내 → 보정 → 연습
// ?replay=<세션 기록 JSON 주소> 를 주면 카메라 대신 기록을 재생한다 (E2E·시연용).
import {
  calibrate,
  checkFraming,
  createLandmarkSmoother,
  createLungeDetector,
  DEFAULT_CALIBRATION,
  type Handedness,
  type Landmark,
  type LungeEvent,
} from '@fc/core';
import { CameraPoseSource } from '../pose/camera-source';
import { drawLandmarks } from '../pose/mediapipe';
import type { PoseSource, PoseSourceFrame } from '../pose/pose-source';
import { loadReplay } from '../pose/replay-source';
import { describeEvent, summarize } from './feedback';
import { loadHandedness, saveHandedness } from './settings';

/** 연속으로 위치가 좋아야 보정으로 넘어가는 프레임 수 (15fps 기준 1초) */
const FRAMING_OK_FRAMES = 15;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} 요소가 없음`);
  return e as T;
}

type Screen = 'safety' | 'setup' | 'calibrate' | 'practice';
function show(screen: Screen): void {
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach((s) => {
    s.hidden = s.dataset.screen !== screen;
  });
  document.body.dataset.screen = screen;
}

const strap = el<HTMLInputElement>('strap');
const space = el<HTMLInputElement>('space');
const begin = el<HTMLButtonElement>('begin');
const errorBox = el('error');
const canvas = el<HTMLCanvasElement>('overlay');
const video = el<HTMLVideoElement>('video');
const replayUrl = new URLSearchParams(location.search).get('replay');

const saved = loadHandedness();
document.querySelectorAll<HTMLInputElement>('input[name="hand"]').forEach((r) => {
  r.checked = r.value === saved;
});
const updateBegin = () => {
  begin.disabled = !(strap.checked && space.checked);
};
strap.addEventListener('change', updateBegin);
space.addEventListener('change', updateBegin);
show('safety');

begin.addEventListener('click', () => {
  const hand: Handedness =
    document.querySelector<HTMLInputElement>('input[name="hand"]:checked')?.value === 'left' ? 'left' : 'right';
  saveHandedness(hand);
  begin.disabled = true;
  run(hand).catch((err: unknown) => {
    errorBox.hidden = false;
    errorBox.textContent = `시작 실패: ${err instanceof Error ? err.message : String(err)}`;
    begin.disabled = false;
  });
});

async function run(hand: Handedness): Promise<void> {
  const source: PoseSource = replayUrl ? await loadReplay(replayUrl) : new CameraPoseSource(video);
  video.hidden = Boolean(replayUrl);
  show('setup');

  const smooth = createLandmarkSmoother();
  let phase: Exclude<Screen, 'safety'> = 'setup';
  let framingOk = 0;
  let calFrames: Landmark[][] = [];
  let detect: ReturnType<typeof createLungeDetector> | null = null;
  const events: LungeEvent[] = [];

  const onFrame = (frame: PoseSourceFrame) => {
    const lm = frame.landmarks ? smooth(frame.landmarks) : null;
    if (video.hidden) {
      canvas.width = 640;
      canvas.height = Math.round(640 / source.aspect);
    } else if (video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    drawLandmarks(canvas, lm);

    if (phase === 'setup') {
      const framing = lm ? checkFraming(lm) : { ok: false as const, hints: ['사람이 보이지 않습니다 — 카메라 앞에 서세요'] };
      el('hints').textContent = framing.ok ? '좋습니다. 그대로 준비 자세를 잡으세요.' : framing.hints.join('\n');
      framingOk = framing.ok ? framingOk + 1 : 0;
      if (framingOk >= FRAMING_OK_FRAMES) {
        phase = 'calibrate';
        calFrames = [];
        show('calibrate');
      }
      return;
    }

    if (phase === 'calibrate') {
      if (lm) calFrames.push(lm);
      el('cal-progress').textContent = `${calFrames.length} / ${DEFAULT_CALIBRATION.minFrames}`;
      if (calFrames.length < DEFAULT_CALIBRATION.minFrames) return;
      const result = calibrate(calFrames, hand, source.aspect);
      if (!result.ok) {
        el('cal-error').textContent = `${result.errors.join(' ')} — 다시 잽니다.`;
        calFrames = [];
        return;
      }
      el('cal-error').textContent = '';
      detect = createLungeDetector(result.calibration);
      phase = 'practice';
      show('practice');
      return;
    }

    if (!lm || !detect) return;
    const framing = checkFraming(lm);
    el('practice-hint').textContent = framing.ok ? '' : framing.hints[0] ?? '';
    const event = detect({ tMs: frame.tMs, landmarks: lm });
    if (!event) return;
    events.push(event);
    renderCard(event, events.length);
    renderStats(events);
  };

  await source.start(onFrame);
  window.addEventListener('pagehide', () => source.stop());
}

function renderCard(event: LungeEvent, n: number): void {
  const d = describeEvent(event);
  const card = document.createElement('article');
  card.className = `card ${d.ok ? 'good' : 'bad'}`;
  card.dataset.testid = 'lunge-card';
  const h = document.createElement('h3');
  h.textContent = `${n}회 — ${d.title}`;
  card.append(h);
  for (const line of d.lines) {
    const p = document.createElement('p');
    p.textContent = line;
    card.append(p);
  }
  el('cards').prepend(card);
}

function renderStats(events: readonly LungeEvent[]): void {
  const s = summarize(events);
  const errors = Object.entries(s.byError)
    .sort((a, b) => b[1] - a[1])
    .map(([msg, count]) => `${msg} ${count}회`)
    .join(' · ');
  el('stats').textContent = `총 ${s.total}회 · 좋은 런지 ${s.good}회${errors ? ` · ${errors}` : ''}`;
}
