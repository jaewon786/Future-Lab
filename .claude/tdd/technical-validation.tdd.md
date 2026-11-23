# TDD 증거: 기술 검증 (마일스톤 1)

- 원본 계획: `.claude/plans/technical-validation.plan.md`
- 브랜치: `spike/technical-validation` (체크포인트 커밋 유지, 스쿼시 안 함)
- 사용자 여정: 계획서에 따로 없음 → "팀원이 노트북과 폰으로 G2 네 수치를 재고, 기록을 평가해 폰 센서 방식을 계속할지 결정한다" 하나로 정리

## 작업별 기록
| 계획 작업 | 테스트 대상 | RED 커밋 (실패 이유) | GREEN 커밋 (결과) |
| --- | --- | --- | --- |
| Task 1 메시지 검증 | `packages/link/src/protocol.test.ts` | f4e226a (16개 실패, parseMessage 없음) | 76f02ba (16/16) |
| Task 2 시계 동기화 | `packages/link/src/clock-sync.test.ts` | cb62882 (모듈 없음) | a0cbc9f (25/25, link 전체) |
| Task 3 세션 형식 | `packages/core/src/session.test.ts` | d2eb17f (모듈 없음) | 44d2c98 (22/22, core 전체) |
| Task 10·11 피크·찌르기·박수 | `peaks.test.ts`, `thrust.test.ts`, `clap.test.ts` | ca39d8c (모듈 3개 없음) | 8cedca2 (47/47) |
| 리뷰 반영 (평평한 피크, IMU 범위, ISO 날짜, 화면 비율) | 같은 파일 + `session.test.ts` | b879e10 (6개 실패) | 8c4e237 (78/78) |

실행 명령은 모두 `npx vitest run packages` 또는 `npx vitest run packages/<패키지>`.

## 보장 내용
| # | 보장 | 테스트 | 결과 |
| --- | --- | --- | --- |
| 1 | 폰에서 온 형식·범위가 틀린 메시지는 null로 버리고, 모르는 필드는 제거 | `protocol.test.ts` | PASS |
| 2 | 지터 5~45ms에서 시계 차이 추정 오차 5ms 미만 (시드 5개) | `clock-sync.test.ts` | PASS |
| 3 | 세션 기록의 형식·시간 순서·관절 33개·IMU 범위·ISO 날짜를 검사하고 위치를 알려 줌 | `session.test.ts` | PASS |
| 4 | 피크: 임계값·최소 간격·평평한 구간(뒤에 떨어질 때만)·NaN 처리 | `peaks.test.ts` | PASS |
| 5 | 찌르기: y축 펄스 감지, 약한 동작·다른 축·회전 큰 동작 거부, 디바운스 | `thrust.test.ts` | PASS |
| 6 | 평가: 허용 오차 안 짝짓기, 중복 감지는 오탐, 라벨 없으면 NaN | `thrust.test.ts` | PASS |
| 7 | 박수: 손목 최근접(화면 비율 반영)·IMU 스파이크·짝 차이 | `clap.test.ts` | PASS |

## 커버리지
`npm run test:coverage` (core·link, peer.ts 제외): 문장 98.69%, 분기 98.34%, 함수 100%.

## 테스트하지 않은 부분
- `packages/link/src/peer.ts`와 측정 페이지(`apps/*/src/spikes`): 브라우저·WebRTC·카메라·센서가 필요해 단위 테스트 없음. 내장 브라우저에서 두 탭 연결, ping/pong, 두 번째 폰 거절을 수동 확인.
- 카메라·MediaPipe 포즈 추정과 실제 폰 센서: 이 환경에서 확인 불가 → 기기 측정(Task 5~7, 9)에서 확인.
- 평가 스크립트: 합성 기록으로 스모크 테스트만 (실제 데이터 아님).
