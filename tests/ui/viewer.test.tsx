// @vitest-environment jsdom
/**
 * The Viewer shows the default case-B etch: description for screen readers, material legend, the
 * recipe line and the "illustrative" caption (rule 1: tier-C numbers are never shown as real).
 * Canvas drawing itself is checked in a real browser; jsdom has no 2-D context.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { DEFAULT_RECIPE } from '../../src/sim/defaults';
import { runRecipe } from '../../src/sim/recipe';
import Viewer from '../../src/ui/Viewer';
import { inlineClient, manualClient, type TestClient } from './clients';

const result = runRecipe(DEFAULT_RECIPE);

const renderViewer = (debug?: boolean) =>
  render(<Viewer recipe={DEFAULT_RECIPE} result={result} debug={debug} />);

// Stable factories: a new function on every render would make the App build a new store each time.
const inlineFactory = () => inlineClient();

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

  it('separates the recipe from the grid resolution with " · "', () => {
    renderViewer();
    const meta = document.querySelector('.vmeta')!;
    expect(meta.textContent).toBe('RIE 200 W · 30 mTorr · 4,6 phút · 1 ô = 10 nm');
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

  it('reads the flag from the page address in the App', async () => {
    window.history.replaceState({}, '', '/?debug=1');
    render(<App createClient={inlineFactory} />);
    expect(await screen.findByText(/runRecipe \d+,\d ms/)).toBeInTheDocument();
  });

  it('does not show in the App without the parameter, nor with debug=0', async () => {
    window.history.replaceState({}, '', '/?debug=0');
    render(<App createClient={inlineFactory} />);
    await screen.findByRole('img', { name: /mặt cắt wafer/i });
    expect(screen.queryByText(/runRecipe/)).not.toBeInTheDocument();
  });
});

describe('Viewer while a newer result is being computed', () => {
  it('is not busy when nothing is being computed', () => {
    renderViewer();
    expect(document.querySelector('.viewer')).not.toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/đang tính lại/i)).not.toBeInTheDocument();
  });

  it('keeps the picture on screen, marks the region busy and says so in words', () => {
    render(<Viewer recipe={DEFAULT_RECIPE} result={result} pending />);
    expect(document.querySelector('.viewer')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('img', { name: /mặt cắt wafer/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/đang tính lại/i);
  });

  it('says a computation failed, as an alert, and still shows the last picture', () => {
    render(<Viewer recipe={DEFAULT_RECIPE} result={result} failed />);
    expect(screen.getByRole('alert')).toHaveTextContent(/không tính được mặt cắt/i);
    expect(screen.getByRole('img', { name: /mặt cắt wafer/i })).toBeInTheDocument();
  });
});

describe('App with the simulation worker', () => {
  it('says it is computing until the first result lands, then shows the section', async () => {
    const { client, runs } = manualClient();
    render(<App createClient={() => client} />);
    expect(screen.getByRole('status')).toHaveTextContent(/đang tính mặt cắt/i);
    expect(screen.queryByRole('img', { name: /mặt cắt wafer/i })).not.toBeInTheDocument();

    await waitFor(() => expect(runs).toHaveLength(1));
    await act(async () => runs[0]!.resolve(runRecipe(runs[0]!.recipe)));

    const canvas = await screen.findByRole('img', { name: /mặt cắt wafer/i });
    expect(canvas.getAttribute('aria-label')).toContain('thủng');
    expect(screen.queryByText(/đang tính mặt cắt/i)).not.toBeInTheDocument();
    expect(document.querySelector('.viewer')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('asks the worker for the default recipe', async () => {
    const client = inlineClient();
    render(<App createClient={() => client} />);
    await screen.findByRole('img', { name: /mặt cắt wafer/i });
    expect(client.asked).toEqual([DEFAULT_RECIPE]);
  });

  it('shows an alert and no picture when the first computation fails, and logs why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, runs } = manualClient();
    render(<App createClient={() => client} />);
    await waitFor(() => expect(runs).toHaveLength(1));
    await act(async () => runs[0]!.reject(new Error('worker failed to start')));
    expect(await screen.findByRole('alert')).toHaveTextContent(/không tính được mặt cắt/i);
    expect(screen.queryByRole('img', { name: /mặt cắt wafer/i })).not.toBeInTheDocument();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'worker failed to start' }),
    );
    log.mockRestore();
  });

  it('under StrictMode leaves one live worker, and none after unmount', async () => {
    const created: TestClient[] = [];
    const factory = () => {
      const client = inlineClient();
      created.push(client);
      return client;
    };
    const { unmount } = render(
      <StrictMode>
        <App createClient={factory} />
      </StrictMode>,
    );
    await screen.findByRole('img', { name: /mặt cắt wafer/i });
    expect(created.filter((c) => !c.disposed)).toHaveLength(1);
    unmount();
    expect(created.every((c) => c.disposed)).toBe(true);
  });
});
