// @vitest-environment jsdom
/**
 * `/?bench=1` replaces the lab with a page that times the worker on cases A, B, C and shows
 * median / p95 / max, so the "warm < 50 ms" criterion can be measured on a real phone.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { BENCH_RUNS_PER_CASE } from '../../src/sim/defaults';
import { CANNED_BENCH, inlineClient, manualClient, type TestClient } from './clients';

const inlineFactory = () => inlineClient();

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

function openBench() {
  window.history.replaceState({}, '', '/?bench=1');
}

describe('/?bench=1', () => {
  it('shows the benchmark instead of the lab', async () => {
    openBench();
    render(<App createClient={inlineFactory} />);
    expect(await screen.findByRole('region', { name: /đo tốc độ tính/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /mặt cắt wafer/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: /phiếu công đoạn/i }),
    ).not.toBeInTheDocument();
  });

  it('still shows the lab without the parameter', async () => {
    render(<App createClient={inlineFactory} />);
    // wait for the picture: the empty frame before it has the same name as the Viewer
    await screen.findByRole('img', { name: /mặt cắt wafer/i });
    expect(screen.getByRole('region', { name: /mặt cắt wafer/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /đo tốc độ tính/i })).not.toBeInTheDocument();
  });

  it('says it is measuring until the numbers come back', async () => {
    openBench();
    const { client, benches } = manualClient();
    render(<App createClient={() => client} />);
    const region = screen.getByRole('region', { name: /đo tốc độ tính/i });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(within(region).getByRole('status')).toHaveTextContent(/đang đo/i);
    await waitFor(() => expect(benches).toHaveLength(1));
    expect(client.benched).toEqual([BENCH_RUNS_PER_CASE]);

    await act(async () => benches[0]!.resolve(CANNED_BENCH));
    expect(region).not.toHaveAttribute('aria-busy', 'true');
    expect(within(region).queryByRole('status')).not.toBeInTheDocument();
  });

  it('lists median, p95 and max per case, for runRecipe and for arrivalTime', async () => {
    openBench();
    render(<App createClient={inlineFactory} />);
    const total = await screen.findByRole('table', { name: /runRecipe/ });
    const header = within(total)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(header).toEqual(['Ca', 'Số lần', 'Trung vị', 'p95', 'Lớn nhất']);

    // each row: the case as the row header, then count, median, p95, max
    const rows = within(total).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    const cells = (row: HTMLElement) =>
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent(/^A/);
    expect(within(rows[1]!).getByRole('rowheader')).toHaveTextContent(/^B/);
    expect(within(rows[2]!).getByRole('rowheader')).toHaveTextContent(/^C/);
    // A: 3, 4, 5, 6, 40 → median 5; p95 is the nearest rank of 5 samples = 40; max 40
    expect(cells(rows[0]!)).toEqual(['5', '5,0 ms', '40,0 ms', '40,0 ms']);
    expect(cells(rows[1]!)).toEqual(['5', '12,0 ms', '14,0 ms', '14,0 ms']);
    expect(cells(rows[2]!)).toEqual(['5', '22,0 ms', '90,0 ms', '90,0 ms']);

    // arrivalTime alone: A is 1, 1.5, 2, 2.5, 30 → median 2
    const arrival = screen.getByRole('table', { name: /arrivalTime/ });
    const arrivalRows = within(arrival).getAllByRole('row').slice(1);
    expect(arrivalRows).toHaveLength(3);
    expect(cells(arrivalRows[0]!)).toEqual(['5', '2,0 ms', '30,0 ms', '30,0 ms']);
  });

  it('says what the numbers are: warm, after the worker warmed up', async () => {
    openBench();
    render(<App createClient={inlineFactory} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(screen.getByText(/làm ấm/i)).toBeInTheDocument();
  });

  it('shows where it ran: the browser, the logical processors and the pixel ratio', async () => {
    openBench();
    render(<App createClient={inlineFactory} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(screen.getByText(/trình duyệt/i)).toBeInTheDocument();
    expect(screen.getByText(/luồng cpu/i)).toBeInTheDocument();
    expect(screen.getByText(/devicePixelRatio/)).toBeInTheDocument();
  });

  it('measures again on the same worker when asked', async () => {
    openBench();
    const client = inlineClient();
    render(<App createClient={() => client} />);
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(client.benched).toEqual([BENCH_RUNS_PER_CASE]);

    fireEvent.click(screen.getByRole('button', { name: /chạy lại/i }));
    await waitFor(() => expect(client.benched).toEqual([BENCH_RUNS_PER_CASE, BENCH_RUNS_PER_CASE]));
    await screen.findByRole('table', { name: /runRecipe/ });
  });

  it('says so and offers another try when the measurement fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    openBench();
    const { client, benches } = manualClient();
    render(<App createClient={() => client} />);
    await waitFor(() => expect(benches).toHaveLength(1));
    await act(async () => benches[0]!.reject(new Error('worker failed to start')));
    expect(await screen.findByRole('alert')).toHaveTextContent(/không đo được/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chạy lại/i })).toBeEnabled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('under StrictMode leaves one live worker, and none after unmount', async () => {
    openBench();
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
    await screen.findByRole('table', { name: /runRecipe/ });
    expect(created.filter((c) => !c.disposed)).toHaveLength(1);
    unmount();
    expect(created.every((c) => c.disposed)).toBe(true);
  });
});
