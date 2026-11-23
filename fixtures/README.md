# fixtures

세션 기록 JSON을 두는 곳입니다. 웹캠 영상은 넣지 않고 포즈 좌표와 IMU 샘플만 저장합니다.

## 만드는 법
노트북에서 `laptop/spikes/recorder.html`(세션 기록기)을 열고 폰으로 QR을 찍어 연결한 뒤 기록합니다.
라벨 키: `T` 찌르기 · `O` 일반 팔 동작(들기·휘두르기·내리기) · `C` 박수. 동작이 끝나는 순간에 누릅니다.
기록은 시작과 끝에 박수(C)를 한 번씩 넣습니다 — 동기화 오차 측정(`npm run eval:clap-sync`)에 씁니다.

## 파일 규칙
- 위치: `fixtures/spike/` (기술 검증 데이터)
- 이름: `{이름}-{YYYYMMDDHHmm}.json` — 첫 `-` 앞이 사람 이름이며, 찌르기 평가의 사람별 교차 검증에 쓰입니다. 이름에 `-`를 넣지 마세요.
- 형식: `packages/core/src/session.ts`의 `SessionRecording` (버전 1). 기록기가 저장 전에 `validateSession`으로 검사합니다.

## 형식 요약
| 필드 | 내용 |
| --- | --- |
| `version` | 1 |
| `recordedAt` | ISO 날짜 |
| `device` | `{ laptop, phone }` 브라우저 정보 |
| `clockOffsetMs` | 기록에 쓴 폰 시계 − 노트북 시계 (ms) |
| `poseFrames[]` | `{ tMs, landmarks[33]{ x, y, visibility } }` |
| `imuSamples[]` | `{ tMs, accel{ x, y, z } (m/s², 중력 제외), rotation{ alpha, beta, gamma } (°/s) }` |
| `labels[]` | `{ tMs, kind: 'thrust' | 'other' | 'clap' }` |

모든 `tMs`는 기록 시작 기준 노트북 시계(ms)이며 시간순입니다.
