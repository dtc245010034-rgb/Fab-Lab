// @vitest-environment jsdom
/**
 * The M03 Viewer: the picture of the stage with its description for screen readers, the legend,
 * the "illustrative" caption (rule 1), the tiles of the step and the state of the computation.
 * Canvas drawing itself is checked in a real browser; jsdom has no 2-D context.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSession, deriveView, goToStep } from '../../src/sim/m03';
import M03Viewer from '../../src/modules/m03-lithography/M03Viewer';

const viewAt = (step: number) => deriveView(goToStep(createSession(1), step));

describe('M03Viewer', () => {
  it('is a region named for lithography, with the picture described for the stage', () => {
    render(<M03Viewer view={viewAt(4)} metrics={[]} />);
    const region = screen.getByRole('region', { name: /mặt cắt quang khắc/i });
    const canvas = within(region).getByRole('img', { name: /sau khi tráng/i });
    expect(canvas.tagName).toBe('CANVAS');
    expect(canvas.getAttribute('aria-label')).toMatch(/mở tới oxit/);
  });

  it('names the stage and the size of a cell in its header', () => {
    render(<M03Viewer view={viewAt(3)} metrics={[]} />);
    expect(screen.getByText(/ảnh ẩn/i, { selector: '.vmeta *' })).toBeInTheDocument();
    expect(screen.getByText(/1 ô = 10 nm/)).toBeInTheDocument();
  });

  it('has a legend of the materials; the latent image only has an entry while it is on screen', () => {
    const { rerender } = render(<M03Viewer view={viewAt(4)} metrics={[]} />);
    const legend = () => screen.getByRole('list', { name: /chú giải vật liệu/i });
    for (const text of [/silicon/i, /oxit/i, /cản quang/i, /không khí hoặc resist đã tan/i]) {
      expect(within(legend()).getByText(text)).toBeInTheDocument();
    }
    expect(within(legend()).queryByText(/ảnh ẩn/i)).not.toBeInTheDocument();
    rerender(<M03Viewer view={viewAt(3)} metrics={[]} />);
    expect(within(legend()).getByText(/ảnh ẩn/i)).toBeInTheDocument();
  });

  it('says the numbers are illustrative values of a one-dimensional model (rule 1)', () => {
    render(<M03Viewer view={viewAt(1)} metrics={[]} />);
    expect(screen.getByText(/giá trị minh họa|số liệu minh họa/i)).toBeInTheDocument();
  });

  it('shows the tiles it is given, with their status words, and no empty list when there are none', () => {
    const { rerender } = render(
      <M03Viewer
        view={viewAt(2)}
        metrics={[
          { label: 'Nung quy về 90 °C', value: '1,00 phút', status: 'ok', word: 'Nung đủ' },
          { label: 'Tốc độ quay', value: '3000 rpm' },
        ]}
      />,
    );
    const list = screen.getByLabelText(/chỉ số của bước/i);
    expect(within(list).getByText('1,00 phút')).toBeInTheDocument();
    expect(within(list).getByText('Nung đủ')).toBeInTheDocument();
    expect(within(list).queryByText('Đạt')).not.toBeInTheDocument();
    rerender(<M03Viewer view={viewAt(2)} metrics={[]} />);
    expect(screen.queryByLabelText(/chỉ số của bước/i)).not.toBeInTheDocument();
  });

  it('is busy, and says so after a wait, while the next picture is computed', () => {
    const { rerender } = render(<M03Viewer view={viewAt(1)} metrics={[]} />);
    const region = screen.getByRole('region', { name: /mặt cắt quang khắc/i });
    expect(region).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(<M03Viewer view={viewAt(1)} metrics={[]} pending />);
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/đang tính lại/i);
  });

  it('keeps the last picture and tells the learner when the newest computation failed', () => {
    render(<M03Viewer view={viewAt(1)} metrics={[]} failed />);
    expect(screen.getByRole('alert')).toHaveTextContent(/không tính được/i);
    expect(screen.getByRole('img', { name: /resist/i })).toBeInTheDocument();
  });
});
