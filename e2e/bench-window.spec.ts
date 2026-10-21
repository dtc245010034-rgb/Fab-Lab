import { expect, test, type Page } from '@playwright/test';

/**
 * The benchmark page also times the M03 process-window chart in the worker (and, with
 * thread=main, on the main thread), so the phone can say whether M03 stays within the 50 ms
 * budget. This checks, in the production build with the real worker, that the numbers show up as
 * real numbers and that the extra table still fits a 380 px screen (CLAUDE.md: no sideways scroll).
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

test('?bench=1 shows the timing of the 25 × 25 chart with real numbers', async ({ page }) => {
  const problems = collectProblems(page);
  await page.goto('/?bench=1');
  const chart = page.getByRole('table', { name: /cửa sổ quy trình/i });
  await expect(chart).toBeVisible({ timeout: 60_000 });
  await expect(chart).toContainText('25×25');

  // count, then median, p95, max with their unit
  const cells = await chart.getByRole('row').nth(1).getByRole('cell').allTextContents();
  expect(cells).toHaveLength(4);
  expect(cells[0]).toBe('30');
  for (const text of cells.slice(1)) expect(text).toMatch(/^\d+,\d ms$/);

  await expectFitsScreen(page);
  expect(problems).toEqual([]);
});

test('?bench=1&thread=main puts the chart’s worker and main-thread numbers side by side', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('/?bench=1&thread=main');
  const chart = page.getByRole('table', { name: /cửa sổ quy trình/i });
  await expect(chart).toBeVisible({ timeout: 60_000 });

  // count, then worker | main thread for the median, the p95 and the max
  const cells = await chart.getByRole('row').nth(2).getByRole('cell').allTextContents();
  expect(cells).toHaveLength(7);
  expect(cells[0]).toBe('30');
  for (const text of cells.slice(1)) expect(text).toMatch(/^\d+,\d$/);

  await expectFitsScreen(page);
  expect(page.workers()).toHaveLength(1); // the main-thread run is on the page, not in a second worker
  expect(problems).toEqual([]);
});
