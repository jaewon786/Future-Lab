// 칼 컨트롤러: 노트북 대결 화면의 QR로 들어온다 (?peer=<노트북 ID>).
// 센서 권한 → 화면 꺼짐 방지 → 노트북에 IMU 전송, ping에는 pong으로 응답 (시계 동기화).
import type { ImuSample } from '@fc/link';
import { joinLink, type Link } from '@fc/link/peer';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} 요소가 없음`);
  return e as T;
}

const hostId = new URLSearchParams(location.search).get('peer');
const startBtn = el<HTMLButtonElement>('start');
const status = el('status');
const guide = el('guide');
let link: Link | null = null;
let sent = 0;
let wakeLock: WakeLockSentinel | null = null;

function setStatus(text: string, tone: 'ok' | 'warn' | 'bad'): void {
  status.textContent = text;
  document.body.dataset.tone = tone;
}

if (!hostId) {
  setStatus('노트북 화면의 QR 코드로 들어와 주세요', 'bad');
  startBtn.disabled = true;
}

async function keepAwake(): Promise<void> {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    guide.textContent = '화면 꺼짐 방지를 못 켰습니다 — 설정에서 자동 잠금 시간을 늘려 주세요';
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock?.released !== false && link) void keepAwake();
});

function onMotion(e: DeviceMotionEvent): void {
  const a = e.acceleration;
  if (!a || a.x === null || a.y === null || a.z === null) return;
  const r = e.rotationRate;
  const sample: ImuSample = {
    type: 'imu',
    // pong과 같은 시계(performance.now)를 쓴다. 일부 브라우저는 e.timeStamp가 다른 기준이다
    phoneTimeMs: performance.now(),
    accel: { x: a.x, y: a.y, z: a.z },
    rotation: { alpha: r?.alpha ?? 0, beta: r?.beta ?? 0, gamma: r?.gamma ?? 0 },
  };
  if (link?.send(sample)) sent++;
}

startBtn.addEventListener('click', async () => {
  if (!hostId) return;
  startBtn.disabled = true;
  const motion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<PermissionState> };
  const permission =
    typeof motion.requestPermission === 'function'
      ? await motion.requestPermission().catch(() => 'denied' as const)
      : 'granted';
  if (permission !== 'granted') {
    setStatus('센서 권한이 없습니다', 'bad');
    guide.textContent = '설정 → Safari → 동작 및 방향 접근을 켜고 새로고침하세요. 대결 화면에서 "웹캠만"을 골라도 됩니다.';
    startBtn.disabled = false;
    return;
  }
  await keepAwake();
  window.addEventListener('devicemotion', onMotion);

  link = joinLink(hostId);
  setStatus('연결하는 중…', 'warn');
  link.onStatus((s) => {
    if (s === 'connected') setStatus('연결됨 — 칼처럼 쥐세요', 'ok');
    else setStatus('연결 끊김 — 다시 연결하는 중…', 'bad');
  });
  link.onMessage((msg) => {
    if (msg.type === 'ping') {
      link?.send({ type: 'pong', seq: msg.seq, laptopSendMs: msg.laptopSendMs, phoneTimeMs: performance.now() });
    }
  });
  guide.textContent = '폰을 세로로, 화면 위쪽 끝이 상대를 향하게 쥐세요. 손목 스트랩을 꼭 거세요.';
  window.setInterval(() => {
    el('sent').textContent = `보낸 센서 값 ${sent}`;
  }, 1000);
});
