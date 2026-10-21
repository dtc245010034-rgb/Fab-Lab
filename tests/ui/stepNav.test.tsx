// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepNav, { type StepNavItem } from '../../src/ui/StepNav';

const ITEMS: StepNavItem[] = [
  { code: '3.1', label: 'Sạch', name: 'Làm sạch' },
  { code: '3.2', label: 'Phủ', name: 'Phủ quay' },
  { code: '3.3', label: 'Nung', name: 'Nung mềm' },
];

function columns(nav: HTMLElement): string {
  return nav.querySelector('ol')!.style.getPropertyValue('--steps');
}

describe('StepNav: any number of steps', () => {
  it.each([3, 6, 7, 9])('draws %i buttons and sizes the CSS columns to match', (count) => {
    render(<StepNav count={count} current={0} onSelect={() => {}} />);
    const nav = screen.getByRole('navigation', { name: /các bước/i });
    expect(within(nav).getAllByRole('button')).toHaveLength(count);
    expect(columns(nav)).toBe(String(count));
  });

  it('numbers anonymous steps from 1 and calls them "Bước n", as before', () => {
    render(<StepNav count={6} current={2} onSelect={() => {}} />);
    const buttons = within(screen.getByRole('navigation')).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Bước 1',
      'Bước 2',
      'Bước 3',
      'Bước 4',
      'Bước 5',
      'Bước 6',
    ]);
    expect(buttons[2]).toHaveAttribute('aria-current', 'step');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
    expect(buttons[0]).toHaveTextContent('1Bước');
  });

  it('reports the zero-based index of the button that was clicked', () => {
    const onSelect = vi.fn();
    render(<StepNav count={7} current={0} onSelect={onSelect} />);
    fireEvent.click(within(screen.getByRole('navigation')).getAllByRole('button')[4]!);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(4);
  });
});

describe('StepNav: named steps (a module with its own steps)', () => {
  it('shows the code and a short label, and keeps the whole name for assistive technology', () => {
    render(<StepNav count={3} current={1} items={ITEMS} onSelect={() => {}} />);
    const buttons = within(screen.getByRole('navigation')).getAllByRole('button');
    expect(buttons[2]).toHaveTextContent('3.3Nung');
    expect(buttons[2]).toHaveAccessibleName('Bước 3.3: Nung mềm');
    expect(buttons[1]).toHaveAttribute('aria-current', 'step');
  });

  it('keeps the visible label inside the accessible name (WCAG label in name), for every step', () => {
    render(<StepNav count={3} current={0} items={ITEMS} onSelect={() => {}} />);
    for (const [i, b] of within(screen.getByRole('navigation')).getAllByRole('button').entries()) {
      const name = b.getAttribute('aria-label')!.toLowerCase();
      expect(name, ITEMS[i]!.label).toContain(ITEMS[i]!.label.toLowerCase());
    }
  });

  it('refuses a list of items that is not as long as the count: it would draw the wrong nav', () => {
    // React reports the throw to the console and to the window; both are expected here
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handled = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', handled);
    expect(() =>
      render(<StepNav count={4} current={0} items={ITEMS} onSelect={() => {}} />),
    ).toThrow(RangeError);
    window.removeEventListener('error', handled);
    quiet.mockRestore();
  });
});
