import { expect, test } from '@playwright/test';

/**
 * What every visitor downloads for the lab must not carry the etch search (physics/etch.ts: the
 * search, the rates): it runs in the worker. A module that both the page and a lazily loaded
 * chunk import stays whole in the main bundle, which is how it got there once (the page imported
 * `Material` from etch.ts, and `?bench=1&thread=main` loads the computation with `import()`).
 *
 * The strings are messages of errors thrown inside etch.ts, so they survive minification. The
 * worker bundle must contain them, or the check would pass on a bundle it cannot see into.
 */
const ETCH_MARKERS = ['unknown material code', 'heap capacity exceeded'];

test('the main bundle does not carry the etch search; the worker does', async ({
  page,
  request,
}) => {
  const bodies: Promise<{ url: string; body: string }>[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.js')) {
      bodies.push(response.text().then((body) => ({ url: response.url(), body })));
    }
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();

  const [worker] = page.workers();
  expect(worker).toBeDefined();
  const workerBody = await (await request.get(worker!.url())).text();
  for (const marker of ETCH_MARKERS) expect(workerBody).toContain(marker);

  const scripts = (await Promise.all(bodies)).filter((script) => script.url !== worker!.url());
  expect(scripts.length, 'no page script was seen').toBeGreaterThan(0);
  for (const { url, body } of scripts) {
    for (const marker of ETCH_MARKERS) {
      expect(body, `${url} carries “${marker}”`).not.toContain(marker);
    }
  }
});
