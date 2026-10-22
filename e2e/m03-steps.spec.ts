import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * `/m03` steps 3.1 – 3.6 in the production build, on a 380 px screen (docs/DESIGN.md: it must work
 * there, with no sideways scroll): the picture follows the step, the controls move it, the charts
 * of 3.4 fit, and there is one worker and no error all the way. Set M03_SHOTS to a folder to also
 * save a screenshot of each step there (for a look with the eyes; the test does not need it).
 */
test.use({ viewport: { width: 380, height: 800 } });

const WIDTH = 380;

async function open(page: Page) {
  await page.goto('/m03');
  await expect(page.getByRole('img', { name: /oxit trần/i })).toBeVisible();
}

const go = (page: Page, code: string) =>
  page.getByRole('button', { name: new RegExp(`^Bước ${code.replace('.', '\\.')}`) }).click();

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Elements of the lab that stick out past the screen (an equation scrolls inside its own chip). */
const overflowing = (page: Page) =>
  page.evaluate((width) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('.lab *')) {
      if (el.closest('.eq')) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (box.right > width + 0.5 || box.left < -0.5) {
        out.push(
          `${el.tagName.toLowerCase()}.${String(el.getAttribute('class'))} [${box.left.toFixed(0)}, ${box.right.toFixed(0)}]`,
        );
      }
    }
    return out;
  }, WIDTH);

/** Pixels of the cross-section canvas that are exactly the colour of a design token. */
const colourCount = (page: Page, token: string) =>
  page.evaluate((name) => {
    const canvas = document.querySelector('.screen canvas') as HTMLCanvasElement;
    const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === r && data[i + 1] === g && data[i + 2] === b) count++;
    }
    return count;
  }, token);

/** The colours along a horizontal band of the canvas, from `fromFrac` to `toFrac` of its width. */
const coloursAlong = (page: Page, row: number, fromFrac: number, toFrac: number) =>
  page.evaluate(
    ({ row, fromFrac, toFrac }) => {
      const canvas = document.querySelector('.screen canvas') as HTMLCanvasElement;
      const y = Math.round((row / 150) * canvas.height);
      const x0 = Math.round(fromFrac * canvas.width);
      const x1 = Math.round(toFrac * canvas.width);
      const { data } = canvas.getContext('2d')!.getImageData(x0, y, x1 - x0, 1);
      const seen = new Set<string>();
      for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return seen.size;
    },
    { row, fromFrac, toFrac },
  );

async function shot(page: Page, name: string) {
  const folder = process.env.M03_SHOTS;
  if (folder) await page.screenshot({ path: join(folder, `${name}.png`), fullPage: true });
}

/** Text that must not be cut off: a tile, a slider value, the verdict word, a leftover cause, the "Giới hạn" bar. */
const CUT_OFF_CANDIDATES =
  '.metric dd, .metric dt, .ctl-head output, .grade-word, .grade-others li, .limits summary';

const clippedText = (page: Page) =>
  page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)]
        .filter((el) => el.scrollWidth > el.clientWidth)
        .map((el) => el.textContent),
    CUT_OFF_CANDIDATES,
  );

test('every step 3.1 – 3.6 fits 380 px: nothing sticks out, nothing scrolls sideways, no tile is cut, no empty slot', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
  });
  await open(page);
  await page.evaluate(() => document.fonts.ready);

  for (const code of ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6']) {
    await go(page, code);
    await expect(
      page.getByRole('heading', { level: 2, name: new RegExp(`^${code.replace('.', '\\.')} `) }),
    ).toBeVisible();
    if (code === '3.4') {
      await expect(page.getByRole('img', { name: /ảnh trên không/i })).toBeVisible();
      await expect(page.getByRole('img', { name: /cửa sổ quy trình/i })).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    await shot(page, `step-${code}`);
    expect(await sideways(page), `${code}: the page scrolls sideways`).toBeLessThanOrEqual(0);
    expect(await overflowing(page), `${code}: elements outside the screen`).toEqual([]);
    expect(await clippedText(page), `${code}: text cut off`).toEqual([]);
    // every slot of the traveler card has its content, or is left out for good
    await expect(page.getByLabel('Phiếu công đoạn')).not.toContainText('Chưa có nội dung');
    // the verdict belongs to 3.6 alone
    await expect(page.getByLabel('Phán quyết')).toHaveCount(code === '3.6' ? 1 : 0);
  }

  expect(page.workers(), 'one worker for the page').toHaveLength(1);
  expect(problems).toEqual([]);
});

