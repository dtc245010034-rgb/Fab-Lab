import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * `/m03` in the production build, on a 380 px screen (docs/DESIGN.md: it must work there, with no
 * sideways scroll): seven steps share the width of the traveler, the equation is typeset by KaTeX
 * when the site is built, and none of what that needs is downloaded by `/`.
 */
test.use({ viewport: { width: 380, height: 800 } });

const ETCH_MARKERS = ['unknown material code', 'heap capacity exceeded']; // physics/etch.ts
const M03_MARKERS = [
  'erfinv needs a value in', // physics/special.ts
  'unknown polarity', // physics/exposure.ts
  'unknown M03 request kind', // sim/m03.ts
];
/** The error KaTeX's parser throws: the engine that typesets, which must not be in the page. */
const KATEX_ENGINE_MARKER = 'KaTeX parse error';
/** In the stylesheet of KaTeX, and in the markup its maths is compiled to. */
const KATEX_FACE = 'KaTeX_Main';
const KATEX_MARKUP = 'katex-html';

/** Everything the page asks the network for, as paths, from the first request until `act` is done. */
async function requestsDuring(page: Page, act: () => Promise<void>): Promise<string[]> {
  const paths: string[] = [];
  page.on('request', (request) => paths.push(new URL(request.url()).pathname));
  await act();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  return paths;
}

test('the page loads with seven steps, one worker, a picture, no error and no sideways scroll', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
  });

  await page.goto('/m03');
  const steps = page.getByRole('navigation', { name: 'Các bước' }).getByRole('button');
  await expect(steps).toHaveCount(7);
  await expect(steps.first()).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { level: 2, name: /^3\.1 / })).toBeVisible();

  // the model runs in a worker: exactly one, and the picture it draws is there (its description names the stage)
  await expect(page.getByRole('img', { name: /oxit trần/i })).toBeVisible();
  expect(page.workers()).toHaveLength(1);
  expect(problems).toEqual([]);

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways, 'the page scrolls sideways').toBeLessThanOrEqual(0);
});

test('every step label fits its button: one line, nothing cut off, wide enough to tap', async ({
  page,
}) => {
  await page.goto('/m03');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);

  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll('.steps button')].map((button) => {
      const frame = button.getBoundingClientRect();
      return {
        top: Math.round(frame.top),
        width: frame.width,
        parts: [...button.children].map((part) => {
          const range = document.createRange();
          range.selectNodeContents(part);
          const text = range.getBoundingClientRect();
          return {
            text: part.textContent,
            lines: range.getClientRects().length,
            spaceLeft: text.left - frame.left,
            spaceRight: frame.right - text.right,
            clipped: part.scrollWidth - part.clientWidth,
          };
        }),
      };
    }),
  );

  expect(buttons).toHaveLength(7);
  // the columns follow the number of steps: seven buttons make one row, not six and one more
  expect(new Set(buttons.map((b) => b.top)).size, 'the steps are on more than one row').toBe(1);
  for (const { width, parts } of buttons) {
    // 348 px of traveler over seven steps is about 49 px each; 44 is the least a finger needs
    expect(
      width,
      `${parts.map((p) => p.text).join(' ')} is ${width} px wide`,
    ).toBeGreaterThanOrEqual(44);
    expect(parts).toHaveLength(2); // the code and the label
    for (const part of parts) {
      const where = `“${part.text}” in a ${width} px button`;
      expect(part.lines, `${where} is on ${part.lines} lines`).toBe(1);
      expect(part.spaceLeft, `${where} starts outside the button`).toBeGreaterThanOrEqual(1);
      expect(part.spaceRight, `${where} ends outside the button`).toBeGreaterThanOrEqual(1);
      expect(part.clipped, `${where} is cut off`).toBeLessThanOrEqual(0);
    }
  }
});

