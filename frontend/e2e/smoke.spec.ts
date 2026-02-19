import { expect, test } from '@playwright/test';

test('homepage loads', async ({ page }, testInfo) => {
   await page.goto('/');
   await expect(page).toHaveTitle(/Moodeng/i);
   await page.screenshot({ path: testInfo.outputPath('homepage.png'), fullPage: true });
});
