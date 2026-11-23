import { jointAngleDeg } from '@fc/core';

// 기술 검증 단계: 측정 페이지 목록. core 연결 확인용 계산도 함께 보여 준다.
const app = document.querySelector<HTMLElement>('#app');
if (app) {
  const demo = jointAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
  app.innerHTML = `
    <h1>펜싱 코치 · 노트북 (기술 검증)</h1>
    <ul>
      <li><a href="spikes/pose-fps.html">포즈 처리 속도 측정</a></li>
      <li><a href="spikes/link.html">폰 연결 지연 측정</a></li>
      <li><a href="spikes/recorder.html">세션 기록기</a></li>
    </ul>
    <p>core 연결 확인: ${demo}°</p>`;
}
