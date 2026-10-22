/**
 * The geometry behind the two charts of step 3.4, as numbers: where the pass cells, the marker, the
 * curves and the levels go in an SVG of a given size. No SVG and no React here; the components in
 * src/ui only put these numbers in the markup.
 */
import { describe, expect, it } from 'vitest';
import {
  aerialLayout,
  linearScale,
  nearestIndex,
  passRuns,
  windowLayout,
} from '../../src/render/charts/chartGeometry';
import { processWindow } from '../../src/physics/processWindow';
import { DEFAULT_M03_RECIPE } from '../../src/sim/defaults';
import { createSession, deriveView, processWindowSpecFor } from '../../src/sim/m03';

describe('linearScale', () => {
  it('maps the ends of the domain to the ends of the range, and in between linearly', () => {
    const f = linearScale([0.7, 1.3], [10, 70]);
    expect(f(0.7)).toBeCloseTo(10, 12);
    expect(f(1.3)).toBeCloseTo(70, 12);
    expect(f(1)).toBeCloseTo(40, 12);
  });

  it('can run backwards (an SVG y axis points down)', () => {
    const f = linearScale([0, 1], [100, 0]);
    expect(f(0)).toBe(100);
    expect(f(1)).toBe(0);
  });

  it('refuses an empty domain', () => {
    expect(() => linearScale([1, 1], [0, 1])).toThrow(RangeError);
  });
});

describe('nearestIndex', () => {
  const values = Float64Array.from([0, 1, 2, 4]);
  it('finds the closest sample, either side', () => {
    expect(nearestIndex(values, 0.4)).toBe(0);
    expect(nearestIndex(values, 0.6)).toBe(1);
    expect(nearestIndex(values, 3.2)).toBe(3);
    expect(nearestIndex(values, -5)).toBe(0);
    expect(nearestIndex(values, 99)).toBe(3);
  });
});

