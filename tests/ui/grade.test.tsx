// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Grade from '../../src/ui/Grade';
import ModelLimits from '../../src/ui/ModelLimits';

describe('Grade', () => {
  it('is labelled "Phán quyết:", gives the word and the sentence that says why', () => {
    render(<Grade tone="bad" word="Hỏng" why="Cặn resist dày 12 nm còn ở chân cửa sổ." />);
    const grade = screen.getByRole('region', { name: /phán quyết/i });
    expect(within(grade).getByText('Phán quyết:')).toBeInTheDocument();
    expect(within(grade).getByText('Hỏng')).toBeInTheDocument();
    expect(within(grade).getByText(/cặn resist dày 12 nm/i)).toBeInTheDocument();
  });

  it('carries the tone as a class, so the colour has the word beside it', () => {
    const { container, rerender } = render(<Grade tone="ok" word="Đạt" why="Đúng kích thước." />);
    expect(container.querySelector('.grade')).toHaveClass('grade--ok');
    rerender(<Grade tone="warn" word="Biên" why="Hẹp hơn thiết kế." />);
    expect(container.querySelector('.grade')).toHaveClass('grade--warn');
    expect(container.querySelector('.grade')).not.toHaveClass('grade--ok');
  });

  it('is not a Note: no note role, no Note class, no Đạt / Cảnh báo / Lỗi tag', () => {
    const { container } = render(<Grade tone="warn" word="Biên" why="Hẹp hơn thiết kế." />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(container.querySelector('.note')).toBeNull();
    for (const word of ['Cảnh báo', 'Lỗi']) expect(container).not.toHaveTextContent(word);
  });

  it('lists the other causes after "Còn lại", and says nothing when there are none', () => {
    const { rerender } = render(
      <Grade tone="bad" word="Hỏng" why="Một." others={['Cặn ở chân', 'Sai kích thước']} />,
    );
    const list = screen.getByRole('list', { name: /nguyên nhân còn lại/i });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Cặn ở chân', 'Sai kích thước']);
    rerender(<Grade tone="ok" word="Đạt" why="Một." others={[]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText(/còn lại/i)).not.toBeInTheDocument();
  });

  it('is busy while the next verdict is computed, and the old one stays', () => {
    const { rerender } = render(<Grade tone="ok" word="Đạt" why="Một." />);
    const region = screen.getByRole('region', { name: /phán quyết/i });
    expect(region).toHaveAttribute('aria-busy', 'false');
    rerender(<Grade tone="ok" word="Đạt" why="Một." busy />);
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Đạt')).toBeInTheDocument();
  });

  it('shows what it is given below the sentence', () => {
    render(
      <Grade tone="ok" word="Đạt" why="Một.">
        <p>Chưa tính căn chỉnh lớp.</p>
      </Grade>,
    );
    expect(screen.getByText('Chưa tính căn chỉnh lớp.')).toBeInTheDocument();
  });
});

describe('ModelLimits', () => {
  it('is a closed disclosure titled "Giới hạn của mô hình" that holds what it is given', () => {
    const { container } = render(
      <ModelLimits>
        <p>Một độ nhòe cho cả độ dày resist.</p>
      </ModelLimits>,
    );
    const details = container.querySelector('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(container.querySelector('summary')).toHaveTextContent('Giới hạn của mô hình');
    expect(within(details).getByText(/một độ nhòe/i)).toBeInTheDocument();
  });
});
