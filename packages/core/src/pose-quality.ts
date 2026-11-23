import { LM } from './landmarks';
import type { Landmark } from './session';

export interface FramingOptions {
  readonly minVisibility: number;
  /** 화면 가장자리 여백 (정규화 좌표) */
  readonly margin: number;
  /** 머리~발 높이가 화면 높이에서 차지할 범위 */
  readonly minBodyHeight: number;
  readonly maxBodyHeight: number;
}

export const DEFAULT_FRAMING: FramingOptions = { minVisibility: 0.5, margin: 0.02, minBodyHeight: 0.4, maxBodyHeight: 0.9 };

export type FramingResult = { readonly ok: true } | { readonly ok: false; readonly hints: readonly string[] };

/** 판정에 꼭 필요한 관절: 양쪽 어깨·엉덩이·무릎·발목·손목 */
const REQUIRED = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
];
/** 화면 안에 있어야 하는 관절 (머리·발끝 포함) */
const BOUNDS = [...REQUIRED, LM.NOSE, LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT, LM.RIGHT_FOOT];

/**
 * 카메라 위치 안내: 전신이 판정하기 좋게 화면에 들어왔는지 본다.
 * 문제가 있으면 사용자에게 보여 줄 한국어 안내 문구를 돌려준다.
 */
export function checkFraming(landmarks: readonly Landmark[], opts: FramingOptions = DEFAULT_FRAMING): FramingResult {
  const hints: string[] = [];
  const seen = (i: number) => {
    const l = landmarks[i];
    return l !== undefined && l.visibility >= opts.minVisibility;
  };

  if (!REQUIRED.every(seen)) hints.push('전신과 양손이 화면에 보이게 서세요');

  const pts = BOUNDS.filter(seen).map((i) => landmarks[i] as Landmark);
  if (pts.length > 0) {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const lo = opts.margin;
    const hi = 1 - opts.margin;

    if (maxY > hi) hints.push('발이 화면 밖입니다 — 뒤로 물러나거나 노트북을 조금 낮추세요');
    if (minY < lo) hints.push('머리가 화면 밖입니다 — 뒤로 물러나거나 노트북을 조금 높이세요');
    if (minX < lo || maxX > hi) hints.push('화면 가운데로 이동하세요');

    const height = maxY - minY;
    if (height > opts.maxBodyHeight) hints.push('너무 가깝습니다 — 뒤로 물러나세요');
    else if (height < opts.minBodyHeight) hints.push('너무 멉니다 — 앞으로 오세요');
  }

  return hints.length === 0 ? { ok: true } : { ok: false, hints };
}
