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

  it('drops a slot whose content is null, heading and all; a slot left out still says "Chưa có nội dung"', () => {
    render(
      <Traveler
        steps={STEPS}
        content={() => ({
          'Cơ chế': <p>Cơ chế của bước</p>,
          'Phương trình': null,
          'Ghi chú': null,
        })}
      />,
    );
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Cơ chế', 'Điều khiển']);
    expect(screen.getByText('Cơ chế của bước')).toBeInTheDocument();
    // "Điều khiển" was not given: the default text stays; the two dropped ones leave nothing behind
    expect(screen.getAllByText('Chưa có nội dung.')).toHaveLength(1);
  });

  it('keeps all four slots, with the default text, for a Traveler that has no content (the etch lab)', () => {
    render(<Traveler />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    expect(screen.getAllByText('Chưa có nội dung.')).toHaveLength(4);
  });

  it('puts the slots in the order of docs/DESIGN.md: mechanism, equation, controls, notes', () => {
    render(<Traveler steps={STEPS} />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Cơ chế', 'Phương trình', 'Điều khiển', 'Ghi chú']);
  });
});

describe('Traveler with its step held by the page', () => {
  it('shows the step it is given, and asks to change it instead of changing it', () => {
    const asked: number[] = [];
    const { rerender } = render(
      <Traveler steps={STEPS} step={1} onStepChange={(i) => asked.push(i)} />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('3.2 Phủ quay');
    const nav = screen.getByRole('navigation', { name: /các bước/i });
    fireEvent.click(within(nav).getByRole('button', { name: /3\.4/ }));
    expect(asked).toEqual([3]);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('3.2 Phủ quay'); // not yet
    rerender(<Traveler steps={STEPS} step={3} onStepChange={(i) => asked.push(i)} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('3.4 Phơi sáng');
  });

  it('asks for the neighbouring step with "previous" and "next", and stops at the ends', () => {
    const asked: number[] = [];
    const { rerender } = render(
      <Traveler steps={STEPS} step={1} onStepChange={(i) => asked.push(i)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /bước sau/i }));
    fireEvent.click(screen.getByRole('button', { name: /bước trước/i }));
    expect(asked).toEqual([2, 0]);
    rerender(<Traveler steps={STEPS} step={0} onStepChange={() => {}} />);
    expect(screen.getByRole('button', { name: /bước trước/i })).toBeDisabled();
    rerender(<Traveler steps={STEPS} step={3} onStepChange={() => {}} />);
    expect(screen.getByRole('button', { name: /bước sau/i })).toBeDisabled();
  });

  it('gives the content function the step the page holds', () => {
    const seen: number[] = [];
    render(
      <Traveler
        steps={STEPS}
        step={2}
        onStepChange={() => {}}
        content={(i) => {
          seen.push(i);
          return {};
        }}
      />,
    );
    expect(new Set(seen)).toEqual(new Set([2]));
  });
});
