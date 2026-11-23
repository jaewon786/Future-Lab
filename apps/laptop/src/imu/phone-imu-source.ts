import type { ImuRecord } from '@fc/core';
import { ClockSession } from '@fc/link';
import { hostLink, type Link, type LinkStatus } from '@fc/link/peer';
import type { ImuSource } from './imu-source';

/** 시계 차이를 믿고 쓰기 전에 모을 pong 수 */
const MIN_SYNC_SAMPLES = 10;
const PING_EVERY_MS = 200;
/** 시계 추정 오차를 감안해도 이보다 미래인 샘플은 잘못된 값 */
const MAX_FUTURE_MS = 500;

/**
 * 폰 컨트롤러에서 오는 IMU. 노트북이 신호 서버에 등록하고(peerId를 QR로 보여 줌),
 * ping/pong으로 시계를 맞춘 뒤 폰 시각을 노트북 시각으로 바꿔 내보낸다.
 * 시계가 맞기 전의 샘플은 버린다.
 */
export class PhoneImuSource implements ImuSource {
  readonly peerId: string;
  private readonly link: Link;
  private readonly sync: ClockSession;
  private pingTimer = 0;

  private constructor(peerId: string, link: Link) {
    this.peerId = peerId;
    this.link = link;
    this.sync = new ClockSession(link);
  }

  static async create(): Promise<PhoneImuSource> {
    const { id, link } = await hostLink();
    return new PhoneImuSource(id, link);
  }

  onStatus(cb: (status: LinkStatus, detail?: string) => void): void {
    this.link.onStatus(cb);
  }

  /** 시계 동기화가 끝나 샘플을 받을 수 있는지 */
  get synced(): boolean {
    return this.sync.samples.length >= MIN_SYNC_SAMPLES;
  }

  async start(onSample: (sample: ImuRecord) => void): Promise<void> {
    let lastTMs = Number.NEGATIVE_INFINITY;
    // 폰이 다시 연결되면(새로고침 등) 폰 시계 기준이 바뀌므로 시계 동기화를 처음부터 다시 한다
    this.link.onStatus((s) => {
      if (s === 'connected') {
        this.sync.reset();
        lastTMs = Number.NEGATIVE_INFINITY;
      }
    });
    this.link.onMessage((msg) => {
      if (this.sync.handle(msg) || msg.type !== 'imu' || !this.synced) return;
      const tMs = this.sync.toLaptopMs(msg.phoneTimeMs);
      // 시각이 거꾸로 가거나 노트북 시계보다 미래면 버린다 (찌르기 감지기가 멈추는 것을 막음)
      if (tMs === null || tMs < lastTMs || tMs > performance.now() + MAX_FUTURE_MS) return;
      lastTMs = tMs;
      onSample({ tMs, accel: msg.accel, rotation: msg.rotation });
    });
    this.pingTimer = window.setInterval(() => this.sync.ping(), PING_EVERY_MS);
  }

  stop(): void {
    clearInterval(this.pingTimer);
    this.link.close();
  }
}
