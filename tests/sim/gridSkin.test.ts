/**
 * A negative resist can leave a cross-linked skin over the top of its window ("bridging"). The grid
 * draws it as resist in the top rows of the window, the way it already draws scum as resist in the
 * bottom rows, so M04 is blocked by it through the ordinary material rules and needs no rule of
 * its own. Everything else about `buildGrid` is covered by grid.test.ts and is not repeated here.
 */
import { describe, expect, it } from 'vitest';
import { printLitho } from '../../src/physics/litho';
import { Material } from '../../src/physics/materials';
import { DEFAULT_GRID_SPEC } from '../../src/sim/defaults';
import { buildGrid } from '../../src/sim/grid';
import { BASE_LITHO } from './helpers';

const spec = DEFAULT_GRID_SPEC; // 260 × 150, 10 nm cells, oxide from row 80, resist rows 30 … 79
const base = printLitho(BASE_LITHO); // 800 nm window, no scum, no taper
const withSkin = (skinNm: number, over = {}) => ({ ...base, ...over, skinNm });

const cell = (g: { materials: Uint8Array; widthCells: number }, x: number, y: number) =>
  g.materials[y * g.widthCells + x];
/** Centre column of the window (the window spans columns 90 … 169). */
const CX = 130;

describe('buildGrid with a skin over the window', () => {
  it('is the same grid as before when there is no skin, or a skin of zero', () => {
    const plain = buildGrid(spec, base, 'developed');
    expect(buildGrid(spec, withSkin(0), 'developed').materials).toEqual(plain.materials);
    expect(buildGrid(spec, withSkin(4), 'developed').materials).toEqual(plain.materials); // < ½ cell
  });

  it('keeps resist in the top rows of the window and air below, down to the oxide', () => {
    const g = buildGrid(spec, withSkin(100), 'developed'); // 10 rows
    for (let y = 30; y < 40; y++) expect(cell(g, CX, y), `row ${y}`).toBe(Material.PR);
    for (let y = 40; y < 80; y++) expect(cell(g, CX, y), `row ${y}`).toBe(Material.AIR);
    expect(cell(g, CX, 80)).toBe(Material.OX);
  });

  it('leaves everything outside the window, and the window width, as they were', () => {
    const plain = buildGrid(spec, base, 'developed');
    const g = buildGrid(spec, withSkin(100), 'developed');
    for (let y = 0; y < 150; y++) {
      for (let x = 0; x < 260; x++) {
        if (y >= 30 && y < 40) continue; // the skin rows
        expect(cell(g, x, y), `${x},${y}`).toBe(cell(plain, x, y));
      }
    }
    for (let x = 0; x < 260; x++) expect(cell(g, x, 35), `x=${x}`).toBe(Material.PR);
  });

  it('rounds the skin to whole cells', () => {
    const rows = (skinNm: number) => {
      const g = buildGrid(spec, withSkin(skinNm), 'developed');
      let n = 0;
      for (let y = 30; y < 80 && cell(g, CX, y) === Material.PR; y++) n++;
      return n;
    };
    expect(rows(14)).toBe(1);
    expect(rows(16)).toBe(2);
    expect(rows(100)).toBe(10);
  });

  it('can have scum at the foot and a skin on top at once, with air only in between', () => {
    const scummed = { ...base, scumNm: 80 }; // 8 rows at the foot
    const g = buildGrid(spec, { ...scummed, skinNm: 60 }, 'developed'); // 6 rows on top
    for (let y = 30; y < 36; y++) expect(cell(g, CX, y), `skin row ${y}`).toBe(Material.PR);
    for (let y = 36; y < 72; y++) expect(cell(g, CX, y), `window row ${y}`).toBe(Material.AIR);
    for (let y = 72; y < 80; y++) expect(cell(g, CX, y), `scum row ${y}`).toBe(Material.PR);
  });

  it('closes the window altogether when the skin is as thick as the resist', () => {
    for (const skinNm of [500, 800]) {
      const g = buildGrid(spec, withSkin(skinNm), 'developed');
      for (let y = 30; y < 80; y++)
        expect(cell(g, CX, y), `${skinNm} nm, row ${y}`).toBe(Material.PR);
    }
  });

  it('does not mark the skin as latent: the developer does not remove it', () => {
    const g = buildGrid(spec, withSkin(100), 'exposed');
    for (let y = 30; y < 40; y++) expect(g.latent[y * 260 + CX], `row ${y}`).toBe(0);
    for (let y = 40; y < 80; y++) expect(g.latent[y * 260 + CX], `row ${y}`).toBe(1);
    // exposed resist is still all resist at this stage
    for (let y = 30; y < 80; y++) expect(cell(g, CX, y)).toBe(Material.PR);
  });

  it('does nothing before the resist is exposed', () => {
    for (const stage of ['ox', 'resist'] as const) {
      expect(buildGrid(spec, withSkin(100), stage).materials).toEqual(
        buildGrid(spec, base, stage).materials,
      );
    }
  });

  it.each([-10, Number.NaN, Number.POSITIVE_INFINITY])('rejects a skin of %s nm', (skinNm) => {
    expect(() => buildGrid(spec, withSkin(skinNm), 'developed')).toThrow(RangeError);
  });
});
