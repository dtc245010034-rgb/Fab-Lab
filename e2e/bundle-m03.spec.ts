import { expect, test } from '@playwright/test';

/**
 * Like bundle.spec.ts, for M03: what every visitor downloads for the lab must not carry the M03
 * model (physics/exposure.ts, overlay.ts, special.ts and sim/m03.ts). It runs in the worker. A
 * module that both the page and a lazily loaded chunk import stays whole in the main bundle, so a
 * stray import of M03 code from the page would show up here.
 *
 * The strings are messages of errors thrown inside those files, so they survive minification. The
 * worker bundle must contain them, or the check would pass on a bundle it cannot see into.
 */
const M03_MARKERS = [
  'erfinv needs a value in', // physics/special.ts
  'unknown polarity', // physics/exposure.ts
  'marginNm must be a finite number', // physics/overlay.ts (contactLanding; worstOverlayNm is not used by sim/ yet)
  'unknown M03 request kind', // sim/m03.ts
];

test('the main bundle does not carry the M03 model; the worker does', async ({ page, request }) => {
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
  for (const marker of M03_MARKERS) expect(workerBody).toContain(marker);

  const scripts = (await Promise.all(bodies)).filter((script) => script.url !== worker!.url());
  expect(scripts.length, 'no page script was seen').toBeGreaterThan(0);
  for (const { url, body } of scripts) {
    for (const marker of M03_MARKERS) {
      expect(body, `${url} carries “${marker}”`).not.toContain(marker);
    }
  }
});
