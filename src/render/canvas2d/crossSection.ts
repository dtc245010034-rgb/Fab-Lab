/**
 * Draws the M04 cross-section on a canvas: one pixel per grid cell scaled up by a whole number
 * without smoothing and centred in the canvas, the surround on both sides of it with a zigzag
 * break line on each edge (the wafer goes on), then the dimension lines, the 500 nm bar and their
 * labels at the screen's own resolution. Everything computable without a canvas lives in
 * pixels.ts, overlay.ts and palette.ts; this file only does the drawing calls.
 *
 * Plain data in, pixels out: it knows nothing about React or about where the data was computed.
 */
import type { ArrivalField } from '../../physics/etch';
import type { CrossSection, EtchMetrics } from '../../sim/grid';
import {
  breakEdges,
  overlayLayout,
  placeChip,
  SCALE_BAR_NM,
  surroundRects,
  type BreakEdge,
  type LabelAnchor,
  type Rect,
} from './overlay';
import { toCssHex, type Rgb, type RenderPalette } from './palette';
import { formatApproxNm, gridToPixels, planCanvas } from './pixels';

export interface CrossSectionView {
  section: CrossSection;
  field: ArrivalField;
  /** Etch time to draw; must not exceed `field.maxTimeMin`. */
  timeMin: number;
  metrics: EtchMetrics;
}

export interface DrawOptions {
  palette: RenderPalette;
  /** Width of the container, css pixels. */
  availableCssWidth: number;
  dpr: number;
  /** Words in front of the ≈ sizes, e.g. "đỉnh" and "đáy"; the language belongs to the caller. */
  labels: { top: string; bottom: string };
}

export interface DrawResult {
  scale: number;
  widthPx: number;
  heightPx: number;
}

/** Label text size, css pixels. */
const LABEL_FONT_CSS_PX = 12;

/**
 * Loads the face the labels use for `sample`, so that `measureText` sees its real widths. Glyphs
 * outside the self-hosted subsets (≈, ₂) come from a system font whatever happens here. A font
 * that fails to load is not an error: the fallback stack draws instead.
 */
export async function loadLabelFont(fontStack: string, sample: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(`600 ${LABEL_FONT_CSS_PX}px ${fontStack}`, sample);
  } catch {
    // keep going with the fallback fonts
  }
}

/** The teeth of a break line (surround colour, between the grid edge and the zigzag) and its stroke. */
function drawBreakEdge(
  ctx: CanvasRenderingContext2D,
  edge: BreakEdge,
  heightPx: number,
  palette: RenderPalette,
): void {
  const trace = () => {
    ctx.beginPath();
    edge.zigzag.forEach(({ x, y }, i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  };
  trace();
  ctx.lineTo(edge.edgeX, heightPx);
  ctx.lineTo(edge.edgeX, 0);
  ctx.closePath();
  ctx.fillStyle = toCssHex(palette.surround);
  ctx.fill();

  trace();
  ctx.strokeStyle = toCssHex(palette.ink);
  ctx.lineWidth = edge.lineWidthPx;
  ctx.lineJoin = 'miter';
  ctx.stroke();
}

/**
 * Resizes `canvas` to the container width, lays the grid in the middle, in a whole-number multiple
 * of its size, and draws the view on it. Returns null when the canvas has no 2-D context. Call
 * again after the font has loaded or the container has changed size.
 */
export function drawCrossSection(
  canvas: HTMLCanvasElement,
  view: CrossSectionView,
  options: DrawOptions,
): DrawResult | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { section, field, timeMin, metrics } = view;
  const { palette, availableCssWidth, dpr, labels } = options;

  const plan = planCanvas(section, availableCssWidth, dpr);
  // Setting the size clears the canvas and resets the context state.
  canvas.width = plan.widthPx;
  canvas.height = plan.heightPx;
  canvas.style.width = `${plan.cssWidth}px`;
  canvas.style.height = `${plan.cssHeight}px`;

  // One pixel per cell on a small buffer, then scaled by `plan.scale` with smoothing off.
  const buffer = canvas.ownerDocument.createElement('canvas');
  buffer.width = section.widthCells;
  buffer.height = section.heightCells;
  const bufferCtx = buffer.getContext('2d');
  if (!bufferCtx) return null;
  const pixels = gridToPixels(section, field, timeMin, palette.materials);
  bufferCtx.putImageData(new ImageData(pixels, section.widthCells, section.heightCells), 0, 0);
  ctx.fillStyle = toCssHex(palette.surround);
  for (const r of surroundRects(plan)) ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, plan.gridX, 0, plan.gridWidthPx, plan.heightPx);
  for (const edge of breakEdges(plan, dpr)) drawBreakEdge(ctx, edge, plan.heightPx, palette);

  // Overlays, in device pixels so lines and text stay sharp. Their geometry starts at the grid.
  ctx.save();
  ctx.translate(plan.gridX, 0);
  const layout = overlayLayout(section, metrics, plan.scale, dpr);
  const fill = (r: Rect, colour: Rgb) => {
    ctx.fillStyle = toCssHex(colour);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  };
  const measures = [layout.topDim, layout.bottomDim, layout.scaleBar];
  for (const m of measures) {
    if (!m) continue;
    fill(m.line, palette.ink);
    for (const tick of m.ticks) fill(tick, palette.ink);
  }

  const fontPx = Math.round(LABEL_FONT_CSS_PX * dpr);
  const padX = Math.round(4 * dpr);
  const padY = Math.round(3 * dpr);
  ctx.font = `600 ${fontPx}px ${palette.fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const bounds = { w: plan.gridWidthPx, h: plan.heightPx };
  const label = (anchor: LabelAnchor, text: string) => {
    const chip = placeChip(
      anchor,
      { w: Math.ceil(ctx.measureText(text).width) + 2 * padX, h: fontPx + 2 * padY },
      bounds,
    );
    fill(chip, palette.chip);
    ctx.fillStyle = toCssHex(palette.ink);
    ctx.fillText(text, chip.x + chip.w / 2, chip.y + chip.h / 2);
  };
  if (layout.topDim) {
    label(layout.topDim.label, `${labels.top} ${formatApproxNm(metrics.topNm, section.cellNm)}`);
  }
  if (layout.bottomDim) {
    label(
      layout.bottomDim.label,
      `${labels.bottom} ${formatApproxNm(metrics.bottomNm, section.cellNm)}`,
    );
  }
  label(layout.scaleBar.label, `${SCALE_BAR_NM} nm`);
  ctx.restore();

  return { scale: plan.scale, widthPx: plan.widthPx, heightPx: plan.heightPx };
}
