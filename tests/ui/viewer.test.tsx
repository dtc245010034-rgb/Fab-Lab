// @vitest-environment jsdom
/**
 * The Viewer shows the default case-B etch: description for screen readers, material legend, the
 * recipe line and the "illustrative" caption (rule 1: tier-C numbers are never shown as real).
 * Canvas drawing itself is checked in a real browser; jsdom has no 2-D context.
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../../src/App';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { runRecipe } from '../../src/sim/recipe';
import Viewer from '../../src/ui/Viewer';

const result = runRecipe(DEFAULT_RECIPE);

const renderViewer = (debug?: boolean) =>
  render(<Viewer recipe={DEFAULT_RECIPE} result={result} debug={debug} />);

describe('Viewer with the default recipe', () => {
  it('describes the section for screen readers, from the metrics', () => {
    renderViewer();
    const canvas = screen.getByRole('img', { name: /mặt cắt wafer/i });
    expect(canvas.tagName).toBe('CANVAS');
    const label = canvas.getAttribute('aria-label')!;
    expect(label).toContain('cửa sổ đã thủng tới Si');
    expect(label).toMatch(/đỉnh ≈ \d+ nm/);
    expect(label).toMatch(/đáy ≈ \d+ nm/);
    // the grid is 10 nm per cell, so shown sizes are multiples of 10
    for (const [, nm] of label.matchAll(/≈ (\d+) nm/g)) expect(Number(nm) % 10).toBe(0);
  });

  it('shows the recipe and the grid resolution', () => {
    renderViewer();
    expect(screen.getByText(/RIE 200 W · 30 mTorr · 4,6 phút/)).toBeInTheDocument();
    expect(screen.getByText(/1 ô = 10 nm/)).toBeInTheDocument();
  });

  it('has a material legend with all four colours, as list items', () => {
    renderViewer();
    const legend = screen.getByRole('list', { name: /chú giải vật liệu/i });
    const items = within(legend).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringMatching(/Silicon \(Si\)/),
      expect.stringMatching(/Oxit \(SiO₂\)/),
      expect.stringMatching(/Cản quang \(resist\)/),
      expect.stringMatching(/Không khí hoặc phần đã khắc/),
    ]);
  });

  it('colours the legend swatches with the design tokens, not raw colours', () => {
    renderViewer();
    const swatches = document.querySelectorAll<HTMLElement>('.legend .swatch');
    expect(swatches).toHaveLength(4);
    expect([...swatches].map((s) => s.style.background)).toEqual([
      'var(--si)',
      'var(--ox)',
      'var(--pr)',
      'var(--screen)',
    ]);
  });

  it('says the numbers come from a simplified model and are only indicative', () => {
    renderViewer();
    expect(screen.getByText(/mô hình hình học đơn giản, số liệu minh họa/i)).toBeInTheDocument();
  });

  it('keeps the three metric tiles untouched', () => {
    renderViewer();
    expect(screen.getAllByRole('definition')).toHaveLength(3);
  });
});

describe('?debug=1 readout', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('is absent by default', () => {
    renderViewer();
    expect(screen.queryByText(/runRecipe/)).not.toBeInTheDocument();
    expect(screen.queryByText(/arrivalTime/)).not.toBeInTheDocument();
  });

  it('shows runRecipe and arrivalTime separately, in ms with one decimal', () => {
    renderViewer(true);
    const total = screen.getByText(/runRecipe \d+,\d ms/);
    const arrival = screen.getByText(/arrivalTime \d+,\d ms/);
    expect(total).toBeInTheDocument();
    expect(arrival).toBeInTheDocument();
  });

  it('reads the flag from the page address in the App', () => {
    window.history.replaceState({}, '', '/?debug=1');
    render(<App />);
    expect(screen.getByText(/runRecipe \d+,\d ms/)).toBeInTheDocument();
  });

  it('does not show in the App without the parameter, nor with debug=0', () => {
    window.history.replaceState({}, '', '/?debug=0');
    render(<App />);
    expect(screen.queryByText(/runRecipe/)).not.toBeInTheDocument();
  });
});
