// @vitest-environment jsdom
/** `/m03`: the lithography page, chosen from `location.pathname` and loaded only when asked for. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { inlineClient } from './clients';

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

function openM03() {
  window.history.replaceState({}, '', '/m03');
}

describe('/m03', () => {
  it('shows seven steps, the first one current, instead of the six of the etch lab', async () => {
    openM03();
    render(<App createClient={() => inlineClient()} />);
    const nav = await screen.findByRole('navigation', { name: /các bước/i });
    const steps = within(nav).getAllByRole('button');
    expect(steps).toHaveLength(7);
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('heading', { level: 2, name: /3\.1/ })).toBeInTheDocument();
  });

  it('does not start the etch worker: that page is not the one asked for', async () => {
    openM03();
    const createClient = vi.fn(() => inlineClient());
    render(<App createClient={createClient} />);
    await screen.findByRole('navigation', { name: /các bước/i });
    expect(createClient).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: /mặt cắt wafer/i })).not.toBeInTheDocument();
  });

  it('keeps the product header, with one h1', async () => {
    openM03();
    render(<App createClient={() => inlineClient()} />);
    await screen.findByRole('navigation', { name: /các bước/i });
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent(/Fab Lab/i);
  });

  it('puts the cross-section frame before the traveler in DOM order', async () => {
    openM03();
    render(<App createClient={() => inlineClient()} />);
    await screen.findByRole('navigation', { name: /các bước/i });
    const viewer = screen.getByRole('region', { name: /mặt cắt quang khắc/i });
    const traveler = screen.getByRole('complementary', { name: /phiếu công đoạn/i });
    expect(
      viewer.compareDocumentPosition(traveler) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows the equation of the exposure step as typeset KaTeX, from the MDX, in its own chip', async () => {
    openM03();
    render(<App createClient={() => inlineClient()} />);
    const nav = await screen.findByRole('navigation', { name: /các bước/i });
    expect(screen.queryByRole('group', { name: /giới hạn phân giải/i })).not.toBeInTheDocument();
    fireEvent.click(within(nav).getByRole('button', { name: /3\.4/ }));
    const chip = await screen.findByRole('group', { name: /giới hạn phân giải/i });
    // typeset at build time: the markup of KaTeX is already there, no script ran to make it
    expect(chip.querySelector('.katex')).not.toBeNull();
    // and the TeX source is kept for assistive technology, in the MathML that KaTeX writes
    expect(chip.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toContain(
      '\\mathrm{CD}_{\\min}',
    );
  });
});
