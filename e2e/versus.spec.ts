import { expect, test, type Page } from '@playwright/test';

// 재생 기록(e2e/fixtures/versus-replay.json, npm run make:fixture:versus로 생성):
// 준비 자세 4초 → 찌르기 5회. 허수아비 상대(dummy=1)는 움직이지도 막지도 않는다.
const REPLAY = '/__e2e__/versus-replay.json';

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname === REPLAY,
    (route) => route.fulfill({ path: 'e2e/fixtures/versus-replay.json' }),
  );
});

async function startBout(page: Page, mode: 'webcam' | 'phone') {
  await page.goto(`/versus.html?replay=${REPLAY}&mode=${mode}&dummy=1&seed=1`);
  await page.getByLabel('손목 스트랩').check();
  await page.getByLabel('주변 2m').check();
  await page.getByRole('button', { name: '시작' }).click();
}

for (const mode of ['webcam', 'phone'] as const) {
  test(`${mode === 'webcam' ? '웹캠만' : '폰 + 웹캠'}: 보정 후 5번 찔러 5:0 승리`, async ({ page }) => {
    await startBout(page, mode);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'bout', { timeout: 10_000 });
    await expect(page.locator('#arena')).toBeVisible();
    await expect(page.locator('#score')).toBeVisible();
    await expect(page.locator('#score')).toHaveText('1 : 0', { timeout: 10_000 });
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'result', { timeout: 20_000 });
    await expect(page.locator('#result-title')).toHaveText('승리');
    await expect(page.locator('#result-score')).toHaveText('5 : 0');
    await expect(page.locator('#result-detail')).toContainText('득점 5');
  });
}

test('입력 방식·난이도를 쿼리로 미리 고를 수 있다', async ({ page }) => {
  await page.goto(`/versus.html?replay=${REPLAY}&mode=webcam&difficulty=hard`);
  await expect(page.getByLabel('웹캠만')).toBeChecked();
  await expect(page.locator('#difficulty')).toHaveValue('hard');
});
