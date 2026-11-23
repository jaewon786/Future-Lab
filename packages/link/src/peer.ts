import Peer, { type DataConnection } from 'peerjs';
import { parseMessage, type Message } from './protocol';

export type LinkStatus = 'connected' | 'closed' | 'error';

/** 노트북 ↔ 폰 데이터 채널. 받은 메시지는 parseMessage를 통과한 것만 전달한다. */
export interface Link {
  /** 연결돼 있으면 보내고 true, 아니면 false */
  send(msg: Message): boolean;
  onMessage(cb: (msg: Message) => void): void;
  onStatus(cb: (status: LinkStatus, detail?: string) => void): void;
  close(): void;
}

/** 늦게 온 센서 값은 버리는 편이 낫다: 순서 보장·재전송을 끈 채널 */
const CONNECT_OPTIONS = { reliable: false, serialization: 'json' } as const;
const RETRY_MS = 2000;

class PeerLink implements Link {
  private readonly peer: Peer;
  private conn: DataConnection | null = null;
  private closed = false;
  private readonly messageCbs: ((msg: Message) => void)[] = [];
  private readonly statusCbs: ((status: LinkStatus, detail?: string) => void)[] = [];

  constructor(peer: Peer) {
    this.peer = peer;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** 새 연결로 바꾼다 (노트북은 가장 최근에 붙은 폰 하나만 받는다) */
  attach(conn: DataConnection): void {
    if (this.conn && this.conn !== conn) this.conn.close();
    this.conn = conn;
    conn.on('open', () => this.emitStatus('connected'));
    conn.on('data', (data) => {
      const msg = parseMessage(data);
      if (msg) for (const cb of this.messageCbs) cb(msg);
    });
    conn.on('close', () => {
      if (this.conn === conn) {
        this.conn = null;
        this.emitStatus('closed');
      }
    });
    conn.on('error', (err) => this.emitStatus('error', String(err)));
  }

  emitStatus(status: LinkStatus, detail?: string): void {
    for (const cb of this.statusCbs) cb(status, detail);
  }

  send(msg: Message): boolean {
    if (!this.conn?.open) return false;
    void this.conn.send(msg);
    return true;
  }

  onMessage(cb: (msg: Message) => void): void {
    this.messageCbs.push(cb);
  }

  onStatus(cb: (status: LinkStatus, detail?: string) => void): void {
    this.statusCbs.push(cb);
  }

  close(): void {
    this.closed = true;
    this.conn?.close();
    this.peer.destroy();
  }
}

/** 노트북 쪽: 신호 서버에 등록하고 받은 ID를 돌려준다. 폰이 이 ID로 접속한다. */
export function hostLink(): Promise<{ id: string; link: Link }> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    const link = new PeerLink(peer);
    peer.on('connection', (conn) => link.attach(conn));
    peer.on('open', (id) => resolve({ id, link }));
    peer.on('error', (err) => {
      link.emitStatus('error', err.type);
      reject(err);
    });
  });
}

/** 폰 쪽: 노트북 ID로 접속하고, 끊기면 2초마다 다시 시도한다. */
export function joinLink(hostId: string): Link {
  const peer = new Peer();
  const link = new PeerLink(peer);
  const connect = () => {
    if (!link.isClosed && !peer.destroyed) link.attach(peer.connect(hostId, CONNECT_OPTIONS));
  };
  peer.on('open', connect);
  peer.on('error', (err) => link.emitStatus('error', err.type));
  link.onStatus((status) => {
    if (status === 'closed' || status === 'error') setTimeout(connect, RETRY_MS);
  });
  return link;
}
