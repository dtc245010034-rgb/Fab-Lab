import { useId } from 'react';
import { constants } from '../physics/constants';
import type { ProcessWindow } from '../physics/processWindow';
import { nearestIndex, windowLayout } from '../render/charts/chartGeometry';
import { fixedVi } from './numbers';

const SIZE = { width: 340, height: 230 } as const;

interface Props {
  window: ProcessWindow;
  /** The dose and focus chosen now; the marker sits on the nearest sample. */
  current: { dose: number; defocusNm: number };
  /** The chart was computed for an earlier choice of something it depends on and is being redone. */
  stale?: boolean;
}

/**
 * Dose against focus: every sample of the grid that prints a clean window of the right size is
 * hatched, and the setting now chosen is a marked point. The state is told by hatching, a shape
 * and words, never by colour alone.
 */
export default function ProcessWindowChart({ window, current, stale = false }: Props) {
  const hatchId = useId();
  const l = windowLayout(window, current, SIZE);
  const columns = window.doses.length;
  const total = window.pass.length;
  const col = nearestIndex(window.doses, current.dose);
  const row = nearestIndex(window.defocusNm, current.defocusNm);
  const inside = window.pass[row * columns + col] === 1;
  const plotBottom = l.plot.y + l.plot.h;
  const lowest = window.defocusNm[0]!;
  const highest = window.defocusNm[window.defocusNm.length - 1]!;
  const tolerancePct = Math.round(constants.litho.exposure.cdToleranceFraction.value * 100);

  const label =
    `Biểu đồ cửa sổ quy trình: liều từ ×${fixedVi(window.doses[0]!, 2)} đến ×${fixedVi(window.doses[columns - 1]!, 2)} theo trục ngang, ` +
    `lệch tiêu cự từ ${fixedVi(lowest, 0)} nm đến ${fixedVi(highest, 0)} nm theo trục dọc. ` +
    `${window.passCount} trên ${total} mẫu đạt.`;

  return (
    <figure className="chart chart--window" aria-busy={stale}>
      <svg viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} role="img" aria-label={label}>
        <defs>
          <pattern
            id={hatchId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect className="pw-hatch-bg" width="6" height="6" />
            <line className="pw-hatch-line" x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>
        <rect className="pw-ground" x={l.plot.x} y={l.plot.y} width={l.plot.w} height={l.plot.h} />
        {l.runs.map((r) => (
          <rect
            key={`${r.y}-${r.x}`}
            className="pw-pass"
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={`url(#${hatchId})`}
          />
        ))}
        <rect
          className="chart-frame"
          x={l.plot.x}
          y={l.plot.y}
          width={l.plot.w}
          height={l.plot.h}
        />
        {l.xTicks.map((t) => (
          <g key={t.value}>
            <line className="chart-grid" x1={t.x} x2={t.x} y1={plotBottom} y2={plotBottom + 4} />
            <text className="chart-tick" x={t.x} y={plotBottom + 15} textAnchor="middle">
              {`×${fixedVi(t.value, 2)}`}
            </text>
          </g>
        ))}
        {l.yTicks.map((t) => (
          <g key={t.y}>
            <line className="chart-grid" x1={l.plot.x - 4} x2={l.plot.x} y1={t.y} y2={t.y} />
            <text className="chart-tick" x={l.plot.x - 6} y={t.y + 3.5} textAnchor="end">
              {fixedVi(t.value, 0)}
            </text>
          </g>
        ))}
        <g className="pw-marker">
          <circle className="pw-marker-halo" cx={l.marker.x} cy={l.marker.y} r="6" />
          <circle className="pw-marker-ring" cx={l.marker.x} cy={l.marker.y} r="6" />
          <line x1={l.marker.x - 9} x2={l.marker.x + 9} y1={l.marker.y} y2={l.marker.y} />
          <line x1={l.marker.x} x2={l.marker.x} y1={l.marker.y - 9} y2={l.marker.y + 9} />
        </g>
        <text
          className="chart-axis-title"
          x={l.plot.x + l.plot.w / 2}
          y={SIZE.height - 4}
          textAnchor="middle"
        >
          Liều (×)
        </text>
        <text
          className="chart-axis-title"
          transform={`translate(11 ${l.plot.y + l.plot.h / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          Lệch tiêu cự (nm)
        </text>
      </svg>
      <figcaption className="chart-caption" role="status">
        {stale
          ? 'Đang cập nhật biểu đồ…'
          : `${window.passCount} trên ${total} mẫu đạt. Điểm đang chọn nằm ${inside ? 'trong' : 'ngoài'} vùng đạt.`}
      </figcaption>
      <ul className="chart-legend" aria-label="Chú giải">
        <li>
          <span className="pw-key pw-key--pass" aria-hidden="true" />
          Vùng đạt: sạch tới chân resist, bề rộng đúng thiết kế trong ±{tolerancePct}%
        </li>
        <li>
          <span className="pw-key pw-key--marker" aria-hidden="true" />
          Điểm đang chọn
        </li>
      </ul>
    </figure>
  );
}
