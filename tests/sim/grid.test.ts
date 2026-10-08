import { describe, expect, it } from 'vitest';
import { Material } from '../../src/physics/etch';
import { printLitho } from '../../src/physics/litho';
import { DEFAULT_GRID_SPEC } from '../../src/sim/defaults';
import { buildGrid, measureEtch, type GridSpec } from '../../src/sim/grid';
import { BASE_LITHO } from './helpers';

const spec = DEFAULT_GRID_SPEC;
const litho = (over = {}) => printLitho({ ...BASE_LITHO, ...over });

const at = (g: { materials: Uint8Array; widthCells: number }, x: number, y: number) =>
  g.materials[y * g.widthCells + x];
const rowCount = (g: { materials: Uint8Array; widthCells: number }, y: number, m: number) => {
  let n = 0;
  for (let x = 0; x < g.widthCells; x++) if (at(g, x, y) === m) n++;
  return n;
};

describe('DEFAULT_GRID_SPEC', () => {
  it('is the prototype grid and stays inside the 400×250 budget of CLAUDE.md', () => {
    expect(spec).toEqual({ widthCells: 260, heightCells: 150, cellNm: 10, oxideTopRow: 80 });
    expect(spec.widthCells).toBeLessThanOrEqual(400);
    expect(spec.heightCells).toBeLessThanOrEqual(250);
  });
});

describe('buildGrid layers', () => {
  it('stage "ox": air above, 300 nm of oxide, silicon below, no resist', () => {
    const g = buildGrid(spec, litho(), 'ox');
    expect(g.widthCells).toBe(260);
    expect(g.heightCells).toBe(150);
    expect(g.cellNm).toBe(10);
    expect(g.materials.length).toBe(260 * 150);
    expect(g.oxideTopRow).toBe(80);
    expect(g.siTopRow).toBe(110);
    for (let y = 0; y < 150; y++) {
      const expected = y < 80 ? Material.AIR : y < 110 ? Material.OX : Material.SI;
      expect(rowCount(g, y, expected), `row ${y}`).toBe(260);
    }
    expect(g.latent.every((v) => v === 0)).toBe(true);
  });

  it('stage "resist": resist sits on the oxide, as thick as the litho result says', () => {
    const g = buildGrid(spec, litho(), 'resist');
    expect(g.resistRows).toBe(50);
    for (let y = 0; y < 150; y++) {
      const expected =
        y < 30 ? Material.AIR : y < 80 ? Material.PR : y < 110 ? Material.OX : Material.SI;
      expect(rowCount(g, y, expected), `row ${y}`).toBe(260);
    }
  });

  it('resist thickness follows spin speed', () => {
    expect(buildGrid(spec, litho({ spinRpm: 6000 }), 'resist').resistRows).toBe(35);
    expect(buildGrid(spec, litho({ spinRpm: 1500 }), 'resist').resistRows).toBe(71);
  });

  it('keeps the litho result it was built from', () => {
    const l = litho();
    expect(buildGrid(spec, l, 'developed').litho).toBe(l);
  });
});

describe('buildGrid window', () => {
  it('stage "exposed": resist is intact; the latent image marks what will dissolve', () => {
    const g = buildGrid(spec, litho(), 'exposed');
    expect(rowCount(g, 79, Material.PR)).toBe(260);
    let latent = 0;
    for (let x = 0; x < 260; x++) latent += g.latent[79 * 260 + x]!;
    expect(latent).toBe(80); // 800 nm / 10 nm
    for (let y = 0; y < 30; y++) expect(rowCount(g, y, Material.AIR)).toBe(260);
  });

  it('stage "developed": the exposed window is opened down to the oxide', () => {
    const g = buildGrid(spec, litho(), 'developed');
    expect(rowCount(g, 79, Material.AIR)).toBe(80);
    expect(rowCount(g, 79, Material.PR)).toBe(180);
    expect(g.latent.every((v) => v === 0)).toBe(true);
    // oxide and silicon are untouched by development
    expect(rowCount(g, 80, Material.OX)).toBe(260);
    expect(rowCount(g, 110, Material.SI)).toBe(260);
  });

  it('is mirror-symmetric about the window centre in every row, at every stage', () => {
    const mirrorMismatches = (g: ReturnType<typeof buildGrid>) => {
      let n = 0;
      for (let y = 0; y < g.heightCells; y++) {
        for (let x = 0; x < g.widthCells; x++) {
          const i = y * g.widthCells + x;
          const j = y * g.widthCells + (g.widthCells - 1 - x);
          if (g.materials[i] !== g.materials[j] || g.latent[i] !== g.latent[j]) n++;
        }
      }
      return n;
    };
    for (const stage of ['ox', 'resist', 'exposed', 'developed'] as const) {
      for (const designNm of [300, 400, 800]) {
        const g = buildGrid(spec, litho({ designNm }), stage);
        expect(mirrorMismatches(g), `${stage} ${designNm} nm`).toBe(0);
      }
    }
  });

  it('widens the opening towards the top of the resist when the wall is tapered', () => {
    const g = buildGrid(spec, litho({ designNm: 400 }), 'developed'); // taper ≈ 16 nm
    expect(g.litho.taperNm).toBeGreaterThan(0);
    const bottom = rowCount(g, 79, Material.AIR);
    const top = rowCount(g, 30, Material.AIR);
    expect(top).toBeGreaterThan(bottom);
    for (let y = 31; y < 80; y++) {
      expect(rowCount(g, y - 1, Material.AIR)).toBeGreaterThanOrEqual(rowCount(g, y, Material.AIR));
    }
  });

  it('leaves scum: the bottom rows of the window stay resist', () => {
    const l = litho({ dose: 0.7 }); // 180 nm of scum
    const g = buildGrid(spec, l, 'developed');
    const scumRows = Math.round(l.scumNm / spec.cellNm);
    expect(scumRows).toBe(18);
    for (let y = 80 - scumRows; y < 80; y++) {
      expect(at(g, 130, y), `row ${y}`).toBe(Material.PR);
    }
    expect(at(g, 130, 80 - scumRows - 1)).toBe(Material.AIR);
  });

  it('opens nothing when litho failed', () => {
    const g = buildGrid(spec, litho({ designNm: 150 }), 'developed');
    expect(g.materials.filter((m) => m === Material.PR).length).toBe(260 * 50);
  });
});

