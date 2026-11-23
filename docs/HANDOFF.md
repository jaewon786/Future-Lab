# 핸드오프 — 펜싱 코치 (2026-11-23 기준)

새 세션은 이 파일 → `CLAUDE.md` → 필요한 계획 파일 순서로 읽으면 이어서 작업할 수 있다.

## 1. 한 줄 요약
노트북 웹캠(MediaPipe 포즈) + 폰 IMU(WebRTC)로 펜싱 런지를 판정하고, 3D 가상 상대와 에페 대결하는 웹 앱(수업 프로젝트). 1~3단계 코드는 끝났고 팀 실측이 남았다. **다음 결정: 대결 "정면 모드" 계획 승인 대기 중** (아래 6절).

## 2. 링크
| 항목 | 위치 |
| --- | --- |
| 계획서 (Claude Docs) | https://claude.ai/artifact/PZEk5KSf7LCFbqbMqHhJVZ — 제안 5건이 아직 승인 대기 |
| 저장소 | https://github.com/jaewon786/Future-Lab (공개) |
| 배포 (GitHub Pages) | https://jaewon786.github.io/Future-Lab/laptop/ , `/phone/` |
| PRD | `.claude/prds/fencing-coach.prd.md` |
| 계획 | `.claude/plans/technical-validation.plan.md`, `posture-practice.plan.md`, `versus-mode.plan.md` |
| TDD 증거 | `.claude/tdd/technical-validation.tdd.md` |
| 측정·시험 기록 | `docs/spike-report.md`, `docs/practice-acceptance.md`, `docs/versus-acceptance.md` |

## 3. 진행 상황
| 마일스톤 (PRD) | 상태 | 남은 일 (대부분 팀 수작업) |
| --- | --- | --- |
| 0. 환경 (ECC 2.2.3 플러그인, CI, Pages) | 완료 | — |
| 1. 기술 검증 (G2) | 측정 중 | 연결 지연: 같은 Wi-Fi·안드로이드 한 방향 p95 29.8ms ✅. 포즈: 45.4fps(GPU) ✅ — 1대씩만. 남음: 핫스팟·학교 Wi-Fi·아이폰, 다른 노트북, 찌르기 50+50 데이터 수집 → `eval:thrust`, 박수 동기화 → G2 판정 |
| 2. 자세 연습 | 코드·배포 완료 | 실제 카메라 런지 10회 수용 시험, `eval:lunge` 일치율 80% |
| 3. 대결 | 코드·배포 완료 | 실제 기기 1판 시연. **정면 모드** 계획 승인 대기 |
| 4. 경기 후 리포트 | 시작 전 | `/ecc:plan`으로 계획부터 |
| 5. 시연 준비 | 시작 전 | — |

**브랜치**: `main`(717c016)이 최신 배포본. `spike/report-android`에 미머지 커밋 1개(포즈 45.4fps 기록) — 다음 측정과 함께 머지하기로 함. 나머지 브랜치는 머지 끝난 것.

**품질**: 단위 테스트 196개, E2E 6개(연습 3, 대결 3), core·link 커버리지 문장 약 98%·분기 약 95%, CI가 lint·typecheck·coverage·build·E2E 실행.

## 4. 구조
```text
packages/core   순수 판정 로직 (DOM·센서 의존 없음, TDD)
  geometry(화면비 보정) · session(기록 형식) · peaks · thrust(실시간 IMU 찌르기) · clap
  landmarks · smoothing · pose-quality(위치 안내) · calibration · lunge(측정·판정) · lunge-detector · lunge-eval
  webcam-thrust · thrust-fusion · piste(미터 환산) · opponent(상대 AI) · bout(에페 경기)
  test-utils/synthetic-pose.ts, synthetic-session.ts  ← 측면 합성 포즈·대결 기록 생성기
packages/link   protocol(parseMessage 검증) · clock-sync · clock-session · peer(PeerJS, 브라우저 전용)
apps/laptop     practice.html · versus.html · spikes/(pose-fps, link, recorder)
  src/pose(카메라·재생 입력원) · imu(폰·재생) · shared(setup-flow, dom, timeline, phone-url) · arena(three.js) · versus/game.ts
apps/phone      controller.html(칼 컨트롤러) · spikes/sensor.html
scripts         eval-thrust · eval-clap-sync · eval-lunge · make-synthetic-session · make-versus-fixture · prepare-mediapipe.mjs
e2e             practice.spec.ts · versus.spec.ts (+ fixtures, ?replay= 재생으로 카메라 없이)
```

**핵심 설계 (바꿀 때 주의)**
- 측면 카메라 전제: 앞다리·칼 팔은 관절 이름이 아니라 **위치**(앞쪽 발목·손목)로 고른다 — MediaPipe 좌우 뒤바뀜 대응.
- 좌표는 x에 화면비를 곱한 "화면비 공간"에서 각도·거리를 잰다 (`toAspectSpace`).
- 폰 찌르기는 회전 검사 300ms + 팔 확인 150ms만큼 늦게 확정 → 경기는 `resolveDelayMs`(폰 모드 450)만큼 판정을 기다린다.
- 재생(`playTimeline`)은 시작 시각 기준 절대 시간으로 스케줄 (상대 간격으로 이으면 IMU가 수 초 밀림).
- `show()`는 `section[data-screen]`만 바꾼다 (body까지 고르면 페이지 전체가 숨겨지던 버그가 있었음).
- 임계값은 계획서 7-1 초기값. 바꾸면 근거(측정 데이터)를 커밋 메시지에 남긴다.

