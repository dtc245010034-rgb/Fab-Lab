// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';
import { inlineClient } from './clients';

// A stable factory (a new function per render would build a new worker each time). The frame is
// checked once the section has arrived, so no state update lands after a test has finished.
const createClient = () => inlineClient();
async function renderApp() {
  render(<App createClient={createClient} />);
  await screen.findByRole('img', { name: /mặt cắt wafer/i });
}

describe('App frame (Viewer + Traveler)', () => {
  it('has a banner with the product name as the only h1', async () => {
    await renderApp();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent(/Fab Lab/i);
  });

  it('renders the Viewer with a labelled cross-section canvas and empty metric tiles', async () => {
    await renderApp();
    const viewer = screen.getByRole('region', { name: /mặt cắt wafer/i });
    const canvas = within(viewer).getByRole('img', { name: /mặt cắt wafer/i });
    expect(canvas.tagName).toBe('CANVAS');
    expect(within(viewer).getAllByRole('definition')).toHaveLength(3);
  });

  it('renders the Traveler with a 6-step navigation, first step current', async () => {
    await renderApp();
    const traveler = screen.getByRole('complementary', { name: /phiếu công đoạn/i });
    const nav = within(traveler).getByRole('navigation', { name: /các bước/i });
    const steps = within(nav).getAllByRole('button');
    expect(steps).toHaveLength(6);
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    steps.slice(1).forEach((s) => expect(s).not.toHaveAttribute('aria-current'));
  });

  it('puts the Viewer before the Traveler in DOM order (stacked layout shows Viewer first)', async () => {
    await renderApp();
    const viewer = screen.getByRole('region', { name: /mặt cắt wafer/i });
    const traveler = screen.getByRole('complementary', { name: /phiếu công đoạn/i });
    expect(
      viewer.compareDocumentPosition(traveler) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('changes the current step and the step title when a step is clicked', async () => {
    await renderApp();
    const nav = screen.getByRole('navigation', { name: /các bước/i });
    const steps = within(nav).getAllByRole('button');
    fireEvent.click(steps[2]!);
    expect(steps[2]).toHaveAttribute('aria-current', 'step');
    expect(steps[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { level: 2, name: /bước 3/i })).toBeInTheDocument();
  });

  it('disables "previous" on the first step and "next" on the last, and they move one step', async () => {
    await renderApp();
    const prev = screen.getByRole('button', { name: /bước trước/i });
    const next = screen.getByRole('button', { name: /bước sau/i });
    expect(prev).toBeDisabled();
    fireEvent.click(next);
    expect(screen.getByRole('heading', { level: 2, name: /bước 2/i })).toBeInTheDocument();
    expect(prev).toBeEnabled();
    for (let i = 0; i < 4; i += 1) fireEvent.click(next);
    expect(screen.getByRole('heading', { level: 2, name: /bước 6/i })).toBeInTheDocument();
    expect(next).toBeDisabled();
  });
});
