/**
 * Depth of focus has a module of its own: the page needs it (to turn a number of DOF into nm) and
 * must not carry the error function of aerial.ts with it. aerial.ts keeps exporting it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dofNm as fromAerial } from '../../src/physics/aerial';
import { constants, type LightSourceId } from '../../src/physics/constants';
import { dofNm } from '../../src/physics/focus';

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];

describe('dofNm (physics/focus.ts)', () => {
  it.each(SOURCES)('%s: k₂·λ/NA²', (source) => {
    const { wavelengthNm, na } = constants.litho.sources[source];
    expect(dofNm(source)).toBeCloseTo(
      (constants.litho.k2.value * wavelengthNm.value) / (na.value * na.value),
      9,
    );
  });

  it('is the function aerial.ts exports', () => {
    expect(fromAerial).toBe(dofNm);
  });

  it('shrinks as the wavelength shrinks and as NA grows: g > i > KrF > ArF', () => {
    const [g, i, krf, arf] = SOURCES.map(dofNm) as [number, number, number, number];
    expect(g).toBeGreaterThan(i);
    expect(i).toBeGreaterThan(krf);
    expect(krf).toBeGreaterThan(arf);
  });

  it('refuses a light source it does not know', () => {
    expect(() => dofNm('x' as LightSourceId)).toThrow(RangeError);
  });

  it('takes values from constants only, so that the page can carry it', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../src/physics/focus.ts', import.meta.url)),
      'utf8',
    );
    const imports = [...source.matchAll(/^import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map(
      (m) => m[1],
    );
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((s) => s === './constants')).toBe(true);
  });
});
