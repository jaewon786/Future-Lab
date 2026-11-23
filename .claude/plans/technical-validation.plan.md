# Plan: 기술 검증 (스파이크)

**Source PRD**: `.claude/prds/fencing-coach.prd.md`
**Selected Milestone**: 1. 기술 검증 — 폰 센서·웹캠으로 실시간 판정이 가능한지 수치로 결론
**Complexity**: Large (작업 12개, 계획서 9-2 기준 2~3주차)

## Summary
G2 게이트의 네 수치(포즈 15fps, 폰 전송 지연 p95 50ms, 찌르기 재현율 90%·오탐 10%, 동기화 오차 100ms)를 실제 기기로 재고, 폰 센서 방식을 계속할지 웹캠 단독 모드로 바꿀지 결정한다.
측정용 화면(스파이크 페이지)은 버려도 되는 코드로 만들되, 이후 단계에서 그대로 쓰는 세 가지(메시지 검증, 시계 동기화, 세션 기록 형식)와 찌르기 감지 로직은 `packages/`에 TDD로 만든다.
결과물은 `docs/spike-report.md`의 측정표와 G2 결정, 그리고 `fixtures/`의 라벨된 세션 기록이다.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Naming | `packages/core/src/geometry.ts:12` | 파일은 kebab-case, 함수는 동사/명사 camelCase(`jointAngleDeg`), 단위를 이름 끝에 붙임(`Deg`, `Ms`) |
| Types | `packages/core/src/geometry.ts:2`, `packages/link/src/protocol.ts:5` | 데이터는 `readonly` 필드의 `interface`, 메시지는 `type` 리터럴 필드로 구분 |
| Errors | `packages/core/src/geometry.ts:19` | 계산 불가는 예외 대신 `NaN`/판정 보류로 반환하고 JSDoc에 호출 쪽 처리법을 적음. 신뢰 못 할 입력(폰 메시지, 기록 파일)은 검증 실패 시 `null` 또는 결과 객체로 반환하고 던지지 않음 |
| Logging | — | 아직 로깅 코드 없음. 스파이크 페이지는 화면 표시 + 복사 가능한 JSON 출력만 쓰고, 패키지 코드는 로그를 남기지 않음 |
| Data access | — | 아직 없음. 세션 기록은 JSON 파일(`fixtures/`)로만 다룸 |
| Tests | `packages/core/src/geometry.test.ts:1-6` | 같은 폴더의 `*.test.ts`, Vitest `describe`/`it`, 테스트 이름은 한국어로 기대 동작을 씀, 실수 비교는 `toBeCloseTo` |

## Files to Change
| File | Action | Why |
|---|---|---|
| `packages/link/src/protocol.ts` | UPDATE | ping/pong 메시지 추가, `parseMessage()`로 폰 메시지 형식·범위 검증 |
| `packages/link/src/protocol.test.ts` | CREATE | 정상·비정상 메시지 검증 테스트 |
| `packages/link/src/clock-sync.ts` | CREATE | ping 샘플로 왕복 시간과 두 기기 시계 차이 추정 (왕복 시간이 가장 짧은 샘플 기준) |
| `packages/link/src/clock-sync.test.ts` | CREATE | 지연·지터가 있는 가짜 샘플로 추정 오차 검증 |
| `packages/link/src/peer.ts` | CREATE | WebRTC 데이터 채널 연결 (PeerJS, 순서 보장·재전송 끔), 끊김 이벤트 |
| `packages/core/src/session.ts` | CREATE | 세션 기록 형식(포즈 프레임, IMU 샘플, 라벨 이벤트)과 `validateSession()` |
| `packages/core/src/session.test.ts` | CREATE | 형식 검증 테스트 |
| `packages/core/src/thrust.ts` | CREATE | IMU 찌르기 후보 감지 (y축 가속도 피크 + 회전 속도 거부 + 500ms 디바운스, 임계값은 인자) |
| `packages/core/src/thrust.test.ts` | CREATE | 합성 신호로 감지·거부·디바운스 테스트 |
| `packages/core/src/clap.ts` | CREATE | 박수 시각 검출 (포즈: 두 손목 거리 최소, IMU: 가속도 크기 스파이크) |
| `packages/core/src/clap.test.ts` | CREATE | 합성 신호 테스트 |
| `packages/core/src/index.ts`, `packages/link/src/index.ts` | UPDATE | 새 모듈 export |
| `apps/phone/spikes/sensor.html`, `apps/phone/src/spikes/sensor.ts` | CREATE | 센서 권한 버튼, Wake Lock, IMU 전송, 실측 샘플링 주기 표시 |
| `apps/laptop/spikes/link.html`, `apps/laptop/src/spikes/link.ts` | CREATE | QR 표시, 연결, 전송 지연 p50/p95와 수신 주기 표시, 결과 JSON 복사 |
| `apps/laptop/spikes/pose-fps.html`, `apps/laptop/src/spikes/pose-fps.ts` | CREATE | MediaPipe PoseLandmarker lite, 해상도·GPU/CPU 전환, fps 표시, 결과 JSON 복사 |
| `apps/laptop/spikes/recorder.html`, `apps/laptop/src/spikes/recorder.ts` | CREATE | 포즈 + 폰 IMU 동시 기록, 키보드 라벨(T 찌르기 / O 일반 동작 / C 박수), JSON 다운로드 |
| `apps/laptop/vite.config.ts`, `apps/phone/vite.config.ts` | CREATE | 스파이크 페이지 멀티 페이지 입력, GitHub Pages `base` 경로 |
| `apps/laptop/public/models/` | CREATE | MediaPipe 모델 파일을 직접 호스팅 (외부 CDN 의존 제거) |
| `scripts/eval-thrust.ts` | CREATE | `fixtures/` 기록에 `thrust.ts`를 돌려 재현율·오탐률 계산, 임계값 격자 탐색 |
| `scripts/eval-clap-sync.ts` | CREATE | 기록별 영상·센서 박수 시각 차이 계산 |
| `.github/workflows/pages.yml` | CREATE | 두 앱을 GitHub Pages로 배포 (폰 센서 권한에 HTTPS 필요) |
| `fixtures/README.md` | UPDATE | 세션 기록 형식과 파일 이름 규칙 |
| `docs/spike-report.md` | CREATE | 기기별 측정표, G2 판정, 결정 기록 |
| `package.json`, `apps/*/package.json`, `packages/link/package.json` | UPDATE | `@mediapipe/tasks-vision`, `peerjs`, `qrcode`, `tsx` 의존성, `eval:*` 스크립트 |

