// @vitest-environment jsdom
/**
 * The two charts of step 3.4 as markup: what they say to a screen reader, that the state is carried
 * by shape and words and not by colour alone, and that they follow the numbers they are given.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { processWindow } from '../../src/physics/processWindow';
import { passRuns } from '../../src/render/charts/chartGeometry';
import { DEFAULT_M03_RECIPE } from '../../src/sim/defaults';
import { createSession, deriveView, setRecipe } from '../../src/sim/m03';
import { processWindowSpecFor } from '../../src/sim/windowSpec';
import AerialChart from '../../src/ui/AerialChart';
import ProcessWindowChart from '../../src/ui/ProcessWindowChart';

const aerialOf = (patch: Partial<typeof DEFAULT_M03_RECIPE> = {}) =>
  deriveView(setRecipe(createSession(1), patch)).aerial;

describe('AerialChart', () => {
  it('is an image that says where the curve crosses the two levels', () => {
    render(<AerialChart profile={aerialOf({ designNm: 900 })} />);
    const svg = screen.getByRole('img', { name: /ảnh trên không/i });
    const label = svg.getAttribute('aria-label')!;
    expect(label).toMatch(/ngưỡng ở đỉnh[^.]*±\s*\d+ nm/i);
    expect(label).toMatch(/ngưỡng ở chân[^.]*±\s*\d+ nm/i);
  });

  it('draws three curves of as many points as the profile has samples', () => {
    const profile = aerialOf();
    const { container } = render(<AerialChart profile={profile} />);
    for (const cls of ['ac-mask', 'ac-best', 'ac-curve']) {
      const line = container.querySelector(`polyline.${cls}`);
      expect(line, cls).not.toBeNull();
    }
    const points = container.querySelector('polyline.ac-curve')!.getAttribute('points')!;
    expect(points.trim().split(/\s+/)).toHaveLength(profile.xNm.length);
  });

  it('tells the lines apart by name and by dash, not by colour: each has a legend entry with its own class', () => {
    const { container } = render(<AerialChart profile={aerialOf()} />);
    const legend = screen.getByRole('list', { name: /chú giải/i });
    for (const text of [
      /mặt nạ/i,
      /tiêu điểm tốt nhất/i,
      /lệch tiêu cự hiện tại/i,
      /ngưỡng ở đỉnh/i,
      /ngưỡng ở chân/i,
    ]) {
      expect(within(legend).getByText(text)).toBeInTheDocument();
    }
    const classes = [...container.querySelectorAll('.ac-key')].map((k) => k.className);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it('says which side of the level dissolves: above it for a positive resist, below it for a negative one', () => {
    const { rerender } = render(<AerialChart profile={aerialOf()} />);
    expect(screen.getByText(/tan ở nơi đường cong nằm trên/i)).toBeInTheDocument();
    rerender(<AerialChart profile={aerialOf({ polarity: 'negative' })} />);
    expect(screen.getByText(/tan ở nơi đường cong nằm dưới/i)).toBeInTheDocument();
  });

  it('says so when a level is off the scale', () => {
    const profile = aerialOf({ dose: 0.7, softBake: { tempC: 130, timeMin: 3 } });
    render(<AerialChart profile={profile} />);
    expect(screen.getAllByText(/ngoài thang/i).length).toBeGreaterThan(0);
  });

  it('draws no colour of its own: no hex or rgb value anywhere in the markup', () => {
    const { container } = render(<AerialChart profile={aerialOf()} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
});

describe('ProcessWindowChart', () => {
  const window = processWindow(DEFAULT_M03_RECIPE, processWindowSpecFor('i'));
  const at = { dose: 1, defocusNm: 0 };

  it('is an image whose name gives the axes and how many samples pass', () => {
    render(<ProcessWindowChart window={window} current={at} />);
    const label = screen
      .getByRole('img', { name: /cửa sổ quy trình/i })
      .getAttribute('aria-label')!;
    expect(label).toContain(`${window.passCount} trên ${window.pass.length}`);
    expect(label).toMatch(/liều/i);
    expect(label).toMatch(/lệch tiêu cự/i);
  });

  it('draws one rectangle per run of passing cells, filled with the hatch', () => {
    const { container } = render(<ProcessWindowChart window={window} current={at} />);
    const runs = passRuns(window.pass, window.doses.length, window.defocusNm.length);
    const rects = container.querySelectorAll('rect.pw-pass');
    expect(rects).toHaveLength(runs.length);
    const hatch = container.querySelector('pattern')!.id;
    for (const r of rects) expect(r.getAttribute('fill')).toBe(`url(#${hatch})`);
  });

  it('gives each chart its own pattern id, so two on a page do not share one', () => {
    const { container } = render(
      <>
        <ProcessWindowChart window={window} current={at} />
        <ProcessWindowChart window={window} current={at} />
      </>,
    );
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('marks the current setting with a shape, and says in words whether it is inside the passing region', () => {
    const { container, rerender } = render(<ProcessWindowChart window={window} current={at} />);
    expect(container.querySelector('.pw-marker')).not.toBeNull();
    expect(screen.getByText(/đang chọn[^.]*trong vùng đạt/i)).toBeInTheDocument();
    rerender(<ProcessWindowChart window={window} current={{ dose: 0.7, defocusNm: 0 }} />);
    expect(screen.getByText(/đang chọn[^.]*ngoài vùng đạt/i)).toBeInTheDocument();
  });

  it('keeps the legend: passing region (hatched) and the marker', () => {
    render(<ProcessWindowChart window={window} current={at} />);
    const legend = screen.getByRole('list', { name: /chú giải/i });
    expect(within(legend).getByText(/vùng đạt/i)).toBeInTheDocument();
    expect(within(legend).getByText(/điểm đang chọn/i)).toBeInTheDocument();
  });

  it('says it is being updated, and claims nothing about the marker, while the chart is out of date', () => {
    render(<ProcessWindowChart window={window} current={at} stale />);
    expect(screen.getByText(/đang cập nhật biểu đồ/i)).toBeInTheDocument();
    expect(screen.queryByText(/trong vùng đạt|ngoài vùng đạt/i)).not.toBeInTheDocument();
  });

  it('labels the dose axis with the first and last dose, written with a decimal comma', () => {
    render(<ProcessWindowChart window={window} current={at} />);
    expect(screen.getByText('×0,70')).toBeInTheDocument();
    expect(screen.getByText('×1,30')).toBeInTheDocument();
  });

  it('draws no colour of its own', () => {
    const { container } = render(<ProcessWindowChart window={window} current={at} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
});
