import QRCode from 'qrcode';
import { estimateClockOffset, type ClockOffsetEstimate, type Message, type PingSample } from '@fc/link';
import type { Link } from '@fc/link/peer';

/** id로 요소를 찾는다. 없으면 페이지 구성 오류이므로 바로 알린다. */
export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} 요소가 없음`);
  return e as T;
}

export function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

/** 폰이 열 센서 페이지 주소. 개발 중에는 VITE_PHONE_URL로 덮어쓴다. */
export function phoneSensorUrl(peerId: string): string {
  const override = import.meta.env.VITE_PHONE_URL as string | undefined;
  const base = override ?? new URL(`${import.meta.env.BASE_URL}../phone/spikes/sensor.html`, location.origin).href;
  const url = new URL(base);
  url.searchParams.set('peer', peerId);
  return url.href;
}

export async function showJoinQr(canvas: HTMLCanvasElement, anchor: HTMLAnchorElement, url: string): Promise<void> {
  await QRCode.toCanvas(canvas, url, { width: 220, margin: 1 });
  anchor.href = url;
  anchor.textContent = url;
}

/** 결과를 화면에 보여 주고 클립보드에 복사한다. 복사 성공 여부를 돌려준다. */
export async function showAndCopyJson(data: unknown, out: HTMLElement): Promise<boolean> {
  const text = JSON.stringify(data, null, 2);
  out.textContent = text;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** ping을 보내고 pong을 모아 폰-노트북 시계 차이를 추정한다. */
export class ClockSync {
  private readonly link: Link;
  private seq = 0;
  private readonly pending = new Map<number, number>();
  readonly samples: PingSample[] = [];

  constructor(link: Link) {
    this.link = link;
  }

  /** 새 측정 시작 시 이전 ping 기록을 버린다 (늦게 온 이전 pong이 섞이지 않게) */
  reset(): void {
    this.pending.clear();
    this.samples.length = 0;
  }

  ping(): void {
    const seq = this.seq++;
    const laptopSendMs = performance.now();
    this.pending.set(seq, laptopSendMs);
    if (this.pending.size > 500) this.pending.delete(seq - 500);
    this.link.send({ type: 'ping', seq, laptopSendMs });
  }

  /** pong이면 샘플로 기록하고 true. 보낸 시각은 폰이 돌려준 값 대신 노트북이 기억한 값을 쓴다. */
  handle(msg: Message): boolean {
    if (msg.type !== 'pong') return false;
    const sent = this.pending.get(msg.seq);
    if (sent === undefined) return true;
    this.pending.delete(msg.seq);
    this.samples.push({ laptopSendMs: sent, phoneTimeMs: msg.phoneTimeMs, laptopRecvMs: performance.now() });
    if (this.samples.length > 2000) this.samples.splice(0, this.samples.length - 2000);
    return true;
  }

  /** 최근 200개 샘플로 추정 (시계가 조금씩 어긋나는 것을 따라가기 위해) */
  estimate(): ClockOffsetEstimate | null {
    return estimateClockOffset(this.samples.slice(-200));
  }

  rttsMs(): number[] {
    return this.samples.map((s) => s.laptopRecvMs - s.laptopSendMs);
  }
}