test('the picture follows the step: bare oxide, resist, then the latent image in stripes', async ({
  page,
}) => {
  await open(page);
  expect(await colourCount(page, '--pr'), '3.1 has no resist').toBe(0);

  await go(page, '3.2');
  await expect(page.getByRole('img', { name: /phủ resist dày 500 nm/i })).toBeVisible();
  expect(await colourCount(page, '--pr'), '3.2 has resist').toBeGreaterThan(5000);
  // a row through the middle of the resist film, on the grid and clear of the window: resist only
  expect(await coloursAlong(page, 55, 0.16, 0.3)).toBe(1);

  await go(page, '3.4');
  await expect(page.getByRole('img', { name: /ảnh ẩn/i })).toBeVisible();
  // the same row, through the middle of the window: stripes of resist and air, two colours
  expect(await coloursAlong(page, 55, 0.42, 0.58)).toBe(2);
  expect(await coloursAlong(page, 55, 0.16, 0.3), 'resist beside the window is plain').toBe(1);
});

test('the spin speed slider moves the thickness in the picture description and in the tile', async ({
  page,
}) => {
  await open(page);
  await go(page, '3.2');
  await page.getByRole('slider', { name: 'Tốc độ quay' }).fill('6000');
  // 500 nm × √(3000 / 6000) = 354 nm, the law of the spec (t ∝ ω^-1/2) at the reference point
  await expect(page.getByRole('img', { name: /phủ resist dày 354 nm/i })).toBeVisible();
  await expect(page.getByLabel('Chỉ số của bước').getByText('354 nm')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Tốc độ quay' })).toHaveValue('6000');
});

test('a bake that is too cool shows as a tile with its own word, not only a colour', async ({
  page,
}) => {
  await open(page);
  await go(page, '3.3');
  const tiles = page.getByLabel('Chỉ số của bước');
  await expect(tiles.getByText('Nung đủ')).toBeVisible();
  await page.getByRole('slider', { name: 'Nhiệt độ nung' }).fill('60');
  await expect(tiles.getByText('Nung thiếu')).toBeVisible();
  await expect(tiles.getByText('Đạt')).toHaveCount(0);
});

test('step 3.4: both charts fit, the marker says where the setting is, the source changes the numbers', async ({
  page,
}) => {
  await open(page);
  await go(page, '3.4');
  const chart = page.getByRole('img', { name: /cửa sổ quy trình/i });
  await expect(chart).toBeVisible();
  const caption = page.locator('.chart--window .chart-caption');
  await expect(caption).toContainText('trong vùng đạt'); // dose ×1, best focus: the middle of the window

  for (const name of [/ảnh trên không/i, /cửa sổ quy trình/i]) {
    const box = (await page.getByRole('img', { name }).boundingBox())!;
    expect(box.x + box.width, `${name}`).toBeLessThanOrEqual(WIDTH);
    expect(box.width).toBeGreaterThan(250); // legible, not squeezed
  }

  await page.getByRole('slider', { name: 'Liều chiếu' }).fill('0.7');
  await expect(caption).toContainText('ngoài vùng đạt');
  await page.getByRole('slider', { name: 'Liều chiếu' }).fill('1');
  await expect(caption).toContainText('trong vùng đạt');

  await page.getByRole('button', { name: 'ArF' }).click();
  await expect(page.getByText('λ = 193 nm')).toBeVisible();
  await expect(caption).toContainText('mẫu đạt');
  await shot(page, 'step-3.4-arf');
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Âm' }).click();
  await expect(page.getByRole('img', { name: /ảnh trên không, resist âm/i })).toBeVisible();
});

test('k₁ hiệu dụng is a tile; there is no control for k₁ or k₂', async ({ page }) => {
  await open(page);
  await go(page, '3.4');
  await expect(page.getByLabel('Chỉ số của bước').getByText('k₁ hiệu dụng')).toBeVisible();
  await expect(page.getByRole('slider', { name: /k[₁₂]/ })).toHaveCount(0);
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
});

test('step 3.4: "Giới hạn của mô hình" is shut at first, opens to its list, and the list fits 380 px', async ({
  page,
}) => {
  await open(page);
  await go(page, '3.4');
  const limits = page.locator('details.limits');
  await expect(limits).toBeVisible();
  await expect(limits).not.toHaveAttribute('open', '');
  await expect(page.locator('.limits-body')).toBeHidden();

  await limits.getByText('Giới hạn của mô hình').click();
  await expect(limits).toHaveAttribute('open', '');
  await expect(page.locator('.limits-body')).toContainText('Không có sóng đứng');
  await page.evaluate(() => document.fonts.ready);
  await shot(page, 'step-3.4-limits-open');
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  expect(await overflowing(page)).toEqual([]);
  expect(await clippedText(page)).toEqual([]);
});

test('step 3.6, a print that fails: the verdict is Hỏng, its cause and the others are said, and it fits', async ({
  page,
}) => {
  await open(page);
  await go(page, '3.4');
  await page.getByRole('slider', { name: 'Độ rộng cửa sổ thiết kế' }).fill('400');
  await page.getByRole('slider', { name: 'Liều chiếu' }).fill('0.7');
  await go(page, '3.6');

  const grade = page.getByLabel('Phán quyết');
  await expect(grade.locator('.grade-word')).toHaveText('Hỏng');
  await expect(grade.locator('.grade-why')).toContainText('liều');
  await expect(grade.getByLabel('Nguyên nhân còn lại').getByText('Cặn ở chân')).toBeVisible();
  // a failed print has nothing to "watch": the cautions are for a print that is right
  await expect(page.getByLabel('Lưu ý')).toHaveCount(0);
  // and the tiles say "—" where there is no number, never "Đạt", "Biên" or "Hỏng"
  const tiles = page.getByLabel('Chỉ số của bước');
  await expect(tiles.getByText(/^(Đạt|Biên|Hỏng)$/)).toHaveCount(0);

  await page.evaluate(() => document.fonts.ready);
  await shot(page, 'step-3.6-hong');
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  expect(await overflowing(page)).toEqual([]);
  expect(await clippedText(page)).toEqual([]);
});

test('step 3.6, a print that is right but made with a long develop: Đạt, and a "Lưu ý" beside it', async ({
  page,
}) => {
  await open(page);
  await go(page, '3.6');
  const grade = page.getByLabel('Phán quyết');
  await expect(grade.locator('.grade-word')).toHaveText('Đạt');
  await expect(page.getByLabel('Lưu ý')).toHaveCount(0); // nothing to watch at the default recipe

  await go(page, '3.5');
  await expect(page.getByLabel('Phán quyết')).toHaveCount(0); // the verdict is not at 3.5
  await page.getByRole('slider', { name: 'Thời gian tráng' }).fill('2');
  await expect(page.getByLabel('Chỉ số của bước').getByText('Tráng quá')).toBeVisible();

  await go(page, '3.6');
  await expect(grade.locator('.grade-word')).toHaveText('Đạt');
  const cautions = page.getByLabel('Lưu ý');
  await expect(cautions.getByRole('listitem')).toHaveCount(1);
  await expect(cautions).toContainText('Bản in vẫn đúng, nhưng');
  await expect(page.getByRole('heading', { level: 4, name: 'Lưu ý' })).toBeVisible();
  // the heading sits nearer the list it names (below) than the verdict it is not part of (above)
  const gaps = await page.evaluate(() => {
    const heading = document.querySelector('h4.ctl-title')!.getBoundingClientRect();
    const above = document.querySelector('.grade')!.getBoundingClientRect();
    const below = document.querySelector('ul.cautions')!.getBoundingClientRect();
    return { above: heading.top - above.bottom, below: below.top - heading.bottom };
  });
  expect(gaps.below, 'the Lưu ý heading floats nearer the verdict than its list').toBeLessThan(
    gaps.above,
  );

  await page.evaluate(() => document.fonts.ready);
  await shot(page, 'step-3.6-luu-y');
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  expect(await overflowing(page)).toEqual([]);
  expect(await clippedText(page)).toEqual([]);
});
