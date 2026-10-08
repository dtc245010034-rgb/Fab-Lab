import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  drawCrossSection,
  loadLabelFont,
  type CrossSectionView,
} from '../render/canvas2d/crossSection';
import { readPalette } from '../render/canvas2d/palette';

interface Props {
  view: CrossSectionView;
  ariaLabel: string;
  /** Words in front of the ≈ sizes drawn on the canvas. */
  labels: { top: string; bottom: string };
}

/**
 * The cross-section canvas. Sized in whole device pixels per grid cell from the width of its
 * container, and redrawn when that width, the pixel ratio, the data or the label font changes.
 */
export default function CrossSectionCanvas({ view, ariaLabel, labels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnWidth = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    // No 2-D context (jsdom, or a browser that refuses one): there is nothing to draw on.
    if (!canvas.getContext('2d')) return;
    const availableCssWidth = host.clientWidth;
    if (availableCssWidth <= 0) return; // not laid out yet, or hidden
    drawnWidth.current = availableCssWidth;
    drawCrossSection(canvas, view, {
      palette: readPalette(document.documentElement),
      availableCssWidth,
      dpr: window.devicePixelRatio || 1,
      labels,
    });
  }, [view, labels]);

  // Before the first paint, so there is no flash of an unsized canvas.
  useLayoutEffect(() => {
    draw();
  }, [draw]);

  // Label text is measured to size its chip, so draw again once the font is really there.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.getContext('2d')) return;
    let alive = true;
    const { fontStack } = readPalette(document.documentElement);
    const sample = `${labels.top}${labels.bottom} ≈ 0123456789 nm`;
    void loadLabelFont(fontStack, sample).then(() => {
      if (alive) draw();
    });
    return () => {
      alive = false;
    };
  }, [draw, labels]);

  useEffect(() => {
    const host = canvasRef.current?.parentElement;
    if (!host) return;
    const onResize = () => {
      if (host.clientWidth !== drawnWidth.current) draw();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    observer?.observe(host);
    // Browser zoom changes the pixel ratio without necessarily changing the container's width.
    const onZoom = () => draw();
    window.addEventListener('resize', onZoom);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onZoom);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={view.section.widthCells}
      height={view.section.heightCells}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