## Tasks
### Task 1: 폰 메시지 형식과 검증
- **Action**: `ImuSample`에 더해 `PingMessage`/`PongMessage`를 정의하고, `parseMessage(raw: unknown)`이 형식·숫자 범위(유한수, 가속도 ±200 m/s², 회전 ±5000°/s)를 검사해 실패 시 `null`을 반환하게 한다. 테스트 먼저.
- **Mirror**: `protocol.ts:5` readonly interface, `geometry.ts:19` 던지지 않는 실패 처리
- **Validate**: `npx vitest run packages/link`

### Task 2: 시계 동기화 추정
- **Action**: `estimateClockOffset(samples)`가 {보낸 시각, 폰 시각, 받은 시각} 샘플에서 왕복 시간 하위 25% 샘플만 써서 시계 차이와 왕복 시간을 추정한다. 무작위 지터를 넣은 가짜 샘플로 실제 차이와 5ms 이내인지 테스트한다.
- **Mirror**: `geometry.test.ts` 스타일, 단위 접미사 `Ms`
- **Validate**: `npx vitest run packages/link`

### Task 3: 세션 기록 형식
- **Action**: `SessionRecording { version, recordedAt, device: {laptop, phone}, poseFrames[{tMs, landmarks[33]{x,y,visibility}}], imuSamples[{tMs, accel, rotation}], labels[{tMs, kind: 'thrust'|'other'|'clap'}] }`(시각은 모두 노트북 기준)과 `validateSession()`을 만든다. 영상은 저장하지 않는다.
- **Mirror**: Task 1의 검증 방식
- **Validate**: `npx vitest run packages/core`

### Task 4: 배포 경로 (GitHub Pages)
- **Action**: 두 앱의 Vite 멀티 페이지 설정과 `pages.yml`을 추가해 `main` push 시 `https://jaewon786.github.io/Future-Lab/laptop/`, `/phone/`으로 배포한다. 저장소 설정에서 Pages 소스를 GitHub Actions로 켜는 것은 사용자 작업이다.
- **Mirror**: 기존 `ci.yml`의 Node 22 + `npm ci` 구성
- **Validate**: Actions에서 Pages 배포 성공, 폰 브라우저에서 HTTPS 주소 열림

### Task 5: 폰 센서 스파이크 페이지
- **Action**: "센서 허용" 버튼(iOS `DeviceMotionEvent.requestPermission()`), Screen Wake Lock, 실측 샘플링 주기 표시.
- **Mirror**: 없음 (일회용 페이지)
- **Validate**: 아이폰 1대 이상·안드로이드 1대 이상에서 권한 허용 후 주기 기록 → `docs/spike-report.md`

### Task 6: 연결과 지연 측정 페이지
- **Action**: `peer.ts`로 노트북-폰 데이터 채널을 열고(노트북이 QR 표시), Task 2의 ping으로 왕복 시간을 1분간 재서 p50/p95와 수신 주기를 표시한다. 같은 Wi-Fi와 폰 핫스팟 두 경우를 잰다.
- **Mirror**: Task 1·2 함수 사용
- **Validate**: 기기 조합별 p95 기록. 목표 50ms 이하

