import QRCode from 'qrcode';

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

/** 스파이크 페이지들이 쓰던 이름 (구현은 @fc/link의 ClockSession) */
export { ClockSession as ClockSync } from '@fc/link';
