import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { createPose, openCamera, toLandmarks, type Delegate } from './mediapipe';
import type { PoseSource, PoseSourceFrame } from './pose-source';

/** 웹캠 + MediaPipe 포즈 추정. 영상은 이 브라우저 안에서만 처리하고 저장·전송하지 않는다. */
export class CameraPoseSource implements PoseSource {
  private readonly video: HTMLVideoElement;
  private readonly delegate: Delegate;
  private stream: MediaStream | null = null;
  private landmarker: PoseLandmarker | null = null;
  private running = false;

  constructor(video: HTMLVideoElement, delegate: Delegate = 'GPU') {
    this.video = video;
    this.delegate = delegate;
  }

  get aspect(): number {
    return this.video.videoWidth && this.video.videoHeight ? this.video.videoWidth / this.video.videoHeight : 4 / 3;
  }

  async start(onFrame: (frame: PoseSourceFrame) => void): Promise<void> {
    this.stream = await openCamera(this.video, 640, 480);
    try {
      this.landmarker = (await createPose(this.delegate)).landmarker;
    } catch (err) {
      this.stop();
      throw err;
    }
    const pose = this.landmarker;
    this.running = true;
    let lastVideoTime = -1;
    const loop = () => {
      if (!this.running) return;
      if (this.video.currentTime !== lastVideoTime) {
        lastVideoTime = this.video.currentTime;
        const now = performance.now();
        onFrame({ tMs: now, landmarks: toLandmarks(pose.detectForVideo(this.video, now)) });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.landmarker?.close();
    this.landmarker = null;
  }
}
