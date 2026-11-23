import { jointAngleDeg } from '@fc/core';

// 단계 0 확인용 화면: 워크스페이스 연결(@fc/core)이 동작하는지만 보여준다.
const app = document.querySelector<HTMLElement>('#app');
if (app) {
  const demo = jointAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
  app.textContent = `펜싱 코치 (노트북) — core 연결 확인: ${demo}°`;
}
