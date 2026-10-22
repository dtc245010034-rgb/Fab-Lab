/**
 * Geometry of the two charts of M03 step 3.4 (the process window and the aerial image): where
 * things go in an SVG of a given size, as numbers. Pure; the React components in src/ui put these
 * numbers in the markup and choose the colours (CSS, from the design tokens).
 */
import type { AerialProfile } from '../../physics/exposure';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Room around a plot for the axis labels, svg units. */
export const CHART_MARGIN = { left: 46, right: 12, top: 10, bottom: 36 } as const;

function plotBox(size: Size): Box {
  const { left, right, top, bottom } = CHART_MARGIN;
  return {
    x: left,
    y: top,
    w: Math.max(1, size.width - left - right),
    h: Math.max(1, size.height - top - bottom),
  };
}

/** value → coordinate, linear; the range may run backwards (an SVG y axis points down). */
export function linearScale(
  [d0, d1]: readonly [number, number],
  [r0, r1]: readonly [number, number],
): (value: number) => number {
  if (!(d1 !== d0) || !Number.isFinite(d0) || !Number.isFinite(d1)) {
    throw new RangeError(`a scale needs a finite, non-empty domain, got ${d0} … ${d1}`);
  }
  return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/** Index of the sample closest to `value` (the first one on a tie). */
export function nearestIndex(values: ArrayLike<number>, value: number): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i]! - value) < Math.abs(values[best]! - value)) best = i;
  }
  return best;
}

// --- the process window ---------------------------------------------------------------------------

/** Neighbouring pass cells of one row, columns `from` … `to` inclusive. Row 0 is the lowest focus. */
export interface PassRun {
  row: number;
  from: number;
  to: number;
}

/** The pass cells of a chart (row-major, `columns` per row) as the fewest horizontal runs. */
export function passRuns(pass: Uint8Array, columns: number, rows: number): PassRun[] {
  if (pass.length !== columns * rows) {
    throw new RangeError(`pass has ${pass.length} cells, the chart is ${columns} × ${rows}`);
  }
  const runs: PassRun[] = [];
  for (let row = 0; row < rows; row++) {
    let from = -1;
    for (let column = 0; column <= columns; column++) {
      const on = column < columns && pass[row * columns + column] === 1;
      if (on && from < 0) from = column;
      if (!on && from >= 0) {
        runs.push({ row, from, to: column - 1 });
        from = -1;
      }
    }
  }
  return runs;
}

export interface WindowLike {
  doses: ArrayLike<number>;
  defocusNm: ArrayLike<number>;
  pass: Uint8Array;
}

export interface WindowLayout {
  plot: Box;
  cellW: number;
  cellH: number;
  /** The pass runs as rectangles, lowest focus at the bottom. */
  runs: Box[];
  /** The current dose and focus: the middle of the cell when they lie on a sample. */
  marker: Point;
  xTicks: { x: number; value: number }[];
  yTicks: { y: number; value: number }[];
}

/** Five labelled positions along an axis of `n` samples: both ends, the middle and the quarters. */
function tickIndices(n: number): number[] {
  return [0, 1, 2, 3, 4].map((k) => Math.round((k * (n - 1)) / 4));
}

export function windowLayout(
  window: WindowLike,
  current: { dose: number; defocusNm: number },
  size: Size,
): WindowLayout {
  const columns = window.doses.length;
  const rows = window.defocusNm.length;
  const plot = plotBox(size);
  const cellW = plot.w / columns;
  const cellH = plot.h / rows;
  const rowTop = (row: number) => plot.y + (rows - 1 - row) * cellH; // focus grows upwards

  const runs = passRuns(window.pass, columns, rows).map((r) => ({
    x: plot.x + r.from * cellW,
    y: rowTop(r.row),
    w: (r.to - r.from + 1) * cellW,
    h: cellH,
  }));

  const along = (values: ArrayLike<number>, value: number) => {
    const first = values[0]!;
    const last = values[values.length - 1]!;
    return Math.min(1, Math.max(0, (value - first) / (last - first)));
  };
  const marker = {
    x: plot.x + cellW / 2 + along(window.doses, current.dose) * (plot.w - cellW),
    y: plot.y + plot.h - cellH / 2 - along(window.defocusNm, current.defocusNm) * (plot.h - cellH),
  };

  return {
    plot,
    cellW,
    cellH,
    runs,
    marker,
    xTicks: tickIndices(columns).map((i) => ({
      x: plot.x + (i + 0.5) * cellW,
      value: window.doses[i]!,
    })),
    yTicks: tickIndices(rows).map((i) => ({
      y: rowTop(i) + cellH / 2,
      value: window.defocusNm[i]!,
    })),
  };
}

// --- the aerial image -----------------------------------------------------------------------------

/** The top of the light scale: a little above 1, so a curve at 1 does not touch the frame. */
export const AERIAL_Y_MAX = 1.05;

export interface LevelLine {
  /** The level itself, 0 … ; may be above the scale. */
  value: number;
  y: number;
  /** The level is above the scale and drawn on its top edge. */
  clipped: boolean;
}

export interface AerialLayout {
  plot: Box;
  curve: Point[];
  bestFocus: Point[];
  /** The mask's own image with no blur at all: a step, dashed in the chart. */
  mask: Point[];
  levelTop: LevelLine;
  levelFoot: LevelLine;
  /** x of the two window edges at the top and at the foot of the film: left, right. */
  topEdges: [number, number];
  footEdges: [number, number];
  xTicks: { x: number; value: number }[];
  yTicks: { y: number; value: number }[];
}

/** 1, 2 or 5 times a power of ten, at least `raw`. */
function niceStep(raw: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * power >= raw) return m * power;
  return 10 * power;
}

export function aerialLayout(profile: AerialProfile, size: Size): AerialLayout {
  const plot = plotBox(size);
  const half = profile.xNm[profile.xNm.length - 1]!;
  const x = linearScale([-half, half], [plot.x, plot.x + plot.w]);
  const y = linearScale([0, AERIAL_Y_MAX], [plot.y + plot.h, plot.y]);
  const line = (value: number): LevelLine => ({
    value,
    y: y(Math.min(value, AERIAL_Y_MAX)),
    clipped: value > AERIAL_Y_MAX,
  });
  const trace = (values: Float64Array): Point[] =>
    Array.from(values, (v, i) => ({ x: x(profile.xNm[i]!), y: y(v) }));

  const inside = profile.polarity === 'positive' ? 1 : 0;
  const slit = profile.designNm / 2;
  const mask: Point[] = [
    [-half, 1 - inside],
    [-slit, 1 - inside],
    [-slit, inside],
    [0, inside],
    [slit, inside],
    [slit, 1 - inside],
    [half, 1 - inside],
  ].map(([px, py]) => ({ x: x(px!), y: y(py!) }));

  const step = niceStep((2 * half) / 5);
  const reach = Math.floor(half / step);
  const xTicks = Array.from({ length: 2 * reach + 1 }, (_, k) => {
    const value = (k - reach) * step;
    return { x: x(value), value };
  });

  return {
    plot,
    curve: trace(profile.intensity),
    bestFocus: trace(profile.bestFocusIntensity),
    mask,
    levelTop: line(profile.levelTop),
    levelFoot: line(profile.levelFoot),
    topEdges: [x(-profile.edgeTopNm), x(profile.edgeTopNm)],
    footEdges: [x(-profile.edgeFootNm), x(profile.edgeFootNm)],
    xTicks,
    yTicks: [0, 0.5, 1].map((value) => ({ y: y(value), value })),
  };
}
