import { expect, test, type Page } from '@playwright/test';

/**
 * The benchmark page on a 380 px screen (CLAUDE.md: no horizontal page scroll), in the production
 * build, with the real worker and, for `thread=main`, the real main-thread service loaded by
 * `import()`. The page has to fit by itself: `scrollWidth` of the document is what the browser
 * scrolls sideways, and a table whose right edge is past the screen would be clipped or scrolled.
 */
test.use({ viewport: { width: 380, height: 800 } });

function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
  });
  return problems;
}

async function expectFitsScreen(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(clientWidth);
  for (const table of await page.getByRole('table').all()) {
    const box = (await table.boundingBox())!;
    expect(box.x + box.width, 'a table reaches past the right edge').toBeLessThanOrEqual(
      clientWidth,
    );
  }
}

test('?bench=1&thread=main shows worker and main thread side by side without scrolling sideways', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('/?bench=1&thread=main');

  const total = page.getByRole('table', { name: /runRecipe/ });
  await expect(total).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('table', { name: /arrivalTime/ })).toBeVisible();
  const ratios = page.getByRole('table', { name: /tỉ số trung vị/i });
  await expect(ratios).toBeVisible();

  // real numbers in every cell of the first case: count, then worker/main × median, p95, max
  const cells = await total.getByRole('row').nth(2).getByRole('cell').allTextContents();
  expect(cells).toHaveLength(7);
  for (const text of cells.slice(1)) expect(text).toMatch(/^\d+,\d$/);
  const ratio = await ratios.getByRole('row').nth(1).getByRole('cell').first().textContent();
  expect(ratio).toMatch(/^\d+,\d\d×$/);

  await expectFitsScreen(page);
  // only the benchmark worker: the main-thread run is on the page, not in a second worker
  expect(page.workers()).toHaveLength(1);
  expect(problems).toEqual([]);
});

test('?bench=1 without thread=main still fits a 380 px screen', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('/?bench=1');
  await expect(page.getByRole('table', { name: /runRecipe/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('table', { name: /tỉ số trung vị/i })).toHaveCount(0);
  await expectFitsScreen(page);
  expect(problems).toEqual([]);
});
