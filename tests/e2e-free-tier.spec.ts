import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } })

test('test', async ({ page }) => {
  const poolApiKey = process.env.E2E_POOL_API_KEY || process.env.E2E_POOL_KEY
  if (!poolApiKey) {
    throw new Error('Missing E2E pool key. Set E2E_POOL_API_KEY (or E2E_POOL_KEY) in your environment before running this test.')
  }

  const url = `http://localhost:8080/?#e2e_feature_groups=e2e-free-tier&e2e_pool_key=${encodeURIComponent(poolApiKey)}&lang=en&optimize&runs=200&evmVersion&version=soljson-v0.8.34+commit.80d5c536.js`
  await page.goto(url);
  await page.getByRole('button', { name: 'Sign In BETA' }).click();
  await page.getByRole('button', { name: /E2E Test Pool/i }).click();
  await page.getByRole('button', { name: /E2E Pool/i }).first().click();
  await expect(page.getByText('[e2e]-free-tier')).toBeVisible();
  await expect(page.getByRole('button', { name: /Manage/i }).first()).toBeVisible();
  await expect(page.getByText('Your Plan')).toBeVisible();
  await page.getByRole('button', { name: /Manage/i }).first().click();
  await expect(page.getByText('You\'ve used all your credits')).toBeVisible();
  await expect(page.getByRole('button', { name: /Plans/i })).toBeVisible();
  await page.getByRole('button', { name: /Plans/i }).click();
});