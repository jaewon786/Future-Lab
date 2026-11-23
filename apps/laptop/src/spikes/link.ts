// Task 6: 폰-노트북 연결 지연 측정. G2 기준: 전송 지연 p95 50ms 이하.
import { percentile, phoneToLaptopMs } from '@fc/link';
import { hostLink } from '@fc/link/peer';
import { ClockSync, el, fmt, phoneSensorUrl, showAndCopyJson, showJoinQr } from './common';

const DURATION_MS = 60_000;
const PING_EVERY_MS = 100;

const status = el('status');
const stats = el('stats');
const startBtn = el<HTMLButtonElement>('start');
const copyBtn = el<HTMLButtonElement>('copy');
const network = el<HTMLSelectElement>('network');

const { id, link } = await hostLink().catch((err: unknown) => {
  status.textContent = `신호 서버 연결 실패: ${err instanceof Error ? err.message : String(err)} — 새로고침하세요.`;
  throw err;
});
await showJoinQr(el<HTMLCanvasElement>('qr'), el<HTMLAnchorElement>('url'), phoneSensorUrl(id));
status.textContent = '폰으로 QR을 찍어 센서 페이지를 열고 "센서 허용"을 누르세요.';

const sync = new ClockSync(link);
/** IMU 수신 기록: 받은 시각(노트북)과 폰 시각 */
const imu: { recvMs: number; phoneTimeMs: number }[] = [];
let startedAt = 0;
let running = false;
let timer = 0;

link.onStatus((s, detail) => {
  status.textContent = s === 'connected' ? '폰 연결됨 — 측정을 시작하세요.' : `연결 상태: ${s}${detail ? ` (${detail})` : ''}`;
  startBtn.disabled = s !== 'connected';
});

link.onMessage((msg) => {
  if (sync.handle(msg)) return;
  if (msg.type === 'imu' && running) imu.push({ recvMs: performance.now(), phoneTimeMs: msg.phoneTimeMs });
});

function summary() {
  const est = sync.estimate();
  const rtts = sync.rttsMs();
  const now = performance.now();
  const recent = imu.filter((s) => now - s.recvMs <= 2000);
  const imuLatency = est ? imu.map((s) => s.recvMs - phoneToLaptopMs(s.phoneTimeMs, est.offsetMs)) : [];
  return {
    network: network.value,
    userAgent: navigator.userAgent,
    elapsedS: Math.round((now - startedAt) / 1000),
    pings: rtts.length,
    rttP50Ms: percentile(rtts, 50),
    rttP95Ms: percentile(rtts, 95),
    /** 왕복의 절반 = 한 방향 전송 지연 추정 (G2 판정값) */
    oneWayP95Ms: percentile(rtts, 95) / 2,
    imuSamples: imu.length,
    imuHz: recent.length / 2,
    /** 센서 이벤트 발생 → 노트북 수신 (시계 보정 후, 센서 처리 지연 포함) */
    imuLatencyP50Ms: percentile(imuLatency, 50),
    imuLatencyP95Ms: percentile(imuLatency, 95),
    clockOffsetMs: est?.offsetMs ?? null,
  };
}

function render() {
  const s = summary();
  stats.textContent = [
    `경과 ${s.elapsedS}s / ${DURATION_MS / 1000}s · ping ${s.pings}`,
    `왕복 p50 ${fmt(s.rttP50Ms)}ms · p95 ${fmt(s.rttP95Ms)}ms → 한 방향 p95 ≈ ${fmt(s.oneWayP95Ms)}ms (목표 50ms 이하)`,
    `IMU ${s.imuSamples}개 · 수신 ${fmt(s.imuHz, 0)}Hz · 센서→수신 p50 ${fmt(s.imuLatencyP50Ms)}ms · p95 ${fmt(s.imuLatencyP95Ms)}ms`,
  ].join('\n');
}

startBtn.addEventListener('click', () => {
  startedAt = performance.now();
  running = true;
  sync.reset();
  imu.length = 0;
  startBtn.disabled = true;
  copyBtn.disabled = true;
  clearInterval(timer);
  timer = window.setInterval(() => {
    sync.ping();
    render();
    if (performance.now() - startedAt >= DURATION_MS) {
      clearInterval(timer);
      running = false;
      status.textContent = '측정 끝 — 결과를 복사해 docs/spike-report.md에 붙이세요.';
      startBtn.disabled = false;
      copyBtn.disabled = false;
    }
  }, PING_EVERY_MS);
});

copyBtn.addEventListener('click', async () => {
  const ok = await showAndCopyJson(summary(), el('result'));
  copyBtn.textContent = ok ? '복사됨' : '아래 내용을 직접 복사하세요';
});
