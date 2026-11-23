# Plan: 대결 모드

**Source PRD**: `.claude/prds/fencing-coach.prd.md`
**Selected Milestone**: 3. 대결 모드 — 사용자가 가상 상대와 에페 1판(5점 또는 3분)을 끝까지 치름 (F2, F4, F5)
**Complexity**: Large (작업 12개, 계획서 9-2 기준 5~6주차)
**선행 조건**: 마일스톤 1의 G2 판정(폰 센서 계속 / 웹캠 단독)이 아직 안 났다. 그래서 찌르기 입력을 **두 방식 모두 지원하는 구조**로 만들고, 판정이 나면 기본값만 바꾼다. 마일스톤 2의 보정·런지 감지를 그대로 재사용한다.

## Summary
노트북 화면에 3D 피스트와 아바타 2개(나·상대)를 띄우고, 웹캠 포즈로 내 위치·런지를, 폰 IMU(또는 웹캠 손목 속도)로 찌르기를 받아 규칙 기반 상대와 에페 1판을 치른다.
경기 규칙·상대 AI·찌르기 융합·피스트 거리 계산은 모두 `packages/core`의 순수 함수로 TDD 하고, 3D 렌더링(Three.js)과 입력 연결만 앱에 둔다. E2E는 포즈와 IMU가 함께 든 합성 기록을 재생해 카메라·폰 없이 돌린다.

## 설계 결정
- **찌르기 입력 두 가지**: `phone`(폰 IMU 피크 + 웹캠 칼 팔 각도 융합, 7-1) / `webcam`(손목의 앞쪽 속도 피크 + 칼 팔 각도). 같은 `ThrustEvent { tMs, source, confidence }`를 내보내 경기 로직은 입력 방식을 모른다.
- **실시간 찌르기 감지**: 지금 `detectThrusts`는 기록 전체를 한 번에 보는 함수다. 프레임마다 넣는 `createThrustDetector`를 만들고, 기존 함수는 이 위에 다시 구현해 평가 스크립트 결과가 같게 유지한다.
- **피스트 좌표**: 엉덩이 중심 x(화면비 공간)를 보정 때 잰 다리 길이로 미터 환산한다. 성인 다리 길이 0.9m를 기본 가정으로 두고, 설정에서 키를 넣으면 키 × 0.47로 바꾼다 (가정, 실측 필요).
- **도달 거리**: 팔 길이(보정값 환산) + 칼 0.9m + 런지 전진량. 계획서 7-1 그대로.
- **동시 타격**: 양쪽 찌르기 시각 차가 40ms 이내면 둘 다 득점 (에페). 시각은 모두 노트북 기준(폰 IMU는 시계 동기화로 변환된 값).
- **상대 AI**: 상태기계 4개(거리 유지·공격·막기·후퇴) + 시드 고정 난수(테스트 재현). 난이도는 반응 지연 400/300/200ms와 막기 확률만 바꾼다(P2 F8의 기초).
- **3D는 상태 구동**: 관절 33개를 리타깃하지 않고 `AvatarState { x, lunge(0~1), armExtend(0~1), parry }`로 미리 만든 동작을 보간한다 (계획서 1-1).
- **루프 분리**: 포즈 추정(15fps 이상)과 렌더링(60fps)을 분리한다. 경기 로직은 포즈·IMU 이벤트가 올 때 진행하고, 렌더러는 마지막 상태를 보간해 그린다.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Naming | `packages/core/src/lunge-detector.ts:44`, `thrust.ts:41` | `create*Detector` 팩토리(프레임마다 호출, 이벤트 또는 null 반환), `detect*` 일괄 함수, 단위 접미사 |
| Types | `packages/core/src/thrust.ts:4,18`, `lunge.ts` | `readonly` interface + `DEFAULT_*` 상수, 결과는 판별 가능한 유니온 |
| Errors | `packages/core/src/geometry.ts:19`, `session.ts:54` | 계산 불가는 `NaN`/`null`, 예외 없음 |
| Logging | — | 패키지 코드는 로그 없음. 앱은 화면 HUD와 메시지 |
| Data access | `apps/laptop/src/pose/pose-source.ts`, `replay-source.ts` | 입력원 인터페이스 + 카메라/재생 구현. IMU도 같은 방식으로 `ImuSource` 추가 |
| Tests | `packages/core/src/lunge-detector.test.ts`, `test-utils/synthetic-pose.ts` | 합성 시퀀스로 시나리오 테스트, 한국어 테스트 이름, E2E는 `?replay=` 재생 |