## 5. 명령
```powershell
npm run check                 # lint + typecheck + unit
npm run test:coverage
npm run test:e2e              # 빌드 + 미리보기 서버 + Playwright
npm run build
npm run eval:thrust -- fixtures/spike
npm run eval:clap-sync -- fixtures/spike
npm run eval:lunge -- fixtures/practice
npm run make:fixture          # e2e/fixtures/practice-replay.json
npm run make:fixture:versus   # e2e/fixtures/versus-replay.json
node scripts/prepare-mediapipe.mjs   # 로컬에서 포즈 모델 받기 (Pages 배포는 자동)
```

## 6. 대기 중인 결정: 대결 "정면 모드" (승인 전, 코드 없음)
사용자 요청: 노트북을 **정면**에 두고 모니터 속 상대를 보며 플레이. 제안한 계획 요지:
- 대결에 측면/정면 선택 추가, 자세 연습은 측면 유지.
- 앞뒤 거리: 몸이 화면에서 커지는 정도(상체 길이 반비례)로 추정, 시작 3m 가정.
- 런지: 몸 크기 급증 + 엉덩이 하강 + 앞발 화면 아래로.
- 찌르기: 폰 IMU 기본. 웹캠만은 MediaPipe z(손목이 어깨보다 카메라 쪽)로 **실험 기능**. 팔 펴짐 확인도 z 기반.
- 3D: 내 아바타 뒤 3인칭 시점. 위치 안내 문구 정면용.
- 작업 9개(정면 합성 포즈 → 보정 → 거리 추적 → 런지 → 찌르기/팔 확인 → 대결 연결 → 3D 시점 → 위치 안내 → E2E).
- 위험: 거리 추정 오차, z 값 신뢰도, 측면 자세(앙 가르드)의 정면 인식.
승인되면 `/ecc:plan`으로 `.claude/plans/versus-front-view.plan.md`를 쓰고 TDD로 진행.

## 7. 작업 방식 (사용자 설정·ECC 규칙)
- 결과 보고는 **한국어, 핵심만 짧게** (메모리 저장됨).
- 검사 통과 후 **커밋·브랜치 푸시는 자동**, **main 머지는 확인 후** (메모리 저장됨). 머지는 PR → CI 통과 확인 → `--merge`(체크포인트 보존, squash 안 함) → Pages 배포 확인.
- 새 작업은 `/ecc:plan` 계획 → 승인 → `tdd-workflow`(RED 커밋 → GREEN 커밋). 큰 변경 후 `ecc:typescript-reviewer` 에이전트로 리뷰하고 HIGH 이상 수정.
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, PR 본문 끝: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## 8. 환경에서 겪은 함정
- **ECC Fact-Forcing 훅**: 새 파일 생성·첫 수정마다 "누가 부르는지 / 기존 파일 없음 / 사용자 지시 원문"을 먼저 밝혀야 통과. 같은 폴더 형제 파일은 한 번 밝히면 통과. 파괴적 명령(git checkout --, rm)은 대상·되돌리기 방법을 먼저 밝힌다.
- **ECC config-protection 훅**: `eslint.config.js` 등 설정 수정 차단 → 설정을 약화하지 말고 원인(예: 생성물이 lint 대상에 들어옴)을 없앤다.
- **CRLF**: 작업 트리 파일이 CRLF라 문자열 검색·치환 스크립트가 빗나갈 수 있음 → Edit 도구 사용 권장.
- **Bash 히어독**: 복잡한 TS를 히어독으로 쓰다 파싱 실패한 적 있음 → Write 도구 사용.
- **`printf` + `%`**: PR 본문에 `%`가 있으면 printf가 깨짐 → `--body-file` 사용.
- **명령 연결**: lint 실패에도 커밋되지 않게 `&&`로 잇는다 (`;` 금지).
- **내장 브라우저**: 카메라 차단, 창이 숨겨지면 레이아웃·스크린샷 불가 → 카메라 확인은 Playwright + `--use-fake-device-for-media-stream`로.
- **E2E가 dist를 다시 빌드**하므로 dist에 손으로 넣은 파일은 사라진다.
- `.bkit/`(bkit 플러그인 상태 폴더)는 커밋하지 않는다.

## 9. 열린 질문
- 팀 인원·마감일·팀원 노트북 사양 (계획은 3인·8주 가정)
- 런지 정상 범위를 검증해 줄 펜싱 경험자
- 3분 동점 처리 (현재 무승부 표시)
- 측면 배치에서 화면이 잘 안 보이는 문제 → 정면 모드로 해결 검토 중
- G2 결과에 따라 폰 센서 계속 / 웹캠 단독 기본값 결정
