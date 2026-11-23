/**
 * 폰이 QR로 열 컨트롤러 주소. 배포에서는 노트북 앱 옆의 phone/ 앱을 가리키고,
 * 개발 중에는 VITE_PHONE_URL(예: https://<내 PC>:5174/controller.html)로 덮어쓴다.
 */
export function phoneControllerUrl(peerId: string): string {
  const override = import.meta.env.VITE_PHONE_CONTROLLER_URL as string | undefined;
  const base = override ?? new URL(`${import.meta.env.BASE_URL}../phone/controller.html`, location.origin).href;
  const url = new URL(base);
  url.searchParams.set('peer', peerId);
  return url.href;
}