## Files to Change
| File | Action | Why |
|---|---|---|
| `packages/core/src/thrust.ts` (+test) | UPDATE | `createThrustDetector`(실시간), `detectThrusts`를 그 위로 재구현 |
| `packages/core/src/webcam-thrust.ts` (+test) | CREATE | 웹캠 단독 찌르기: 칼 손목 앞쪽 속도 피크 + 칼 팔 160° 이상 |
| `packages/core/src/thrust-fusion.ts` (+test) | CREATE | IMU 찌르기 ±150ms 안 칼 팔 각도 확인, 팔이 안 보이면 IMU만 인정 (7-1) |
| `packages/core/src/piste.ts` (+test) | CREATE | 화면 → 피스트 미터 환산, 도달 거리, 피스트 끝 판정 |
| `packages/core/src/opponent.ts` (+test) | CREATE | 상대 상태기계, 난이도, 시드 난수 |
| `packages/core/src/bout.ts` (+test) | CREATE | 에페 경기 진행: 타격 판정, 동시 타격 40ms, 5점 또는 3분, 득점 후 준비 자세 리셋, 경기 기록(마일스톤 4 리포트용) |
| `packages/core/src/test-utils/synthetic-session.ts` | CREATE | 포즈 + IMU 찌르기 펄스가 함께 든 합성 기록 (`make-synthetic-session.ts` 확장) |
| `apps/laptop/src/imu/` (`imu-source.ts`, `phone-imu-source.ts`, `replay-imu-source.ts`) | CREATE | 폰 연결(기존 `@fc/link/peer`, 시계 동기화)·기록 재생 IMU 입력원 |
| `apps/laptop/src/arena/` (`scene.ts`, `avatar.ts`, `hud.ts`) | CREATE | Three.js 피스트·아바타 2개·HUD(점수, 시간, 거리, 마지막 판정) |
| `apps/laptop/src/versus/main.ts`, `apps/laptop/versus.html` | CREATE | 흐름: 안전 확인 → 입력 방식 선택(폰+웹캠 / 웹캠만) → 폰 QR 연결(폰 방식일 때) → 위치 안내 → 보정 → 경기 → 결과 |
| `apps/laptop/src/practice/` → `apps/laptop/src/shared/` | UPDATE | 안전 확인·위치 안내·보정 단계를 연습·대결이 함께 쓰도록 분리 |
| `apps/phone/src/` (`main.ts`, 신규 `controller.ts`) | UPDATE / CREATE | 스파이크 센서 페이지를 정식 "칼 컨트롤러" 화면으로 (권한, 화면 꺼짐 방지, 연결 상태 크게) |
| `scripts/make-synthetic-session.ts` | UPDATE | 대결용 합성 기록 출력 옵션 |
| `e2e/versus.spec.ts` | CREATE | 재생 입력으로 경기 1판 진행 확인 |
| `package.json`, `apps/laptop/package.json`, `apps/laptop/vite.config.ts` | UPDATE | `three`, `@types/three`, 대결 페이지 입력 |

## Tasks
### Task 1: 실시간 찌르기 감지
- **Action**: `createThrustDetector(params)` 테스트 먼저. 기존 `thrust.test.ts`의 모든 시나리오를 실시간 버전에도 적용하고, `detectThrusts`를 실시간 감지기로 다시 구현해 기존 테스트가 그대로 통과하게 한다.
- **Mirror**: `lunge-detector.ts:44`
- **Validate**: `npx vitest run packages/core`, `npm run eval:thrust` 결과가 바뀌지 않음(합성 기록)

### Task 2: 웹캠 단독 찌르기
- **Action**: `createWebcamThrustDetector(calibration)` — 칼 손목의 앞쪽 속도(화면비 공간, 팔 길이/초)가 임계값을 넘고 칼 팔 각도 160° 이상이면 찌르기. 디바운스 500ms.
- **Validate**: 합성 시퀀스(팔 뻗기 = 찌르기, 팔 들기·휘두르기 = 아님)

### Task 3: 찌르기 융합
- **Action**: `fuseThrust(imuEvent, poseHistory, calibration)` — 7-1 규칙. 결과 `{ accepted, reason }`(팔 덜 폄 피드백 포함).
- **Validate**: 팔 펴짐/덜 펴짐/팔 안 보임 3경우 테스트

### Task 4: 피스트 좌표
- **Action**: `toPisteMeters`, `reachMeters`, `isOffPiste`. 기본 다리 길이 0.9m 가정, 키 입력 시 대체.
- **Validate**: 알려진 합성 포즈에서 환산 거리 오차 2% 이내

### Task 5: 상대 AI
- **Action**: `createOpponent({ difficulty, seed })` → `step(state, dtMs, userState)`가 다음 상태와 행동(전진·후퇴·런지·막기)을 돌려줌. 거리·반응 지연·확률 규칙은 7-1 표.
- **Validate**: 같은 시드 → 같은 행동열, 거리별 상태 전환, 반응 지연이 난이도대로 적용, 막기 시 득점 무효

