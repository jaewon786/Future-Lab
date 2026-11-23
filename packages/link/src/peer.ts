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
  peer: Peer;
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

  get hasOpenConnection(): boolean {
    return this.conn?.open === true;
  }

  /** 새 연결을 붙인다. PeerJS는 신호 서버가 끊긴 동안 connect()가 undefined를 돌려줄 수 있다. */
  attach(conn: DataConnection | undefined): void {
    if (!conn) {
      this.emitStatus('error', '신호 서버 연결 없음');
      return;
    }
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

/**
 * 노트북 쪽: 신호 서버에 등록하고 받은 ID를 돌려준다. 폰이 이 ID로 접속한다.
 * 이미 연결된 폰이 있으면 새 접속은 거절한다 (ID를 아는 다른 기기가 가로채지 못하게).
 */
export function hostLink(): Promise<{ id: string; link: Link }> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    const link = new PeerLink(peer);
    peer.on('connection', (conn) => {
      if (link.hasOpenConnection) {
        conn.on('open', () => conn.close());
        return;
      }
      link.attach(conn);
    });
    peer.on('open', (id) => resolve({ id, link }));
    // 신호 서버만 끊긴 경우: 기존 데이터 채널은 유지되고, 새 접속을 받으려면 다시 등록해야 한다
    peer.on('disconnected', () => {
      if (!link.isClosed && !peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err) => {
      link.emitStatus('error', err.type);
      reject(err);
    });
  });
}

/** 폰 쪽: 노트북 ID로 접속하고, 끊기면 2초 뒤 한 번씩 다시 시도한다. */
export function joinLink(hostId: string): Link {
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const makePeer = (): Peer => {
    const peer = new Peer();
    peer.on('open', () => connect());
    peer.on('error', (err) => {
      link.emitStatus('error', err.type);
      scheduleRetry();
    });
    return peer;
  };

  const link = new PeerLink(makePeer());

  function connect(): void {
    if (link.isClosed || link.hasOpenConnection) return;
    const peer = link.peer;
    if (peer.destroyed) {
      // 치명적 오류로 파기된 경우 새 Peer로 다시 시작한다 (open에서 connect가 다시 불린다)
      link.peer = makePeer();
      return;
    }
    if (peer.disconnected) {
      peer.reconnect();
      scheduleRetry();
      return;
    }
    link.attach(peer.connect(hostId, CONNECT_OPTIONS));
  }

  function scheduleRetry(): void {
    if (retryTimer !== null || link.isClosed) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, RETRY_MS);
  }

  link.onStatus((status) => {
    if (status === 'closed' || status === 'error') scheduleRetry();
  });

  const close = link.close.bind(link);
  link.close = () => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    close();
  };
  return link;
}
