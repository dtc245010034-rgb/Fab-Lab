import { expect, test } from '@playwright/test';

/**
 * M04 on the default recipe (case B of docs/modules/m04-etch.md), in the production build: the page
 * loads, the simulation Worker answers and the cross-section is drawn. The canvas label comes from
 * the metrics (`describeSection`), so "thủng" means the etch really went through to silicon.
 */
test('the page loads and the worker draws the default M04 cross-section', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
  });

  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', /thủng/);

  // The computation ran in a Worker (there is no fallback to the main thread).
  expect(page.workers()).toHaveLength(1);
  expect(problems).toEqual([]);
});
