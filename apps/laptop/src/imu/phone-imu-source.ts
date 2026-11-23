import type { ImuRecord } from '@fc/core';
import { ClockSession } from '@fc/link';
import { hostLink, type Link, type LinkStatus } from '@fc/link/peer';
import type { ImuSource } from './imu-source';

/** 시계 차이를 믿고 쓰기 전에 모을 pong 수 */
const MIN_SYNC_SAMPLES = 10;
const PING_EVERY_MS = 200;

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
    this.link.onMessage((msg) => {
      if (this.sync.handle(msg) || msg.type !== 'imu' || !this.synced) return;
      const tMs = this.sync.toLaptopMs(msg.phoneTimeMs);
      if (tMs !== null) onSample({ tMs, accel: msg.accel, rotation: msg.rotation });
    });
    this.pingTimer = window.setInterval(() => this.sync.ping(), PING_EVERY_MS);
  }

  stop(): void {
    clearInterval(this.pingTimer);
    this.link.close();
  }
}
