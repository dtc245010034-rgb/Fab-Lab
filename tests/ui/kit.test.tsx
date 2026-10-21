// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EquationChip from '../../src/ui/EquationChip';
import MetricTile from '../../src/ui/MetricTile';
import Note from '../../src/ui/Note';
import ParamSlider from '../../src/ui/ParamSlider';
import Segmented from '../../src/ui/Segmented';
import { STATUS_WORDS } from '../../src/ui/status';

describe('status words', () => {
  it('say what the colour says, in words (DESIGN.md: never colour alone)', () => {
    expect(STATUS_WORDS).toEqual({ ok: 'Đạt', warn: 'Cảnh báo', bad: 'Lỗi' });
  });
});

describe('ParamSlider', () => {
  const base = { id: 'dose', label: 'Liều chiếu', min: 0.5, max: 2, step: 0.05, value: 1.2 };

  it('is a range input named by its label, with the limits and the value', () => {
    render(<ParamSlider {...base} unit="×" onChange={() => {}} />);
    const slider = screen.getByRole('slider', { name: 'Liều chiếu' });
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '0.5');
    expect(slider).toHaveAttribute('max', '2');
    expect(slider).toHaveAttribute('step', '0.05');
    expect(slider).toHaveValue('1.2');
  });

  it('shows the value with its unit and a decimal comma, and says the same to a screen reader', () => {
    render(<ParamSlider {...base} unit="×" onChange={() => {}} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuetext', '1,2 ×');
    const out = screen.getByRole('status');
    expect(out).toHaveTextContent('1,2 ×');
    expect(out).toHaveAttribute('for', 'dose');
  });

  it('shows a bare number when there is no unit', () => {
    render(<ParamSlider {...base} onChange={() => {}} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '1,2');
  });

  it('formats with the caller’s function when given one', () => {
    render(
      <ParamSlider
        {...base}
        unit="nm"
        format={(v) => v.toFixed(1)}
        value={365}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '365.0 nm');
  });

  it('reports a number, not a string, when it moves', () => {
    const onChange = vi.fn();
    render(<ParamSlider {...base} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1.55' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(1.55);
  });

  it('can be disabled', () => {
    render(<ParamSlider {...base} disabled onChange={() => {}} />);
    expect(screen.getByRole('slider')).toBeDisabled();
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'g', label: 'g-line' },
    { value: 'i', label: 'i-line' },
    { value: 'krf', label: 'KrF' },
  ] as const;

  it('is a labelled group of buttons, the chosen one pressed', () => {
    render(<Segmented label="Nguồn sáng" options={options} value="i" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Nguồn sáng' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['g-line', 'i-line', 'KrF']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('reports the value (not the label) of the button that was clicked', () => {
    const onChange = vi.fn();
    render(<Segmented label="Nguồn sáng" options={options} value="i" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'KrF' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('krf');
  });

  it('says nothing when the chosen button is clicked again: it would recompute for nothing', () => {
    const onChange = vi.fn();
    render(<Segmented label="Nguồn sáng" options={options} value="i" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'i-line' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('works with numbers as values', () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Tốc độ quay"
        options={[
          { value: 1500, label: '1500' },
          { value: 3000, label: '3000' },
        ]}
        value={3000}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '1500' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(1500);
  });
});

describe('MetricTile', () => {
  it('is a term and its value, for a description list', () => {
    render(
      <dl>
        <MetricTile label="Độ sâu tiêu cự" value="1,4 µm" />
      </dl>,
    );
    expect(screen.getByRole('term')).toHaveTextContent('Độ sâu tiêu cự');
    expect(screen.getByRole('definition')).toHaveTextContent('1,4 µm');
  });

  it.each(['ok', 'warn', 'bad'] as const)('says "%s" in words as well as in colour', (status) => {
    const { container } = render(
      <dl>
        <MetricTile label="CD" value="320 nm" status={status} />
      </dl>,
    );
    expect(screen.getByRole('definition')).toHaveTextContent(STATUS_WORDS[status]);
    expect(container.querySelector('.metric')).toHaveClass(`metric--${status}`);
  });

  it('has no status word and no status class when there is no status', () => {
    const { container } = render(
      <dl>
        <MetricTile label="CD" value="320 nm" />
      </dl>,
    );
    const tile = container.querySelector('.metric')!;
    expect(tile.className).toBe('metric');
    for (const word of Object.values(STATUS_WORDS)) expect(tile).not.toHaveTextContent(word);
  });
});

describe('Note', () => {
  it.each(['ok', 'warn', 'bad'] as const)(
    'puts the status word in front of a %s message',
    (tone) => {
      const { container } = render(<Note tone={tone}>Cửa sổ mở sạch.</Note>);
      const note = screen.getByRole('note');
      expect(note).toHaveTextContent(`${STATUS_WORDS[tone]}Cửa sổ mở sạch.`);
      expect(container.firstElementChild).toHaveClass('note', `note--${tone}`);
    },
  );

  it('holds inline markup, not only text', () => {
    render(
      <Note tone="warn">
        Còn <strong>cặn</strong> ở đáy.
      </Note>,
    );
    expect(within(screen.getByRole('note')).getByText('cặn').tagName).toBe('STRONG');
  });
});

describe('EquationChip', () => {
  it('is a named group around the equation', () => {
    render(
      <EquationChip label="Giới hạn phân giải">
        <span>CD = k₁·λ / NA</span>
      </EquationChip>,
    );
    const chip = screen.getByRole('group', { name: 'Giới hạn phân giải' });
    expect(chip).toHaveTextContent('CD = k₁·λ / NA');
    expect(chip).toHaveClass('eq');
  });

  it('can be reached by keyboard, because a long equation scrolls inside it at 380 px', () => {
    render(<EquationChip label="Phương trình">x</EquationChip>);
    expect(screen.getByRole('group', { name: 'Phương trình' })).toHaveAttribute('tabindex', '0');
  });
});
