# 펜싱 코치 (fencing-coach)

노트북 웹캠과 폰 센서만으로 런지(찌르기) 자세를 분석하고 3D 가상 상대와 대결하는 웹 앱입니다.
계획서: [펜싱 코치 앱 PRD 및 ECC 개발 계획](https://claude.ai/artifact/PZEk5KSf7LCFbqbMqHhJVZ)

## 구조

| 경로 | 역할 |
| --- | --- |
| `apps/laptop` | 웹캠·포즈·3D·게임 화면 (Vite) |
| `apps/phone` | 센서 권한·전송 화면 (Vite) |
| `packages/core` | 순수 판정 로직 (런지, 찌르기, 융합, 상대, 점수) |
| `packages/link` | WebRTC 연결, 시계 동기화, 메시지 형식 |
| `fixtures` | 기록한 세션 JSON (테스트 재생용) |

## 명령

```bash
npm install
npm run check          # lint + typecheck + test
npm run test:coverage  # core 커버리지 80% 기준
npm run dev:laptop     # 노트북 화면 개발 서버
npm run dev:phone      # 폰 화면 개발 서버
```

Node 22 이상이 필요합니다.