describe('buildGrid on other grid specs', () => {
  it('scales layer rows with the cell size', () => {
    const coarse: GridSpec = { widthCells: 130, heightCells: 75, cellNm: 20, oxideTopRow: 40 };
    const g = buildGrid(coarse, litho(), 'resist');
    expect(g.siTopRow).toBe(40 + 15); // 300 nm / 20 nm
    expect(g.resistRows).toBe(25); // 500 nm / 20 nm
    expect(rowCount(g, 54, Material.OX)).toBe(130);
    expect(rowCount(g, 55, Material.SI)).toBe(130);
  });

  it('rejects a spec in which the resist or the oxide does not fit', () => {
    expect(() => buildGrid({ ...spec, oxideTopRow: 40 }, litho(), 'resist')).toThrow(RangeError);
    expect(() => buildGrid({ ...spec, heightCells: 100 }, litho(), 'ox')).toThrow(RangeError);
    expect(() => buildGrid({ ...spec, cellNm: 0 }, litho(), 'ox')).toThrow(RangeError);
  });
});

describe('measureEtch', () => {
  const section = buildGrid(spec, litho(), 'developed');
  const field = (arrival: Float64Array, maxTimeMin = Infinity) => ({ arrival, maxTimeMin });
  const never = new Float64Array(section.materials.length).fill(Infinity);

  it('reports an untouched wafer when nothing has been etched', () => {
    const m = measureEtch(section, field(never), 10);
    expect(m.cleared).toBe(false);
    expect(m.topNm).toBe(0);
    expect(m.bottomNm).toBe(0);
    expect(m.undercutNm).toBe(0);
    expect(m.siLossNm).toBe(0);
    expect(m.sidewallAngleDeg).toBe(0);
    expect(m.printedNm).toBe(800);
    expect(m.resistLeftNm).toBe(500);
  });

  it('reads a straight, window-wide cut as no undercut and a vertical wall', () => {
    const t = never.slice();
    for (let y = 80; y < 110; y++) for (let x = 90; x < 170; x++) t[y * 260 + x] = 1;
    const m = measureEtch(section, field(t), 1);
    expect(m.cleared).toBe(true);
    expect(m.topNm).toBe(800);
    expect(m.bottomNm).toBe(800);
    expect(m.undercutNm).toBe(0);
    expect(m.sidewallAngleDeg).toBeCloseTo(90, 9);
  });

  it('counts only cells that have arrived by the given time', () => {
    const t = never.slice();
    for (let y = 80; y < 110; y++) for (let x = 90; x < 170; x++) t[y * 260 + x] = 1;
    expect(measureEtch(section, field(t), 0.99).cleared).toBe(false);
    expect(measureEtch(section, field(t), 1).cleared).toBe(true);
  });

  it('measures silicon loss as the deepest etched column below the oxide', () => {
    const t = never.slice();
    for (let y = 80; y < 114; y++) for (let x = 90; x < 170; x++) t[y * 260 + x] = 1;
    expect(measureEtch(section, field(t), 1).siLossNm).toBe(40);
  });

  it('refuses a time beyond the limit the arrival field was computed for', () => {
    // Cells that arrive after maxTimeMin are stored as Infinity, so reading later would show
    // them as untouched and silently under-report the etch.
    const limited = field(never, 8);
    expect(() => measureEtch(section, limited, 8.001)).toThrow(RangeError);
    expect(() => measureEtch(section, limited, 14)).toThrow(RangeError);
    expect(() => measureEtch(section, limited, 8)).not.toThrow();
    expect(() => measureEtch(section, limited, 0)).not.toThrow();
    expect(() => measureEtch(section, field(never), 1e6)).not.toThrow();
  });

  it('still rejects a negative or NaN time and an arrival array of the wrong size', () => {
    expect(() => measureEtch(section, field(never), -1)).toThrow(RangeError);
    expect(() => measureEtch(section, field(never), Number.NaN)).toThrow(RangeError);
    expect(() => measureEtch(section, field(new Float64Array(10)), 1)).toThrow(RangeError);
  });
});
