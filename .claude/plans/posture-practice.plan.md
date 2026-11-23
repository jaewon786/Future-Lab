# Plan: 자세 연습 모드

**Source PRD**: `.claude/prds/fencing-coach.prd.md`
**Selected Milestone**: 2. 자세 연습 모드 — 사용자가 보정 후 런지를 반복하며 실시간 자세 피드백을 받음 (F1, F3, F6)
**Complexity**: Large (작업 12개, 계획서 9-2 기준 4~5주차)
**선행 조건**: 마일스톤 1(기술 검증)은 측정이 남아 진행 중이다. 이 마일스톤은 웹캠 포즈만 쓰므로 G2의 폰 센서 결정과 무관하게 시작할 수 있다. 단, 포즈 15fps 실측(마일스톤 1의 Task 7)이 실패하면 입력 해상도를 낮춘다.

## Summary
웹캠 포즈로 런지를 감지하고 계획서 7-1의 자세 규칙(앞무릎 90~120°, 무릎-발끝, 뒷다리 160° 이상, 상체 20° 이하, 칼 팔 160° 이상)으로 정상/오류를 판정해 화면에 바로 보여 준다.
판정 로직은 전부 `packages/core`에 순수 함수로 두고 합성 포즈와 기록 재생으로 TDD 한다. 앱 화면은 안전 확인 → 카메라 위치 안내 → 보정(준비 자세 3초) → 연습의 4단계이고, 카메라 대신 기록을 재생하는 입력원을 두어 E2E 테스트를 카메라 없이 돌린다.

## 설계 결정
- **화면 비율 보정**: MediaPipe 좌표는 x는 너비, y는 높이 기준이라 그대로 각도를 재면 4:3 화면에서 왜곡된다. 각도·거리 계산 전 x에 화면비를 곱한다 (마일스톤 1 리뷰에서 박수 거리로 확인한 문제와 같음).
- **앞발/뒷발 구분**: 측면 촬영에서는 MediaPipe가 왼쪽·오른쪽 다리를 바꿔 붙이는 경우가 있다. 관절 이름(LEFT/RIGHT) 대신 보정 때 정한 "앞쪽 방향"을 기준으로 발목 위치가 앞인 쪽을 앞다리로 본다.
- **왼손잡이**: 칼 팔을 손잡이 설정(오른손/왼손)으로 고른다. 앞다리는 위 위치 기준이라 손잡이와 무관하다.
- **떨림**: 판정 전 관절 좌표에 지수 이동 평균(α=0.5, 15fps 기준 약 2프레임 지연)을 건다.
- **판정 시점**: 런지 정점(두 발목 간격 최대)에서 한 번 판정한다. 매 프레임 판정하면 메시지가 깜빡인다.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Naming | `packages/core/src/geometry.ts:12`, `thrust.ts:41` | kebab-case 파일, 동사+명사 camelCase(`detectThrusts`, `jointAngleDeg`), 단위 접미사(`Deg`, `Ms`) |
| Types | `packages/core/src/thrust.ts:4,18` | 파라미터는 `readonly` interface + `DEFAULT_*` 상수, 호출 쪽에서 스프레드로 덮어씀 |
| Errors | `packages/core/src/geometry.ts:19`, `session.ts:54` | 계산 불가는 `NaN`/`null`(판정 보류), 검증은 `{ ok: true, … } \| { ok: false, errors }` 결과 객체. 예외를 던지지 않음 |
| Logging | — | 패키지 코드는 로그 없음. 앱은 화면 메시지로만 알림 |
| Data access | `packages/core/src/session.ts:43`, `scripts/lib/load-sessions.ts` | 기록은 `SessionRecording` JSON, 스크립트는 `loadSessions()`로 읽고 검증 |
| Tests | `packages/core/src/thrust.test.ts` (`signal()` 생성기) | 같은 폴더 `*.test.ts`, 합성 입력 생성 함수로 시나리오를 만들고 한국어 테스트 이름 |

