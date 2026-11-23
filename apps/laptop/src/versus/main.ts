// 대결 모드: 안전 확인(입력 방식·난이도) → (폰 연결) → 위치 안내 → 보정 → 경기 → 결과
// ?replay=<세션 기록> 을 주면 카메라·폰 대신 기록의 포즈와 IMU를 재생한다 (E2E·시연용).
// 그 밖의 쿼리: mode=phone|webcam, difficulty=easy|normal|hard, seed=<숫자>, dummy=1 (허수아비 상대)
import QRCode from 'qrcode';
import { createLandmarkSmoother, type BoutEvent, type BoutState, type Difficulty, type Handedness } from '@fc/core';
import { createArena, type Arena } from '../arena/scene';
import type { ImuSource } from '../imu/imu-source';
import { PhoneImuSource } from '../imu/phone-imu-source';
import { ReplayImuSource } from '../imu/replay-imu-source';
import { CameraPoseSource } from '../pose/camera-source';
import { drawLandmarks } from '../pose/mediapipe';
import type { PoseSource, PoseSourceFrame } from '../pose/pose-source';
import { loadSessionFile, ReplayPoseSource } from '../pose/replay-source';
import { loadHandedness, saveHandedness } from '../practice/settings';
import { el, fitCanvas, renderSetup, show, wireSafety } from '../shared/dom';
import { phoneControllerUrl } from '../shared/phone-url';
import { DEFAULT_SETUP_FLOW, SetupFlow } from '../shared/setup-flow';
import { createVersusGame, type InputMode, type VersusGame } from './game';

const query = new URLSearchParams(location.search);
const replayUrl = query.get('replay');
const video = el<HTMLVideoElement>('video');
const overlay = el<HTMLCanvasElement>('overlay');

const radioValue = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
const queryMode = query.get('mode');
if (queryMode === 'phone' || queryMode === 'webcam') {
  document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach((r) => {
    r.checked = r.value === queryMode;
  });
}
const queryDifficulty = query.get('difficulty');
if (queryDifficulty) el<HTMLSelectElement>('difficulty').value = queryDifficulty;

wireSafety(loadHandedness, saveHandedness, run);

interface Inputs {
  readonly pose: PoseSource;
  readonly imu: ImuSource | null;
}

async function prepareInputs(mode: InputMode): Promise<Inputs> {
  if (replayUrl) {
    const session = await loadSessionFile(replayUrl);
    video.hidden = true;
    return {
      pose: new ReplayPoseSource(session.poseFrames),
      imu: mode === 'phone' ? new ReplayImuSource(session.imuSamples) : null,
    };
  }
  const pose = new CameraPoseSource(video);
  if (mode === 'webcam') return { pose, imu: null };

  const phone = await PhoneImuSource.create();
  show('pair');
  const url = phoneControllerUrl(phone.peerId);
  await QRCode.toCanvas(el<HTMLCanvasElement>('qr'), url, { width: 220, margin: 1 });
  el<HTMLAnchorElement>('pair-url').href = url;
  el('pair-url').textContent = url;
  phone.onStatus((s) => {
    el('phone-status').textContent = s === 'connected' ? '폰 연결됨' : `폰: ${s}`;
  });
  await new Promise<void>((resolve) => phone.onStatus((s) => s === 'connected' && resolve()));
  return { pose, imu: phone };
}

async function run(hand: Handedness): Promise<void> {
  const mode: InputMode = radioValue('mode') === 'phone' ? 'phone' : 'webcam';
  const difficulty = el<HTMLSelectElement>('difficulty').value as Difficulty;
  const inputs = await prepareInputs(mode);
  show('setup');

  const smooth = createLandmarkSmoother();
  const setup = new SetupFlow(hand, () => inputs.pose.aspect);
  let game: VersusGame | null = null;
  let arena: Arena | null = null;

  const onPose = (frame: PoseSourceFrame) => {
    const lm = frame.landmarks ? smooth(frame.landmarks) : null;
    fitCanvas(overlay, video, inputs.pose);
    drawLandmarks(overlay, lm);

    if (!game) {
      const u = setup.handle(lm);
      renderSetup(u, DEFAULT_SETUP_FLOW.calibrationFrames);
      if (!u.calibration) return;
      game = createVersusGame(u.calibration, {
        mode,
        difficulty,
        seed: Number(query.get('seed') ?? Date.now() % 100_000),
        dummy: query.get('dummy') === '1',
      });
      show('bout');
      arena = createArena(el<HTMLCanvasElement>('arena'));
      if (!arena.available) el('message').textContent = '3D 화면을 쓸 수 없어 점수판만 표시합니다';
      return;
    }
    if (!lm || game.state().phase === 'ended') return;

    const r = game.onPose({ tMs: frame.tMs, landmarks: lm });
    arena?.set(r.view);
    if (r.fusion && !r.fusion.accepted) el('message').textContent = '팔을 더 뻗으세요 — 찌르기로 인정되지 않음';
    for (const e of r.events) onEvent(e, game.state(), arena);
    renderHud(game, r.distanceM);
  };

  await inputs.imu?.start((s) => game?.onImu(s));
  await inputs.pose.start(onPose);
  window.addEventListener('pagehide', () => {
    inputs.pose.stop();
    inputs.imu?.stop();
    arena?.dispose();
  });
}

function onEvent(e: BoutEvent, s: BoutState, arena: Arena | null): void {
  if (e.type === 'touch') {
    arena?.flash(e.who);
    el('message').textContent = e.who === 'double' ? '동시 타격! 둘 다 1점' : e.who === 'user' ? '득점!' : '실점';
  } else if (e.type === 'resume') {
    el('message').textContent = '준비 — 다시 시작';
  } else {
    show('result');
    const title = e.winner === 'user' ? '승리' : e.winner === 'opponent' ? '패배' : '무승부';
    el('result-title').textContent = title;
    el('result-score').textContent = `${s.score.user} : ${s.score.opponent}`;
    const mine = s.log.filter((l) => l.side === 'user');
    const count = (r: string) => mine.filter((l) => l.result === r).length;
    el('result-detail').textContent = `내 찌르기 ${mine.length}회 · 득점 ${count('hit')} · 빗나감 ${count('miss')} · 막힘 ${count('blocked')} · 경기 시간 ${Math.round(s.elapsedMs / 1000)}초`;
  }
}

function renderHud(game: VersusGame, distanceM: number): void {
  const s = game.state();
  const leftS = Math.max(0, Math.ceil((180_000 - s.elapsedMs) / 1000));
  el('score').textContent = `${s.score.user} : ${s.score.opponent}`;
  el('clock').textContent = `${Math.floor(leftS / 60)}:${String(leftS % 60).padStart(2, '0')}`;
  el('distance').textContent = `거리 ${distanceM.toFixed(1)}m · 내 도달 ${game.reachM.toFixed(1)}m`;
}
