/**
 * Where the dimension lines, the 500 nm scale bar and their label chips go, in device pixels of
 * the canvas. Pure geometry: the drawing code strokes what this returns and only adds the text
 * measurements it can get from a canvas.
 */
import type { CrossSection, EtchMetrics } from '../../sim/grid';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a label hangs: its chip is centred on `x`, with its bottom (above) or top (below) at `y`. */
export interface LabelAnchor {
  x: number;
  y: number;
  placement: 'above' | 'below';
}

/** A horizontal line with an end tick at each end and a label. */
export interface Measure {
  line: Rect;
  ticks: [left: Rect, right: Rect];
  label: LabelAnchor;
}

export interface ScaleBar extends Measure {
  nm: number;
}

export interface OverlayLayout {
  /** Opening at the top of the oxide; null when there is no opening. */
  topDim: Measure | null;
  /** Opening at the bottom of the oxide; null until the etch has cleared the oxide. */
  bottomDim: Measure | null;
  scaleBar: ScaleBar;
}

export type OverlayGrid = Pick<
  CrossSection,
  'widthCells' | 'heightCells' | 'cellNm' | 'oxideTopRow' | 'siTopRow'
>;

/** Length of the scale bar, nm. */
export const SCALE_BAR_NM = 500;

/**
 * `scale` is device pixels per grid cell (a whole number), `dpr` the device pixel ratio; sizes
 * given in css pixels are multiplied by it so lines stay one css pixel thick on every screen.
 */
export function overlayLayout(
  grid: OverlayGrid,
  metrics: EtchMetrics,
  scale: number,
  dpr: number,
): OverlayLayout {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new RangeError(`scale must be a whole number ≥ 1, got ${scale}`);
  }
  if (!Number.isFinite(dpr) || dpr <= 0) {
    throw new RangeError(`dpr must be a positive finite number, got ${dpr}`);
  }
  const { widthCells, heightCells, cellNm, oxideTopRow, siTopRow } = grid;
  const canvasW = widthCells * scale;
  const canvasH = heightCells * scale;
  const centreX = canvasW / 2;

  const thickness = Math.min(scale, Math.max(1, Math.round(dpr))); // one css pixel, at most a cell
  const tickExtra = Math.round(3 * dpr); // how far a tick sticks out above and below its line
  const gap = Math.round(3 * dpr); // between a tick and its label

  const measure = (line: Rect, placement: 'above' | 'below'): Measure => ({
    line,
    ticks: [
      { x: line.x, y: line.y - tickExtra, w: thickness, h: line.h + 2 * tickExtra },
      {
        x: line.x + line.w - thickness,
        y: line.y - tickExtra,
        w: thickness,
        h: line.h + 2 * tickExtra,
      },
    ],
    label: {
      x: line.x + line.w / 2,
      y: placement === 'above' ? line.y - tickExtra - gap : line.y + line.h + tickExtra + gap,
      placement,
    },
  });

  /** Line through the middle of grid row `row`, `widthNm` long, centred on the window. */
  const dimension = (row: number, widthNm: number, placement: 'above' | 'below'): Measure => {
    const w = Math.round((widthNm / cellNm) * scale);
    const y = row * scale + Math.floor((scale - thickness) / 2);
    return measure({ x: Math.round(centreX - w / 2), y, w, h: thickness }, placement);
  };

  const barW = Math.round((SCALE_BAR_NM / cellNm) * scale);
  const margin = Math.round(10 * dpr);
  const barH = Math.max(2, Math.round(3 * dpr));
  const bar = measure(
    { x: canvasW - margin - barW, y: canvasH - margin - barH, w: barW, h: barH },
    'above',
  );

  return {
    topDim: metrics.topNm > 0 ? dimension(oxideTopRow, metrics.topNm, 'above') : null,
    bottomDim:
      metrics.cleared && metrics.bottomNm > 0
        ? dimension(siTopRow - 1, metrics.bottomNm, 'below')
        : null,
    scaleBar: { ...bar, nm: SCALE_BAR_NM },
  };
}

