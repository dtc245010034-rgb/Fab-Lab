// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Traveler, { type TravelerStep } from '../../src/ui/Traveler';

const STEPS: TravelerStep[] = [
  { code: '3.1', label: 'Sạch', name: 'Làm sạch' },
  { code: '3.2', label: 'Phủ', name: 'Phủ quay' },
  { code: '3.3', label: 'Nung', name: 'Nung mềm' },
  { code: '3.4', label: 'Phơi', name: 'Phơi sáng' },
];

describe('Traveler with its own steps', () => {
  it('draws one button per step and names the current step in the heading', () => {
    render(<Traveler steps={STEPS} />);
    const nav = screen.getByRole('navigation', { name: /các bước/i });
    expect(within(nav).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('3.1 Làm sạch');
    fireEvent.click(within(nav).getByRole('button', { name: /3\.3/ }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('3.3 Nung mềm');
  });

  it('stops "previous" at the first step and "next" at the last of its own list', () => {
    render(<Traveler steps={STEPS} />);
    const prev = screen.getByRole('button', { name: /bước trước/i });
    const next = screen.getByRole('button', { name: /bước sau/i });
    expect(prev).toBeDisabled();
    for (let i = 0; i < 3; i += 1) fireEvent.click(next);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('3.4 Phơi sáng');
    expect(next).toBeDisabled();
    expect(prev).toBeEnabled();
  });

  it('shows the content a step brings in its slot, and "Chưa có nội dung" in the others', () => {
    render(
      <Traveler
        steps={STEPS}
        content={(index) => (index === 3 ? { 'Phương trình': <p>CD = k₁·λ / NA</p> } : {})}
      />,
    );
    expect(screen.getAllByText('Chưa có nội dung.')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /3\.4/ }));
    expect(screen.getByText('CD = k₁·λ / NA')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có nội dung.')).toHaveLength(3);
  });

  it('puts the slots in the order of docs/DESIGN.md: mechanism, equation, controls, notes', () => {
    render(<Traveler steps={STEPS} />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Cơ chế', 'Phương trình', 'Điều khiển', 'Ghi chú']);
  });
});
