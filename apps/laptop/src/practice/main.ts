// 자세 연습 모드: 안전 확인 → 위치 안내 → 보정 → 연습
// ?replay=<세션 기록 JSON 주소> 를 주면 카메라 대신 기록을 재생한다 (E2E·시연용).
import { checkFraming, createLandmarkSmoother, createLungeDetector, type Handedness, type LungeEvent } from '@fc/core';
import { CameraPoseSource } from '../pose/camera-source';
import { drawLandmarks } from '../pose/mediapipe';
import type { PoseSource, PoseSourceFrame } from '../pose/pose-source';
import { loadReplay } from '../pose/replay-source';
import { el, fitCanvas, renderSetup, show, wireSafety } from '../shared/dom';
import { DEFAULT_SETUP_FLOW, SetupFlow } from '../shared/setup-flow';
import { describeEvent, summarize } from './feedback';
import { loadHandedness, saveHandedness } from './settings';

const canvas = el<HTMLCanvasElement>('overlay');
const video = el<HTMLVideoElement>('video');
const replayUrl = new URLSearchParams(location.search).get('replay');

wireSafety(loadHandedness, saveHandedness, run);

async function run(hand: Handedness): Promise<void> {
  const source: PoseSource = replayUrl ? await loadReplay(replayUrl) : new CameraPoseSource(video);
  video.hidden = Boolean(replayUrl);
  show('setup');

  const smooth = createLandmarkSmoother();
  const setup = new SetupFlow(hand, () => source.aspect);
  let detect: ReturnType<typeof createLungeDetector> | null = null;
  const events: LungeEvent[] = [];

  const onFrame = (frame: PoseSourceFrame) => {
    const lm = frame.landmarks ? smooth(frame.landmarks) : null;
    fitCanvas(canvas, video, source);
    drawLandmarks(canvas, lm);

    if (!detect) {
      const u = setup.handle(lm);
      renderSetup(u, DEFAULT_SETUP_FLOW.calibrationFrames);
      if (u.calibration) {
        detect = createLungeDetector(u.calibration);
        show('practice');
      }
      return;
    }

    if (!lm) return;
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
