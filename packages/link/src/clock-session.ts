import { estimateClockOffset, phoneToLaptopMs, type ClockOffsetEstimate, type PingSample } from './clock-sync';
import type { Message } from './protocol';

/** 메시지를 보낼 수 있는 쪽 (peer.ts의 Link가 이 형태를 만족한다) */
export interface MessageSender {
  send(msg: Message): boolean;
}

const MAX_PENDING = 500;
const MAX_SAMPLES = 2000;
/** 추정에 쓰는 최근 샘플 수 (시계가 조금씩 어긋나는 것을 따라가기 위해) */
const ESTIMATE_WINDOW = 200;

/**
 * 노트북 쪽 시계 동기화: ping을 보내고 pong을 모아 폰-노트북 시계 차이를 추정한다.
 * now는 노트북 시계(기본 performance.now). 테스트에서 바꿔 넣을 수 있다.
 */
export class ClockSession {
  private readonly sender: MessageSender;
  private readonly now: () => number;
  private seq = 0;
  private readonly pending = new Map<number, number>();
  readonly samples: PingSample[] = [];

  constructor(sender: MessageSender, now: () => number = () => performance.now()) {
    this.sender = sender;
    this.now = now;
  }

  /** 새 측정 시작 시 이전 ping 기록을 버린다 (늦게 온 이전 pong이 섞이지 않게) */
  reset(): void {
    this.pending.clear();
    this.samples.length = 0;
  }

  ping(): void {
    const seq = this.seq++;
    const laptopSendMs = this.now();
    this.pending.set(seq, laptopSendMs);
    if (this.pending.size > MAX_PENDING) this.pending.delete(seq - MAX_PENDING);
    this.sender.send({ type: 'ping', seq, laptopSendMs });
  }

  /** pong이면 샘플로 기록하고 true. 보낸 시각은 폰이 돌려준 값 대신 노트북이 기억한 값을 쓴다. */
  handle(msg: Message): boolean {
    if (msg.type !== 'pong') return false;
    const sent = this.pending.get(msg.seq);
    if (sent === undefined) return true;
    this.pending.delete(msg.seq);
    this.samples.push({ laptopSendMs: sent, phoneTimeMs: msg.phoneTimeMs, laptopRecvMs: this.now() });
    if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    return true;
  }

  estimate(): ClockOffsetEstimate | null {
    return estimateClockOffset(this.samples.slice(-ESTIMATE_WINDOW));
  }

  /** 폰 시각 → 노트북 시각. 아직 추정할 샘플이 없으면 null. */
  toLaptopMs(phoneTimeMs: number): number | null {
    const est = this.estimate();
    return est ? phoneToLaptopMs(phoneTimeMs, est.offsetMs) : null;
  }

  rttsMs(): number[] {
    return this.samples.map((s) => s.laptopRecvMs - s.laptopSendMs);
  }
}
