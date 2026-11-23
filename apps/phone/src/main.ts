import { PROTOCOL_VERSION } from '@fc/link';

// 단계 0 확인용 화면: 워크스페이스 연결(@fc/link)이 동작하는지만 보여준다.
const app = document.querySelector<HTMLElement>('#app');
if (app) {
  app.textContent = `펜싱 코치 (폰) — 프로토콜 v${PROTOCOL_VERSION}`;
}