/** The part of a `CanvasPlan` the frame around the grid needs. */
export interface FramePlan {
  gridX: number;
  gridWidthPx: number;
  widthPx: number;
  heightPx: number;
}

/** The canvas on each side of the grid image, full height; a strip is 0 wide when there is no room. */
export function surroundRects(plan: FramePlan): [left: Rect, right: Rect] {
  const rightX = plan.gridX + plan.gridWidthPx;
  return [
    { x: 0, y: 0, w: plan.gridX, h: plan.heightPx },
    { x: rightX, y: 0, w: plan.widthPx - rightX, h: plan.heightPx },
  ];
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A zigzag break line down one edge of the grid, the drawing convention for "the wafer goes on
 * beyond this cut". The teeth bite into the grid by at most `depthPx`: the surround is drawn
 * between the edge and the zigzag, the zigzag is stroked `lineWidthPx` thick.
 */
export interface BreakEdge {
  side: 'left' | 'right';
  /** x of the grid edge this line belongs to. */
  edgeX: number;
  /** From the top of the canvas to the bottom; x alternates between `edgeX` and `edgeX ± depthPx`. */
  zigzag: Point[];
  depthPx: number;
  lineWidthPx: number;
}

/** Size of the teeth in css pixels: depth into the grid, and the height of one slope. */
const BREAK_DEPTH_CSS_PX = 4;
const BREAK_SLOPE_CSS_PX = 6;

/** `dpr` is the device pixel ratio; sizes in css pixels are multiplied by it. */
export function breakEdges(plan: FramePlan, dpr: number): [left: BreakEdge, right: BreakEdge] {
  if (!Number.isFinite(dpr) || dpr <= 0) {
    throw new RangeError(`dpr must be a positive finite number, got ${dpr}`);
  }
  const depthPx = Math.max(1, Math.round(BREAK_DEPTH_CSS_PX * dpr));
  const slopePx = Math.max(1, Math.round(BREAK_SLOPE_CSS_PX * dpr));
  const lineWidthPx = Math.max(1, Math.round(dpr));

  /** Distance into the grid at height `y`: 0 at even vertices, `depthPx` at odd ones, straight between. */
  const biteAt = (y: number) => {
    const k = Math.floor(y / slopePx);
    const t = (y - k * slopePx) / slopePx;
    const from = k % 2 === 0 ? 0 : depthPx;
    const to = k % 2 === 0 ? depthPx : 0;
    return from + (to - from) * t;
  };
  const ys: number[] = [];
  for (let y = 0; y < plan.heightPx; y += slopePx) ys.push(y);
  ys.push(plan.heightPx); // the last slope is cut off by the bottom of the canvas

  const line = (side: 'left' | 'right'): BreakEdge => {
    const edgeX = side === 'left' ? plan.gridX : plan.gridX + plan.gridWidthPx;
    const sign = side === 'left' ? 1 : -1;
    return {
      side,
      edgeX,
      zigzag: ys.map((y) => ({ x: edgeX + sign * biteAt(y), y })),
      depthPx,
      lineWidthPx,
    };
  };
  return [line('left'), line('right')];
}

/**
 * The chip rectangle for a label of `size` hung on `anchor`, slid back inside `bounds` rather than
 * cut off at an edge. Throws RangeError if the chip cannot fit at all.
 */
export function placeChip(
  anchor: LabelAnchor,
  size: { w: number; h: number },
  bounds: { w: number; h: number },
): Rect {
  const { w, h } = size;
  if (w > bounds.w || h > bounds.h) {
    throw new RangeError(`chip ${w} × ${h} does not fit in ${bounds.w} × ${bounds.h}`);
  }
  const x = Math.min(Math.max(Math.round(anchor.x - w / 2), 0), bounds.w - w);
  const top = anchor.placement === 'above' ? anchor.y - h : anchor.y;
  const y = Math.min(Math.max(Math.round(top), 0), bounds.h - h);
  return { x, y, w, h };
}