describe('passRuns', () => {
  it('merges neighbouring pass cells of a row into one run, rows kept apart', () => {
    // 5 columns × 3 rows
    const pass = Uint8Array.from([0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(passRuns(pass, 5, 3)).toEqual([
      { row: 0, from: 1, to: 2 },
      { row: 0, from: 4, to: 4 },
      { row: 2, from: 0, to: 4 },
    ]);
  });

  it('covers exactly the cells that pass, on the real chart', () => {
    const w = processWindow(DEFAULT_M03_RECIPE, processWindowSpecFor('i'));
    const columns = w.doses.length;
    const rows = w.defocusNm.length;
    const runs = passRuns(w.pass, columns, rows);
    const covered = new Uint8Array(w.pass.length);
    for (const r of runs) for (let c = r.from; c <= r.to; c++) covered[r.row * columns + c] += 1;
    expect(covered).toEqual(w.pass); // each pass cell exactly once, no other cell
    expect(runs.length).toBeLessThan(w.passCount); // and it did merge
  });

  it('refuses a pass array that is not columns × rows', () => {
    expect(() => passRuns(new Uint8Array(7), 5, 3)).toThrow(RangeError);
  });
});

describe('windowLayout', () => {
  const w = processWindow(DEFAULT_M03_RECIPE, processWindowSpecFor('i'));
  const size = { width: 340, height: 220 };
  const layout = (dose: number, defocusNm: number) => windowLayout(w, { dose, defocusNm }, size);

  it('keeps the plot inside the picture and gives every cell the same size', () => {
    const l = layout(1, 0);
    expect(l.plot.x).toBeGreaterThan(0);
    expect(l.plot.y).toBeGreaterThanOrEqual(0);
    expect(l.plot.x + l.plot.w).toBeLessThanOrEqual(size.width);
    expect(l.plot.y + l.plot.h).toBeLessThanOrEqual(size.height);
    expect(l.cellW * w.doses.length).toBeCloseTo(l.plot.w, 9);
    expect(l.cellH * w.defocusNm.length).toBeCloseTo(l.plot.h, 9);
  });

  it('puts the marker at the middle of the cell of the current dose and focus: best focus, dose ×1 in the centre', () => {
    const l = layout(1, 0);
    expect(l.marker.x).toBeCloseTo(l.plot.x + l.plot.w / 2, 6);
    expect(l.marker.y).toBeCloseTo(l.plot.y + l.plot.h / 2, 6);
  });

  it('moves the marker right with the dose and up with a positive focus offset', () => {
    const base = layout(1, 0).marker;
    expect(layout(1.2, 0).marker.x).toBeGreaterThan(base.x);
    expect(layout(1, 300).marker.y).toBeLessThan(base.y);
    expect(layout(1, -300).marker.y).toBeGreaterThan(base.y);
  });

  it('puts each run where its cells are: the cell of the marker is inside a run exactly when it passes', () => {
    for (const [dose, defocusNm] of [
      [1, 0],
      [1.3, 700],
      [0.7, -700],
      [0.9, 200],
    ] as const) {
      const l = layout(dose, defocusNm);
      const col = nearestIndex(w.doses, dose);
      const row = nearestIndex(w.defocusNm, defocusNm);
      const inside = l.runs.some(
        (r) =>
          l.marker.x > r.x && l.marker.x < r.x + r.w && l.marker.y > r.y && l.marker.y < r.y + r.h,
      );
      expect(inside, `dose ${dose}, focus ${defocusNm}`).toBe(
        w.pass[row * w.doses.length + col] === 1,
      );
    }
  });

  it('labels the dose axis from the first sample to the last and the focus axis through zero', () => {
    const l = layout(1, 0);
    expect(l.xTicks[0]!.value).toBeCloseTo(w.doses[0]!, 12);
    expect(l.xTicks.at(-1)!.value).toBeCloseTo(w.doses.at(-1)!, 12);
    expect(l.yTicks.some((t) => Math.abs(t.value) < 1e-9)).toBe(true);
    expect(l.yTicks[0]!.y).toBeGreaterThan(l.yTicks.at(-1)!.y); // negative focus at the bottom
  });
});

describe('aerialLayout', () => {
  const size = { width: 340, height: 200 };
  const profile = (patch = {}) =>
    deriveView(createSession(1, { ...DEFAULT_M03_RECIPE, ...patch })).aerial;

  it('keeps the plot inside the picture', () => {
    const l = aerialLayout(profile(), size);
    expect(l.plot.x + l.plot.w).toBeLessThanOrEqual(size.width);
    expect(l.plot.y + l.plot.h).toBeLessThanOrEqual(size.height);
  });

  it('draws one point per sample, left to right, for both curves', () => {
    const p = profile();
    const l = aerialLayout(p, size);
    expect(l.curve).toHaveLength(p.xNm.length);
    expect(l.bestFocus).toHaveLength(p.xNm.length);
    for (let i = 1; i < l.curve.length; i++)
      expect(l.curve[i]!.x).toBeGreaterThan(l.curve[i - 1]!.x);
  });

  it('draws higher light higher up, and the centre of the axis at the middle of the plot', () => {
    const l = aerialLayout(profile(), size);
    const mid = (l.curve.length - 1) / 2;
    expect(l.curve[mid]!.x).toBeCloseTo(l.plot.x + l.plot.w / 2, 6);
    expect(l.curve[mid]!.y).toBeLessThan(l.curve[0]!.y); // bright in the middle for a positive resist
  });

  it('puts the foot level above the top level (a higher level is higher up)', () => {
    const l = aerialLayout(profile(), size);
    expect(l.levelFoot.y).toBeLessThan(l.levelTop.y);
    expect(l.levelFoot.clipped).toBe(false);
  });

  it('clips a level that is off the scale, and says so', () => {
    const l = aerialLayout(profile({ dose: 0.7, designNm: 150 }), size);
    // dose 0.7 puts the foot level at 0.5 / 0.7 ≈ 0.71: still on the scale; at an overbake it is not
    const dim = aerialLayout(profile({ dose: 0.7, softBake: { tempC: 130, timeMin: 3 } }), size);
    expect(l.levelFoot.clipped).toBe(false);
    expect(dim.levelFoot.clipped).toBe(true);
    expect(dim.levelFoot.y).toBeCloseTo(dim.plot.y, 9); // pinned to the top edge
  });

  it('draws the ideal mask as 1 inside the slit for a positive resist and 0 inside it for a negative one', () => {
    const at = (patch: object) => {
      const l = aerialLayout(profile(patch), size);
      const centreX = l.plot.x + l.plot.w / 2;
      const inside = l.mask.find((p) => Math.abs(p.x - centreX) < 1)!;
      const outside = l.mask[0]!;
      return { inside: inside.y, outside: outside.y, top: l.plot.y, bottom: l.plot.y + l.plot.h };
    };
    const positive = at({});
    expect(positive.inside).toBeLessThan(positive.outside);
    const negative = at({ polarity: 'negative' });
    expect(negative.inside).toBeGreaterThan(negative.outside);
  });

  it('marks the window edges at the foot and at the top, symmetric about the centre', () => {
    const l = aerialLayout(profile({ designNm: 900 }), size);
    const centre = l.plot.x + l.plot.w / 2;
    expect(l.footEdges[0]).toBeCloseTo(2 * centre - l.footEdges[1], 6);
    expect(l.topEdges[0]).toBeCloseTo(2 * centre - l.topEdges[1], 6);
    expect(l.topEdges[1] - centre).toBeGreaterThan(l.footEdges[1] - centre); // the flared wall
  });
});
