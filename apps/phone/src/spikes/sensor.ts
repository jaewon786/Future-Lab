// Task 5: 폰 센서 권한·샘플링 주기 확인, 노트북으로 IMU 전송, ping에 pong 응답.
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
const stats = el('stats');
const copyBtn = el<HTMLButtonElement>('copy');

let link: Link | null = null;
let linkStatus = hostId ? '연결 전' : '노트북 없이 주기만 측정';
let sent = 0;
let missingAccel = 0;
let reportedIntervalMs = Number.NaN;
const stamps: number[] = [];
let latest: ImuSample | null = null;
let peakY = 0;
let wakeLock: WakeLockSentinel | null = null;

async function keepAwake(): Promise<void> {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    linkStatus += ' · 화면 꺼짐 방지 실패';
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock?.released !== false) void keepAwake();
});

function onMotion(e: DeviceMotionEvent): void {
  const a = e.acceleration;
  const r = e.rotationRate;
  if (!a || a.x === null || a.y === null || a.z === null) {
    missingAccel++;
    return;
  }
  // 표준은 ms지만 일부 엔진은 초 단위로 준다 (1 미만이면 초로 본다)
  reportedIntervalMs = e.interval < 1 ? e.interval * 1000 : e.interval;
  const sample: ImuSample = {
    type: 'imu',
    phoneTimeMs: e.timeStamp,
    accel: { x: a.x, y: a.y, z: a.z },
    rotation: { alpha: r?.alpha ?? 0, beta: r?.beta ?? 0, gamma: r?.gamma ?? 0 },
  };
  latest = sample;
  stamps.push(e.timeStamp);
  while (stamps.length > 0 && e.timeStamp - (stamps[0] as number) > 2000) stamps.shift();
  if (link?.send(sample)) sent++;
}

function measuredHz(): number {
  if (stamps.length < 2) return Number.NaN;
  return (stamps.length - 1) / (((stamps[stamps.length - 1] as number) - (stamps[0] as number)) / 1000);
}

function render(): void {
  const y = latest?.accel.y ?? 0;
  peakY = Math.max(peakY * 0.98, y);
  stats.textContent = [
    `연결: ${linkStatus}`,
    `측정 주기 ${measuredHz().toFixed(1)}Hz · 기기 보고 간격 ${reportedIntervalMs.toFixed(1)}ms`,
    `전송 ${sent} · 가속도 없음 ${missingAccel}`,
    `y축 가속도 ${y.toFixed(1)} (최근 최대 ${peakY.toFixed(1)}) m/s² — 찌르기 때 양수로 커져야 함`,
  ].join('\n');
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  const motion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<PermissionState> };
  const permission =
    typeof motion.requestPermission === 'function'
      ? await motion.requestPermission().catch(() => 'denied' as const)
      : 'granted';
  await keepAwake();
  if (permission === 'granted') {
    window.addEventListener('devicemotion', onMotion);
    status.textContent = '폰을 칼 손잡이처럼 세로로 쥐고 화면 위쪽 끝이 앞을 향하게 하세요.';
  } else {
    // 센서 없이도 연결·지연 측정(ping)은 할 수 있으므로 연결은 계속한다
    status.textContent = '센서 권한이 거부됨 — 연결 지연만 측정합니다. 센서를 쓰려면 설정에서 동작 접근을 허용하고 새로고침하세요.';
  }

  if (hostId) {
    link = joinLink(hostId);
    link.onStatus((s, detail) => {
      linkStatus = `${s}${detail ? ` (${detail})` : ''}`;
    });
    link.onMessage((msg) => {
      if (msg.type === 'ping') {
        link?.send({ type: 'pong', seq: msg.seq, laptopSendMs: msg.laptopSendMs, phoneTimeMs: performance.now() });
      }
    });
  }
  window.setInterval(render, 250);
  copyBtn.disabled = false;
});

copyBtn.addEventListener('click', async () => {
  const text = JSON.stringify(
    { userAgent: navigator.userAgent, measuredHz: Number(measuredHz().toFixed(1)), reportedIntervalMs, sent, missingAccel },
    null,
    2,
  );
  el('result').textContent = text;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = '복사됨';
  } catch {
    copyBtn.textContent = '아래 내용을 직접 복사하세요';
  }
});
