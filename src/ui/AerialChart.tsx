import type { AerialProfile } from '../physics/exposure';
import { aerialLayout, type Point } from '../render/charts/chartGeometry';
import { fixedVi, nmVi } from './numbers';

const SIZE = { width: 340, height: 210 } as const;

const toPoints = (list: Point[]) =>
  list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** "±450 nm", or that the curve never reaches the level. */
const edgeText = (halfWidthNm: number) => (halfWidthNm > 0 ? `±${nmVi(halfWidthNm)}` : 'không cắt');

const KEYS = [
  { cls: 'mask', text: 'Mặt nạ (lý tưởng, không nhòe)' },
  { cls: 'best', text: 'Ảnh ở tiêu điểm tốt nhất' },
  { cls: 'curve', text: 'Ảnh ở lệch tiêu cự hiện tại' },
  { cls: 'top', text: 'Ngưỡng ở đỉnh resist' },
  { cls: 'foot', text: 'Ngưỡng ở chân resist' },
] as const;

/**
 * The light across the window (the aerial image) at the focus chosen, beside the same at best
 * focus and the ideal mask, with the two levels at which the resist dissolves: one at the top of
 * the film and a higher one at its foot. Where the curve crosses a level is the edge of the
 * window at that depth. Lines are told apart by dash and by the legend, not by colour alone.
 */
export default function AerialChart({ profile }: { profile: AerialProfile }) {
  const l = aerialLayout(profile, SIZE);
  const positive = profile.polarity === 'positive';
  const plotRight = l.plot.x + l.plot.w;
  const plotBottom = l.plot.y + l.plot.h;
  const label =
    `Ảnh trên không, ${positive ? 'resist dương' : 'resist âm'}: đường cong cắt ngưỡng ở đỉnh resist tại ` +
    `${edgeText(profile.edgeTopNm)} và ngưỡng ở chân resist tại ${edgeText(profile.edgeFootNm)}.`;

  const levelLabel = (name: string, level: typeof l.levelTop) =>
    `${name}${level.clipped ? ' (ngoài thang)' : ''}`;
  /** A guide from a level down to the axis, where the curve crosses it. */
  const guide = (cls: string, edges: [number, number], level: typeof l.levelTop, edgeNm: number) =>
    edgeNm > 0 &&
    edges.map((x) => <line key={x} className={cls} x1={x} x2={x} y1={level.y} y2={plotBottom} />);

  return (
    <figure className="chart chart--aerial">
      <svg viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} role="img" aria-label={label}>
        {l.yTicks.map((t) => (
          <g key={t.value}>
            <line className="chart-grid" x1={l.plot.x} x2={plotRight} y1={t.y} y2={t.y} />
            <text className="chart-tick" x={l.plot.x - 5} y={t.y + 3.5} textAnchor="end">
              {fixedVi(t.value, 1)}
            </text>
          </g>
        ))}
        {l.xTicks.map((t) => (
          <text
            key={t.value}
            className="chart-tick"
            x={t.x}
            y={plotBottom + 14}
            textAnchor="middle"
          >
            {fixedVi(t.value, 0)}
          </text>
        ))}
        <rect
          className="chart-frame"
          x={l.plot.x}
          y={l.plot.y}
          width={l.plot.w}
          height={l.plot.h}
        />
        {guide('ac-edge-top', l.topEdges, l.levelTop, profile.edgeTopNm)}
        {guide('ac-edge-foot', l.footEdges, l.levelFoot, profile.edgeFootNm)}
        <polyline className="ac-mask" points={toPoints(l.mask)} />
        <polyline className="ac-best" points={toPoints(l.bestFocus)} />
        <polyline className="ac-curve" points={toPoints(l.curve)} />
        <line
          className="ac-level-top"
          x1={l.plot.x}
          x2={plotRight}
          y1={l.levelTop.y}
          y2={l.levelTop.y}
        />
        <line
          className="ac-level-foot"
          x1={l.plot.x}
          x2={plotRight}
          y1={l.levelFoot.y}
          y2={l.levelFoot.y}
        />
        <text className="chart-note" x={plotRight - 3} y={l.levelTop.y + 12} textAnchor="end">
          {levelLabel('ngưỡng đỉnh', l.levelTop)}
        </text>
        <text className="chart-note" x={plotRight - 3} y={l.levelFoot.y - 4} textAnchor="end">
          {levelLabel('ngưỡng chân', l.levelFoot)}
        </text>
        <text
          className="chart-axis-title"
          x={l.plot.x + l.plot.w / 2}
          y={SIZE.height - 4}
          textAnchor="middle"
        >
          Vị trí ngang cửa sổ (nm)
        </text>
        <text
          className="chart-axis-title"
          transform={`translate(11 ${l.plot.y + l.plot.h / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          Ánh sáng tương đối
        </text>
      </svg>
      <figcaption className="chart-caption">
        {positive
          ? 'Resist dương tan ở nơi đường cong nằm trên đường ngưỡng. Ngưỡng ở chân cao hơn ngưỡng ở đỉnh (ánh sáng yếu dần theo độ sâu), nên cửa sổ hẹp dần xuống chân.'
          : 'Resist âm tan ở nơi đường cong nằm dưới đường ngưỡng. Ngưỡng ở chân cao hơn ngưỡng ở đỉnh (ánh sáng yếu dần theo độ sâu), nên cửa sổ rộng dần xuống chân.'}
      </figcaption>
      <ul className="chart-legend" aria-label="Chú giải">
        {KEYS.map(({ cls, text }) => (
          <li key={cls}>
            <span className={`ac-key ac-key--${cls}`} aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
    </figure>
  );
}