## Files to Change
| File | Action | Why |
|---|---|---|
| `packages/core/src/geometry.ts` (+test) | UPDATE | `toAspectSpace(landmark, aspect)`, 화면비 보정 각도 `jointAngleAspectDeg` |
| `packages/core/src/test-utils/synthetic-pose.ts` | CREATE | 준비 자세·런지 정점·오류 자세를 관절 각도로 만드는 합성 포즈 생성기 (테스트 전용) |
| `packages/core/src/smoothing.ts` (+test) | CREATE | 관절 좌표 지수 이동 평균, 신뢰도 낮은 관절은 이전 값 유지 |
| `packages/core/src/pose-quality.ts` (+test) | CREATE | 필요 관절 신뢰도·화면 안 여부·몸 크기로 위치 안내 메시지 ("뒤로 물러나세요", "전신이 보이게") |
| `packages/core/src/calibration.ts` (+test) | CREATE | 준비 자세 N프레임에서 앞쪽 방향, 준비 보폭, 팔 길이, 다리 길이 중앙값과 안정성 검사 |
| `packages/core/src/lunge.ts` (+test) | CREATE | `measureLunge`(앞무릎·뒷무릎·상체·칼 팔 각도, 무릎-발끝, 보폭비) + `judgeLunge`(규칙 → 오류 목록·문구) |
| `packages/core/src/lunge-detector.ts` (+test) | CREATE | 준비 → 진행 → 정점 → 복귀 상태기계, 정점에서 `LungeEvent` 발생 (보폭비 1.8배·히스테리시스) |
| `packages/core/src/session.ts` (+test) | UPDATE | 라벨 종류에 `lunge-good`, `lunge-bad` 추가 (기존 기록과 호환, 버전 1 유지) |
| `apps/laptop/src/pose/` (`pose-source.ts`, `camera-source.ts`, `replay-source.ts`, `mediapipe.ts`) | CREATE | 카메라/기록 재생을 같은 인터페이스로. 스파이크의 `pose.ts`를 옮겨 정리 |
| `apps/laptop/src/practice/` (`main.ts`, `screens.ts`, `feedback.ts`, `settings.ts`) | CREATE | 안전 확인 → 위치 안내 → 보정 → 연습 화면, 손잡이 설정(localStorage), 런지별 피드백 카드·누적 횟수 |
| `apps/laptop/practice.html`, `apps/laptop/vite.config.ts` | CREATE / UPDATE | 연습 페이지 입력 추가 |
| `apps/laptop/src/spikes/recorder.ts`, `recorder.html` | UPDATE | 키 G(좋은 런지)/B(나쁜 런지) 라벨 추가 |
| `scripts/eval-lunge.ts` | CREATE | 기록의 G/B 라벨과 판정 일치율 계산 (PRD 지표: 80% 이상) |
| `e2e/practice.spec.ts`, `playwright.config.ts` | CREATE | 재생 입력으로 보정 → 런지 3회 → 피드백 표시까지 확인 |
| `package.json`, `.github/workflows/ci.yml` | UPDATE | `@playwright/test`, `test:e2e`, `eval:lunge` 스크립트, CI에 E2E 추가 |

## Tasks
### Task 1: 화면비 보정 기하 함수
- **Action**: `toAspectSpace`, `jointAngleAspectDeg`를 테스트 먼저 만든다. 4:3에서 정규화 좌표 직각이 실제로는 직각이 아닌 경우를 테스트로 고정한다.
- **Mirror**: `geometry.ts:12`, `geometry.test.ts`
- **Validate**: `npx vitest run packages/core`

### Task 2: 합성 포즈 생성기 (테스트 도구)
- **Action**: 엉덩이·무릎·발목·어깨·팔꿈치·손목 위치를 각도(앞무릎, 뒷무릎, 상체 기울기, 칼 팔)와 방향(오른쪽/왼쪽)으로부터 만드는 함수. 33개 관절을 채우고 신뢰도도 지정 가능.
- **Mirror**: `thrust.test.ts`의 `signal()` 방식
- **Validate**: 생성한 포즈를 `jointAngleAspectDeg`로 다시 재면 넣은 각도와 1° 이내

### Task 3: 좌표 평활화
- **Action**: `createLandmarkSmoother(alpha)` — 프레임마다 EMA, 신뢰도 0.5 미만 관절은 이전 값 유지·신뢰도 낮음 표시.
- **Validate**: 계단 입력에 대한 응답, 신뢰도 낮은 프레임 무시 테스트

### Task 4: 위치 안내
- **Action**: `checkFraming(landmarks, aspect)` → `{ ok } | { ok: false, hints[] }`. 어깨·엉덩이·무릎·발목·손목 신뢰도, 화면 안(0.02~0.98), 몸 높이가 화면의 40~90%.
- **Mirror**: `session.ts:54` 결과 객체
- **Validate**: 너무 가까움·멀리·발 잘림·신뢰도 낮음 각각 테스트

### Task 5: 보정
- **Action**: `calibrate(frames, handedness)` → 앞쪽 방향(+1/−1), 준비 보폭, 팔 길이, 다리 길이. 3초(약 45프레임) 동안 보폭 변동이 10% 넘으면 `{ ok: false, errors: ['움직이지 말고 준비 자세를 유지하세요'] }`.
- **Validate**: 오른쪽/왼쪽을 보는 합성 준비 자세, 흔들리는 입력 테스트

### Task 6: 런지 측정·판정
- **Action**: `measureLunge(landmarks, calibration, aspect)`와 `judgeLunge(features, rules)`. 규칙 기본값은 계획서 7-1. 결과는 `{ ok, errors: { code, message }[] }`, 문구는 7-1의 피드백 문구.
- **Validate**: 정상 런지 1개 + 오류 6종(무릎 덜 굽힘·너무 깊음·무릎이 발끝 넘음·뒷다리 굽음·상체 기울어짐·팔 덜 폄) 각각 합성 포즈로 테스트. 관절이 겹치면 해당 항목만 판정 보류

