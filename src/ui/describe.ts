/**
 * Short Vietnamese strings built from numbers: the canvas description for screen readers, the
 * recipe line and the `?debug=1` readout. Longer learner text lives in src/content/vi/.
 */
import { formatApproxNm } from '../render/canvas2d/pixels';
import type { EtchMetrics } from '../sim/grid';
import type { EtchStep } from '../sim/recipe';

/** Vietnamese decimal comma: 4.6 → "4,6". */
export function formatViNumber(x: number): string {
  return String(x).replace('.', ',');
}

/** Milliseconds with one decimal and no unit, for a table cell whose header names it: "6,1". */
export function formatMsValue(ms: number): string {
  return ms.toFixed(1).replace('.', ',');
}

/** Milliseconds with one decimal, e.g. "6,1 ms". */
export function formatMs(ms: number): string {
  return `${formatMsValue(ms)} ms`;
}

/** A ratio with two decimals, e.g. "0,93×"; a dash when there is none (division by zero). */
export function formatRatio(ratio: number): string {
  return Number.isFinite(ratio) ? `${ratio.toFixed(2).replace('.', ',')}×` : '—';
}

const WET_NAMES = { boe10: 'BOE 10:1', boe6: 'BOE 6:1', hf49: 'HF 49%' } as const;

export function describeRecipe(etch: EtchStep): string {
  const time = `${formatViNumber(etch.timeMin)} phút`;
  return etch.mode === 'dry'
    ? `RIE ${etch.powerW} W · ${etch.pressureMTorr} mTorr · ${time}`
    : `${WET_NAMES[etch.etchant]} · ${time}`;
}

/** What the canvas shows, for `aria-label`; sizes are ≈ because the grid cannot tell finer. */
export function describeSection(metrics: EtchMetrics, cellNm: number): string {
  if (metrics.topNm <= 0) return 'Mặt cắt wafer: chưa có cửa sổ nào mở trong lớp oxit.';
  const top = `đỉnh ${formatApproxNm(metrics.topNm, cellNm)}`;
  if (!metrics.cleared) return `Mặt cắt wafer: chưa thủng hết lớp oxit, ${top}.`;
  return `Mặt cắt wafer: cửa sổ đã thủng tới Si, ${top}, đáy ${formatApproxNm(metrics.bottomNm, cellNm)}.`;
}

/** True only for `?debug=1`. */
export function isDebugRequested(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/** True only for `?bench=1`. */
export function isBenchRequested(search: string): boolean {
  return new URLSearchParams(search).get('bench') === '1';
}

/**
 * True only for `?bench=1&thread=main`: the benchmark page also times the same computation on the
 * page's main thread, to compare with the worker. It needs `bench=1`: the lab itself never
 * computes on the main thread.
 */
export function isBenchMainThreadRequested(search: string): boolean {
  return isBenchRequested(search) && new URLSearchParams(search).get('thread') === 'main';
}
