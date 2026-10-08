import { describe, expect, it } from 'vitest';
import { constants } from '../../src/physics/constants';

interface Leaf {
  value: number;
  unit: string;
  tier: string;
  illustrative?: boolean;
  kind: string;
}

/** Every constant entry in the tree, as [dotted.path, entry]. An entry is any object with `tier`. */
function leaves(node: unknown, path: string[] = []): [string, Leaf][] {
  if (node === null || typeof node !== 'object') return [];
  if ('tier' in node) return [[path.join('.'), node as Leaf]];
  return Object.entries(node).flatMap(([key, child]) => leaves(child, [...path, key]));
}

const all = leaves(constants);
const group = (prefix: string) => all.filter(([path]) => path.startsWith(`${prefix}.`));

describe('constants', () => {
  it('is organised in the groups litho, etch.wet, etch.rie and geometry', () => {
    expect(Object.keys(constants).sort()).toEqual(['etch', 'geometry', 'litho']);
    expect(Object.keys(constants.etch).sort()).toEqual(['rie', 'wet']);
    for (const prefix of ['litho', 'etch.wet', 'etch.rie', 'geometry']) {
      expect(group(prefix).length, prefix).toBeGreaterThan(0);
    }
  });

  it('marks every entry as tier C, illustrative, with a unit', () => {
    for (const [path, c] of all) {
      expect(c.tier, path).toBe('C');
      expect(c.illustrative, path).toBe(true);
      expect(c.unit.length, path).toBeGreaterThan(0);
    }
  });

  it('says for every entry whether it is a physical quantity or a model-shape coefficient', () => {
    for (const [path, c] of all) {
      expect(['physical-quantity', 'model-shape'], path).toContain(c.kind);
    }
  });

  it('holds only real numbers; Infinity is allowed solely for "wet etchant does not attack"', () => {
    const infinite = all.filter(([, c]) => !Number.isFinite(c.value)).map(([path]) => path);
    for (const [path, c] of all) expect(Number.isNaN(c.value), path).toBe(false);
    expect(infinite.sort()).toEqual(['etch.wet.resistSelectivity', 'etch.wet.siSelectivity']);
  });

  it('lists the four exposure sources, from long to short wavelength', () => {
    const { sources } = constants.litho;
    const ids = Object.keys(sources);
    expect(ids).toEqual(['g', 'i', 'krf', 'arf']);
    const wavelengths = ids.map((id) => sources[id as keyof typeof sources].wavelengthNm.value);
    expect([...wavelengths].sort((a, b) => b - a)).toEqual(wavelengths);
  });

  it('lists the three wet etchants from slowest to fastest', () => {
    const { etchants } = constants.etch.wet;
    expect(Object.keys(etchants)).toEqual(['boe10', 'boe6', 'hf49']);
    const rates = Object.values(etchants).map((e) => e.rateNmPerMin.value);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  });
});