### Task 7: 런지 감지 상태기계
- **Action**: `createLungeDetector(calibration, opts)` — 프레임을 넣으면 정점에서 `LungeEvent { tMs, features, judgment }`를 1회 내보냄. 보폭비 1.8배 진입·1.4배 미만 복귀(히스테리시스), 최소 간격 600ms.
- **Validate**: 합성 시퀀스 "준비 → 런지 → 복귀" 10회에서 10회 감지(F3 수용 기준), 반쯤 내딛다 멈춤은 0회, 떨림이 있어도 중복 감지 없음

### Task 8: 라벨 확장과 일치율 평가
- **Action**: `LABEL_KINDS`에 `lunge-good`, `lunge-bad` 추가(테스트 먼저), 기록기에 G/B 키, `scripts/eval-lunge.ts`로 기록마다 감지된 런지와 G/B 라벨을 ±500ms로 짝지어 판정 일치율 계산.
- **Mirror**: `scripts/eval-thrust.ts`, `load-sessions.ts`
- **Validate**: 합성 기록 스모크 테스트, 실제 기록은 팀이 수집 후 `npm run eval:lunge`

### Task 9: 포즈 입력원 정리
- **Action**: `PoseSource { start(onFrame), stop() }` 인터페이스, `CameraPoseSource`(MediaPipe), `ReplayPoseSource`(SessionRecording의 poseFrames를 원래 시간 간격으로 재생). 스파이크 `pose.ts`를 옮긴다.
- **Validate**: 재생 입력원 단위 테스트(가짜 타이머), 빌드

### Task 10: 연습 화면
- **Action**: `practice.html` — 1) 안전 확인(손목 스트랩·주변 2m, 확인 버튼) 2) 위치 안내(Task 4 문구 실시간) 3) 보정(3초 카운트다운) 4) 연습(관절 오버레이, 런지마다 정상/오류 카드와 문구, 누적 횟수·오류 빈도). 손잡이 설정 저장. 영상은 저장·전송하지 않음.
- **Mirror**: 스파이크 페이지의 `el()`·상태 표시 방식, 한국어 UI
- **Validate**: 빌드, 수동 확인(카메라 필요)

### Task 11: E2E
- **Action**: Playwright로 `practice.html?replay=<fixture>`를 열어 안전 확인 → 보정 → 런지 3회 피드백 카드 표시 → 오류 런지에서 문구 표시를 확인. 재생용 기록은 Task 2 생성기로 만든 합성 기록을 `e2e/fixtures/`에 둔다.
- **Mirror**: ECC `e2e-testing` 스킬
- **Validate**: `npm run test:e2e` (CI에도 추가)

### Task 12: 수동 수용 시험
- **Action**: 팀원 1명이 실제 카메라로 런지 10회(정상 5·오류 5)를 하고 감지 수·판정 결과를 `docs/practice-acceptance.md`에 기록. 같은 세션을 기록기로 남겨 `eval:lunge`로 일치율 계산.
- **Validate**: 10회 모두 감지, 일치율 80% 이상이면 PRD 마일스톤 2 complete

## Validation
```bash
npm run check            # lint + typecheck + unit
npm run test:coverage    # core·link 80% 이상
npm run test:e2e         # 재생 입력 E2E
npm run build
npm run eval:lunge -- fixtures/practice
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| 측면 촬영에서 먼 쪽 다리가 가려져 신뢰도가 낮음 | 높음 | 런지 정점에서는 두 다리가 벌어져 대부분 보임. 가려진 항목만 판정 보류하고 "판정 못 함"으로 표시 |
| MediaPipe가 왼·오른 다리를 바꿔 붙임 | 중 | 관절 이름 대신 앞쪽 방향 기준 위치로 앞다리 결정 (설계 결정) |
| 카메라가 피스트와 정확히 수직이 아님 | 중 | 위치 안내에서 어깨 너비가 몸 높이에 비해 크면 "노트북을 옆으로 옮기세요" 안내 |
| 7-1 정상 범위가 실제 지도 기준과 다름 | 중 | 규칙 값을 설정으로 빼고, PRD 열린 질문(펜싱 경험자 검증) 결과로 조정 |
| 합성 포즈로 통과해도 실제 포즈에서 실패 | 중 | Task 12 실측과 `eval:lunge`로 확인, 실패 사례를 `fixtures/`에 추가해 회귀 테스트화 |
| 판정 메시지가 깜빡이거나 늦음 | 낮 | 정점 1회 판정, EMA 지연 약 2프레임 |

## Acceptance
- [ ] 작업 1~12 완료
- [ ] `npm run check`, `test:coverage`, `test:e2e`, `build` 통과
- [ ] 실제 카메라 런지 10회 모두 감지 (F3)
- [ ] 판정 일치율 80% 이상 (PRD 지표) 또는 미달 시 원인과 조정 계획 기록
- [ ] 패턴은 위 표를 따르고 새로 만들지 않음
