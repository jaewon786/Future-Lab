import { defineConfig, devices } from '@playwright/test';

// 노트북 앱을 빌드·미리보기 서버로 띄우고, 카메라 대신 합성 기록 재생(?replay=)으로 화면 흐름을 시험한다.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4180', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build -w @fc/laptop && npm run preview -w @fc/laptop -- --port 4180 --strictPort',
    url: 'http://localhost:4180/practice.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