test('the equation of step 3.4 is typeset at build time and fits the screen', async ({ page }) => {
  await page.goto('/m03');
  await page.getByRole('button', { name: /^Bước 3\.4/ }).click();
  const chip = page.getByRole('group', { name: 'Giới hạn phân giải' });
  await expect(chip.locator('.katex')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  // the maths is set in KaTeX's own fonts, which have arrived
  expect(await page.evaluate(() => document.fonts.check('1em KaTeX_Main', 'C'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('italic 1em KaTeX_Math', 'k'))).toBe(true);
  const box = await chip.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(380);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways, 'the page scrolls sideways').toBeLessThanOrEqual(0);
});

test('KaTeX is for /m03 alone: / downloads none of it, /m03 its stylesheet, fonts only for an equation', async ({
  page,
}) => {
  // by what the files contain, not by their names: a page that imported M03 statically would
  // fold its stylesheet and its MDX into the files of /, under the names of /
  const sheets: Promise<string>[] = [];
  const scripts: Promise<string>[] = [];
  page.on('response', (response) => {
    if (response.status() !== 200) return; // a revalidated file has no body to read
    const path = new URL(response.url()).pathname;
    if (path.endsWith('.css')) sheets.push(response.text());
    if (path.endsWith('.js')) scripts.push(response.text());
  });

  const home = await requestsDuring(page, async () => void (await page.goto('/')));
  expect(home.filter((p) => /katex|M03Page/i.test(p))).toEqual([]);
  expect(sheets.length, 'no stylesheet was seen on /').toBeGreaterThan(0);
  expect(scripts.length, 'no script was seen on /').toBeGreaterThan(0);
  for (const css of await Promise.all(sheets)) expect(css).not.toContain(KATEX_FACE);
  for (const js of await Promise.all(scripts)) expect(js).not.toContain(KATEX_MARKUP);

  const m03 = await requestsDuring(page, async () => void (await page.goto('/m03')));
  expect(
    m03.filter((p) => /M03Page-.*.css$/.test(p)),
    'the stylesheet of /m03',
  ).toHaveLength(1);
  expect(
    m03.filter((p) => /KaTeX_/.test(p)),
    'no equation is shown yet, so no font',
  ).toEqual([]);

  const eq = await requestsDuring(page, async () => {
    await page.getByRole('button', { name: /^Bước 3.4/ }).click();
    await expect(page.locator('.katex')).toBeVisible();
  });
  const fonts = eq.filter((p) => /KaTeX_/.test(p));
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.length, 'only the faces the equation uses').toBeLessThanOrEqual(4);
  for (const font of fonts) expect(font, 'woff2 only').toMatch(/.woff2$/);

  // control: what was looked for on / is what /m03 carries, so its absence there meant something
  expect((await Promise.all(sheets)).some((css) => css.includes(KATEX_FACE))).toBe(true);
  expect((await Promise.all(scripts)).some((js) => js.includes(KATEX_MARKUP))).toBe(true);
});

test('the stylesheet of KaTeX names woff2 files only, and carries no font inline', async ({
  page,
  request,
}) => {
  const urls: string[] = [];
  page.on('response', (response) => urls.push(response.url()));
  await page.goto('/m03');
  await page.waitForLoadState('networkidle');
  const sheet = urls.find((u) => /M03Page-.*\.css$/.test(new URL(u).pathname));
  expect(sheet).toBeDefined();
  const css = await (await request.get(sheet!)).text();
  expect(css).toContain('KaTeX_Main'); // it is KaTeX's stylesheet we are reading
  expect(css).not.toMatch(/\.(ttf|woff)\b(?!2)/);
  expect(css).not.toContain('base64');
});

test('the page scripts of /m03 hold neither the KaTeX engine nor the lithography model; the worker holds the model', async ({
  page,
}) => {
  // control: the marker is a string that KaTeX really contains, so its absence means something
  expect(readFileSync('node_modules/katex/dist/katex.mjs', 'utf8')).toContain(KATEX_ENGINE_MARKER);

  const bodies: Promise<{ url: string; body: string }>[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.js')) {
      bodies.push(response.text().then((body) => ({ url: response.url(), body })));
    }
  });
  await page.goto('/m03');
  await page.getByRole('button', { name: /^Bước 3\.4/ }).click();
  await expect(page.locator('.katex')).toBeVisible();
  await expect(page.getByRole('img', { name: /ảnh trên không/i })).toBeVisible(); // the worker has answered

  // the page starts the M03 worker, which is where the model lives: its script is not "the page"
  const [worker] = page.workers();
  expect(worker, 'no worker was started').toBeDefined();
  const everything = await Promise.all(bodies);
  const workerBody = everything.find((s) => s.url === worker!.url())?.body;
  expect(workerBody, 'the worker script was not seen').toBeDefined();
  // control: the markers are strings the model really contains, so their absence from the page means something
  for (const marker of M03_MARKERS) expect(workerBody).toContain(marker);

  const scripts = everything.filter((s) => s.url !== worker!.url());
  expect(
    scripts.some((s) => /M03Page/.test(s.url)),
    'the M03 chunk was not seen',
  ).toBe(true);
  for (const { url, body } of scripts) {
    for (const marker of [KATEX_ENGINE_MARKER, ...M03_MARKERS, ...ETCH_MARKERS]) {
      expect(body, `${url} carries “${marker}”`).not.toContain(marker);
    }
  }
});

test('Greek letters in the monospace font come from its greek subset', async ({ page }) => {
  await page.goto('/m03');
  const requested = await requestsDuring(page, async () => {
    await page.evaluate(() => {
      const probe = document.createElement('p');
      probe.id = 'glyph-probe';
      probe.style.font = '400 14px "JetBrains Mono"';
      probe.textContent = 'λ σ θ μ';
      document.body.append(probe);
    });
  });
  expect(requested.filter((p) => /jetbrains-mono-greek-400-normal.*\.woff2$/.test(p))).toHaveLength(
    1,
  );
  expect(await page.evaluate(() => document.fonts.check('14px "JetBrains Mono"', 'λσθμ'))).toBe(
    true,
  );
});
