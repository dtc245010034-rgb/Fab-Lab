import { describe, expect, it } from 'vitest';
import { Material, MATERIAL_COUNT, type MaterialCode } from '../../src/physics/materials';

describe('Material', () => {
  it('has four distinct codes with air = 0', () => {
    const codes = Object.values(Material);
    expect(new Set(codes).size).toBe(4);
    expect(Material.AIR).toBe(0);
  });

  it('numbers them 0, 1, 2, 3 in the order air, silicon, oxide, resist', () => {
    // grids store these as bytes, and the search in etch.ts indexes tables by them
    expect([Material.AIR, Material.SI, Material.OX, Material.PR]).toEqual([0, 1, 2, 3]);
  });

  it('counts them, so that a table can be indexed by code', () => {
    expect(MATERIAL_COUNT).toBe(4);
    expect(new Set(Object.values(Material))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('types a code as one of the four values', () => {
    const code: MaterialCode = Material.OX;
    expect(code).toBe(2);
  });
});
