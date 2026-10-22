import { useMemo } from 'react';
import { MATERIAL_TOKENS } from '../../render/canvas2d/palette';
import type { LithoStage } from '../../sim/grid';
import type { M03View } from '../../sim/m03';
import CrossSectionCanvas from '../../ui/CrossSectionCanvas';
import { describeM03Section, dimensionMetrics } from '../../ui/describeM03';
import MetricTile from '../../ui/MetricTile';
import { fixedVi } from '../../ui/numbers';
import { ComputeFailedNotice } from '../../ui/ViewerPlaceholder';
import type { MetricSpec } from './metrics';

/** Words in front of the ≈ size drawn on the canvas: the window at the foot of the resist. */
const LABELS = { top: 'chân', bottom: 'đáy' } as const;

const STAGE_NAMES: Readonly<Record<LithoStage, string>> = {
  ox: 'Oxit trần',
  resist: 'Đã phủ resist',
  exposed: 'Đã chiếu sáng (ảnh ẩn)',
  developed: 'Đã tráng',
};

const LEGEND = [
  { material: 'si', label: 'Silicon (Si)' },
  { material: 'ox', label: 'Oxit (SiO₂)' },
  { material: 'pr', label: 'Cản quang (resist)' },
  { material: 'air', label: 'Không khí hoặc resist đã tan' },
] as const;

interface Props {
  /** The view `metrics` and the picture were computed from (not a newer one still on its way). */
  view: M03View;
  metrics: readonly MetricSpec[];
  /** A newer view is being computed; this one stays on screen until it lands. */
  pending?: boolean;
  /** The newest computation failed; this is the last good view. */
  failed?: boolean;
}

/** The lithography cross-section at the stage of the current step, with the tiles of the step. */
export default function M03Viewer({ view, metrics, pending = false, failed = false }: Props) {
  const { section, exposure, stage } = view;
  const canvasView = useMemo(
    () => ({ section, metrics: dimensionMetrics({ stage, exposure }) }),
    [section, stage, exposure],
  );

  return (
    <section className="viewer" aria-labelledby="viewer-title" aria-busy={pending}>
      <div className="vhead">
        <h2 id="viewer-title">Mặt cắt quang khắc</h2>
        <span className="vmeta">
          <span>{STAGE_NAMES[stage]}</span>
          {' · '}
          <span>1 ô = {fixedVi(section.cellNm, 0)} nm</span>
        </span>
        {pending && (
          <span className="vstate" role="status">
            Đang tính lại…
          </span>
        )}
      </div>
      <div className="screen">
        <CrossSectionCanvas
          view={canvasView}
          ariaLabel={describeM03Section(view)}
          labels={LABELS}
        />
      </div>
      {failed && <ComputeFailedNotice />}
      <ul className="legend" aria-label="Chú giải vật liệu">
        {LEGEND.map(({ material, label }) => (
          <li key={material}>
            <span
              className="swatch"
              style={{ background: `var(${MATERIAL_TOKENS[material]})` }}
              aria-hidden="true"
            />
            {label}
          </li>
        ))}
        {stage === 'exposed' && (
          <li>
            <span className="swatch swatch--latent" aria-hidden="true" />
            Ảnh ẩn: đã chiếu sáng, chưa tráng
          </li>
        )}
      </ul>
      <p className="caption">Mô hình một chiều, số liệu minh họa: chỉ đúng về xu hướng.</p>
      {metrics.length > 0 && (
        <dl className="metrics" aria-label="Chỉ số của bước">
          {metrics.map((m) => (
            <MetricTile key={m.label} label={m.label} value={m.value} status={m.status} />
          ))}
        </dl>
      )}
    </section>
  );
}
