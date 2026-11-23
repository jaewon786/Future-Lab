import { validateSession, type PoseFrame } from '@fc/core';
import type { PoseSource, PoseSourceFrame } from './pose-source';

export interface ReplayOptions {
  /** 기록을 찍은 카메라의 화면비 (기록기는 640×480) */
  readonly aspect?: number;
  readonly onEnd?: () => void;
}

/** 세션 기록의 포즈 프레임을 원래 시간 간격대로 재생한다. 카메라 없이 화면·E2E를 시험할 때 쓴다. */
export class ReplayPoseSource implements PoseSource {
  readonly aspect: number;
  private readonly frames: readonly PoseFrame[];
  private readonly onEnd: (() => void) | undefined;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(frames: readonly PoseFrame[], opts: ReplayOptions = {}) {
    this.frames = frames;
    this.aspect = opts.aspect ?? 4 / 3;
    this.onEnd = opts.onEnd;
  }

  async start(onFrame: (frame: PoseSourceFrame) => void): Promise<void> {
    this.stopped = false;
    const play = (i: number) => {
      if (this.stopped) return;
      const frame = this.frames[i];
      if (!frame) {
        this.onEnd?.();
        return;
      }
      onFrame({ tMs: frame.tMs, landmarks: frame.landmarks });
      const next = this.frames[i + 1];
      const wait = next ? Math.max(0, next.tMs - frame.tMs) : 0;
      this.timer = setTimeout(() => play(i + 1), wait);
    };
    play(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

/** URL의 세션 기록 JSON을 읽어 재생 입력원을 만든다. 형식이 틀리면 이유를 담아 실패한다. */
export async function loadReplay(url: string, opts: ReplayOptions = {}): Promise<ReplayPoseSource> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`재생 기록을 읽지 못함: HTTP ${res.status}`);
  const check = validateSession(await res.json());
  if (!check.ok) throw new Error(`재생 기록 형식 오류: ${check.errors.slice(0, 3).join('; ')}`);
  return new ReplayPoseSource(check.session.poseFrames, opts);
}
