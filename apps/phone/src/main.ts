import { PROTOCOL_VERSION } from '@fc/link';

// 기술 검증 단계: 노트북 화면의 QR로 들어오는 것이 기본이고, 여기서는 센서 주기만 따로 잴 수 있다.
const app = document.querySelector<HTMLElement>('#app');
if (app) {
  app.innerHTML = `
    <h1>펜싱 코치 · 폰</h1>
    <p>노트북 화면의 QR 코드를 찍어 연결하세요.</p>
    <p><a href="spikes/sensor.html">센서 주기만 측정</a> · 프로토콜 v${PROTOCOL_VERSION}</p>`;
}
