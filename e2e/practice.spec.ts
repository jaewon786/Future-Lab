import { expect, test } from '@playwright/test';

// 재생 기록(e2e/fixtures/practice-replay.json, npm run make:fixture로 생성):
// 준비 자세 4초 → 정상 런지 → 상체 기울어진 런지 → 정상 런지
const REPLAY = '/__e2e__/practice-replay.json';

test.beforeEach(async ({ page }) => {
  // 경로로만 맞춘다 (페이지 주소의 ?replay= 쿼리에도 같은 문자열이 들어 있음)
  await page.route(
    (url) => url.pathname === REPLAY,
    (route) => route.fulfill({ path: 'e2e/fixtures/practice-replay.json' }),
  );
});

test('안전 확인을 해야 시작할 수 있다', async ({ page }) => {
  await page.goto(`/practice.html?replay=${REPLAY}`);
  const begin = page.getByRole('button', { name: '시작' });
  await expect(begin).toBeDisabled();
  await page.getByLabel('손목 스트랩').check();
  await expect(begin).toBeDisabled();
  await page.getByLabel('주변 2m').check();
  await expect(begin).toBeEnabled();
});

test('보정 후 런지 3회에 각각 피드백 카드가 뜨고 오류 런지는 고칠 점을 보여 준다', async ({ page }) => {
  await page.goto(`/practice.html?replay=${REPLAY}`);
  await page.getByLabel('손목 스트랩').check();
  await page.getByLabel('주변 2m').check();
  await page.getByRole('button', { name: '시작' }).click();

  await expect(page.locator('body')).toHaveAttribute('data-screen', 'practice', { timeout: 10_000 });

  const cards = page.locator('[data-testid="lunge-card"]');
  await expect(cards).toHaveCount(3, { timeout: 15_000 });
  // 새 카드가 위에 쌓인다: 맨 아래가 1회
  await expect(cards.nth(2)).toContainText('1회 — 좋은 런지');
  await expect(cards.nth(1)).toContainText('2회 — 고칠 점 1개');
  await expect(cards.nth(1)).toContainText('상체를 세우세요');
  await expect(cards.nth(0)).toContainText('3회 — 좋은 런지');
  await expect(page.locator('#stats')).toHaveText('총 3회 · 좋은 런지 2회 · 상체를 세우세요 1회');
});

test('손잡이 설정을 기억한다', async ({ page }) => {
  await page.goto(`/practice.html?replay=${REPLAY}`);
  await page.getByLabel('왼손잡이').check();
  await page.getByLabel('손목 스트랩').check();
  await page.getByLabel('주변 2m').check();
  await page.getByRole('button', { name: '시작' }).click();
  await page.reload();
  await expect(page.getByLabel('왼손잡이')).toBeChecked();
});