### Task 7: 포즈 fps 스파이크 페이지
- **Action**: PoseLandmarker lite를 GPU 위임으로 돌리고 실패 시 CPU로 바꾼다. 입력 해상도 640×480 / 480×360, 30초 평균 fps를 표시한다.
- **Mirror**: 없음 (일회용 페이지)
- **Validate**: 팀원 노트북 전부의 fps 기록. 목표 15fps 이상

### Task 8: 세션 기록기
- **Action**: Task 6 연결 + Task 7 포즈를 합쳐 Task 3 형식으로 기록하고, 폰 시각은 Task 2의 차이로 노트북 시각으로 바꾼다. 키 입력으로 라벨을 남기고 JSON을 내려받는다.
- **Mirror**: Task 3 `validateSession()`으로 저장 전 검증
- **Validate**: 내려받은 파일이 `validateSession()` 통과

### Task 9: 데이터 수집 (수작업)
- **Action**: 팀원 2명 이상이 측면 카메라 배치로 찌르기 50회, 일반 팔 동작(들기·휘두르기·내리기) 50회, 시작과 끝에 박수를 기록한다. 파일은 `fixtures/spike/{이름}-{날짜}.json`.
- **Mirror**: `fixtures/README.md` 규칙
- **Validate**: 파일별 라벨 수 확인

### Task 10: 찌르기 감지와 평가
- **Action**: `detectThrusts(samples, params)`를 합성 신호 테스트로 먼저 만들고, `scripts/eval-thrust.ts`로 Task 9 데이터에서 재현율·오탐률을 계산한다. 감지가 라벨 ±300ms 안이면 정답. 임계값은 격자 탐색 후 사람별 교차 검증(한 사람 데이터로 정하고 다른 사람으로 평가).
- **Mirror**: 계획서 7-1 초기값(최대 찌르기의 60%, 회전 300°/s, 디바운스 500ms)
- **Validate**: `npm run eval:thrust`. 목표 재현율 90% 이상·오탐 10% 이하

### Task 11: 박수 동기화 평가
- **Action**: `detectClap()` 두 종류를 테스트로 만들고 `scripts/eval-clap-sync.ts`로 기록별 영상·센서 박수 시각 차이를 계산한다.
- **Mirror**: Task 10과 같은 스크립트 구조
- **Validate**: `npm run eval:clap-sync`. 목표 오차 100ms 이하

### Task 12: 보고서와 G2 결정
- **Action**: `docs/spike-report.md`에 기기별 측정표, 네 기준의 통과 여부, 결정(폰 센서 계속 / 웹캠 단독 모드 / 해상도 낮춤)과 계획서 7-1에 반영할 임계값을 적는다. PRD 마일스톤 1을 complete로 바꾼다.
- **Mirror**: 계획서 9-2 G2 행
- **Validate**: 팀 검토 후 승인

## Validation
```bash
npm run check            # lint + typecheck + test
npm run test:coverage    # core 80% 기준
npm run build            # 스파이크 페이지 포함 빌드
npm run eval:thrust -- fixtures/spike
npm run eval:clap-sync -- fixtures/spike
```
기기 측정(Task 5~7)은 자동화할 수 없어 `docs/spike-report.md`에 기기·브라우저 버전과 함께 수동 기록한다.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| PeerJS 공개 신호 서버가 느리거나 막힘 | 중 | 연결 수립에만 쓰이므로 지연 측정엔 영향 없음. 막히면 노트북에서 작은 신호 서버를 띄우는 방식으로 교체 |
| 학교 Wi-Fi가 기기 간 P2P를 막음 | 중 | Task 6에서 핫스팟 경우를 함께 측정해 시연 기본 절차를 정함 |
| 아이폰 테스트 기기가 없음 | 중 | 팀원·지인 기기 확보를 Task 5 전에 확인. 없으면 보고서에 "아이폰 미검증"으로 명시 |
| 라벨 시각이 실제 동작보다 늦게 찍힘 | 높음 | 정답 판정 창을 ±300ms로 두고, 라벨 지연 분포를 보고서에 기록 |
| 데이터가 적어 임계값이 과적합 | 중 | 사람별 교차 검증, 수치는 출발점으로만 사용 |
| MediaPipe 모델·WASM 로딩 실패 | 낮 | 모델 파일을 `public/`에 직접 호스팅 |

## Acceptance
- [ ] 작업 1~12 완료
- [ ] `npm run check`, `npm run test:coverage`, `npm run build` 통과
- [ ] `docs/spike-report.md`에 네 기준 측정값과 G2 결정 기록
- [ ] 라벨된 세션 기록이 `fixtures/spike/`에 있음
- [ ] 패턴은 위 표를 따르고 새로 만들지 않음