### Task 6: 경기 진행
- **Action**: `createBout(options)` — 이벤트(내 찌르기, 상대 찌르기, 시간 경과)를 받아 점수·상태(진행 중/득점 연출/종료)를 갱신. 동시 타격 40ms, 5점 또는 3분, 득점 후 양쪽 준비 위치로 리셋. 경기 기록(타격 시각·거리·런지 판정)을 남긴다.
- **Validate**: 도달 거리 안/밖, 막기, 동시 타격 경계(39/41ms), 5점 종료, 3분 종료, 동점 3분 처리(MVP는 무승부 표시 — 열린 질문으로 기록)

### Task 7: IMU 입력원
- **Action**: `ImuSource` 인터페이스, `PhoneImuSource`(호스트 링크 + `ClockSync`, 노트북 시각으로 변환), `ReplayImuSource`(기록의 imuSamples 재생). 스파이크 `common.ts`의 `ClockSync`를 앱 공용으로 옮긴다.
- **Validate**: 재생 입력원 단위 테스트(가짜 타이머)

### Task 8: 공통 단계 분리
- **Action**: 연습 화면의 안전 확인·위치 안내·보정 흐름을 `shared/`로 옮겨 연습·대결이 함께 쓴다. 동작은 바뀌지 않는다.
- **Validate**: 기존 `e2e/practice.spec.ts` 그대로 통과 (리팩터링 확인)

### Task 9: 3D 아레나
- **Action**: Three.js로 14m 피스트(로우폴리), 아바타 2개(캡슐+원통 칼, 준비/런지/막기 포즈 보간), 카메라는 측면 고정, HUD(점수·시간·거리·마지막 판정). 렌더 루프는 포즈와 분리.
- **Validate**: 빌드, 내장 브라우저에서 60fps 근처 확인(포즈 없이), 번들 크기 앱 페이지 300kB(gzip) 이하

### Task 10: 대결 화면
- **Action**: `versus.html` 흐름 연결, 입력 방식 선택, 폰 QR 연결, 경기 종료 화면(점수, 타격 수, 런지 오류 요약 — 마일스톤 4의 재료). `?replay=`로 포즈+IMU 재생.
- **Validate**: 빌드, 수동 확인(카메라·폰)

### Task 11: 폰 컨트롤러 화면
- **Action**: 스파이크 센서 페이지를 정식 화면으로: 큰 "연결됨/끊김" 표시, 권한 거부 안내, 화면 꺼짐 방지, 진동(찌르기 인정 시, 지원 기기만).
- **Validate**: 빌드, 수동 확인

### Task 12: E2E
- **Action**: 합성 대결 기록(준비 → 전진 → 찌르기 5회, IMU 펄스 포함)을 재생해 `versus.html?replay=`가 5:x로 경기 종료 화면까지 가는지, 웹캠 단독 모드도 같은 기록으로 진행되는지 확인. 상대 AI 시드를 쿼리로 고정.
- **Validate**: `npm run test:e2e`

## Validation
```bash
npm run check            # lint + typecheck + unit
npm run test:coverage    # core·link 80% 이상
npm run test:e2e         # 연습 + 대결 재생 E2E
npm run build
npm run eval:thrust -- fixtures/spike   # 실시간 감지기로 바꾼 뒤에도 같은 결과
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| G2에서 폰 센서가 탈락 | 중 | 입력 방식 두 가지를 처음부터 지원, 기본값만 교체 |
| 포즈 추정 + 3D 렌더링을 함께 돌리면 노트북 fps 하락 | 중 | 렌더 루프 분리, 그림자·안티앨리어싱 끔, 저사양이면 렌더 30fps 제한 |
| 노트북을 측면에 두고 서야 해서 대결 화면이 잘 안 보임 | 높음 | 큰 HUD·소리 알림, 화면 위치 안내 수정 검토. 사용성 시험에서 확인 (열린 질문) |
| 미터 환산 가정(다리 0.9m)이 사람마다 다름 | 중 | 키 입력 설정, 도달 거리 여유를 두고 시험 후 조정 |
| 상대가 너무 쉽거나 어려움 | 중 | 난이도 3단계, 반응 지연·막기 확률을 설정값으로 |
| Three.js 번들 크기 | 낮 | 필요한 모듈만 import, 빌드 크기 확인 |
| 경기 규칙 해석 차이(동점 처리 등) | 낮 | MVP는 무승부 표시, PRD 열린 질문에 기록 |

## Acceptance
- [ ] 작업 1~12 완료
- [ ] `npm run check`, `test:coverage`, `test:e2e`, `build` 통과
- [ ] 재생 입력으로 5점 경기 1판을 끝까지 치름 (E2E)
- [ ] 실제 노트북·폰으로 1판 수동 시연 (팀) — 결과를 `docs/versus-acceptance.md`에 기록
- [ ] 패턴은 위 표를 따르고 새로 만들지 않음
