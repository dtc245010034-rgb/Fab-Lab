import { useMemo } from 'react';
import { MATERIAL_TOKENS } from '../render/canvas2d/palette';
import type { Recipe, RecipeResult } from '../sim/recipe';
import CrossSectionCanvas from './CrossSectionCanvas';
import { describeRecipe, describeSection, formatMs, formatViNumber } from './describe';
import { ComputeFailedNotice } from './ViewerPlaceholder';

const METRIC_SLOTS = ['Chỉ số 1', 'Chỉ số 2', 'Chỉ số 3'] as const;

const LEGEND = [
  { material: 'si', label: 'Silicon (Si)' },
  { material: 'ox', label: 'Oxit (SiO₂)' },
  { material: 'pr', label: 'Cản quang (resist)' },
  { material: 'air', label: 'Không khí hoặc phần đã khắc' },
] as const;

/** Words in front of the ≈ sizes drawn on the canvas. */
const LABELS = { top: 'đỉnh', bottom: 'đáy' } as const;

interface Props {
  /** The recipe `result` was computed from (not a newer one still being computed). */
  recipe: Recipe;
  result: RecipeResult;
  /** A newer result is being computed; this one stays on screen until it lands. */
  pending?: boolean;
  /** The newest computation failed; this is the last good result. */
  failed?: boolean;
  /** Show how long the computation took (`?debug=1`). */
  debug?: boolean;
}

export default function Viewer({
  recipe,
  result,
  pending = false,
  failed = false,
  debug = false,
}: Props) {
  const { section, field, metrics, timingsMs } = result;
  const view = useMemo(
    () => ({ section, field, metrics, timeMin: recipe.etch.timeMin }),
    [section, field, metrics, recipe.etch.timeMin],
  );

  return (
    <section className="viewer" aria-labelledby="viewer-title" aria-busy={pending}>
      <div className="vhead">
        <h2 id="viewer-title">Mặt cắt wafer</h2>
        <span className="vmeta">
          <span>{describeRecipe(recipe.etch)}</span>
          {' · '}
          <span>1 ô = {formatViNumber(section.cellNm)} nm</span>
        </span>
        {pending && (
          <span className="vstate" role="status">
            Đang tính lại…
          </span>
        )}
      </div>
      <div className="screen">
        <CrossSectionCanvas
          view={view}
          ariaLabel={describeSection(metrics, section.cellNm)}
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
      </ul>
      <p className="caption">Mô hình hình học đơn giản, số liệu minh họa: chỉ đúng về xu hướng.</p>
      {debug && (
        <p className="debug">
          <span>runRecipe {formatMs(timingsMs.total)}</span>
          <span>arrivalTime {formatMs(timingsMs.arrival)}</span>
        </p>
      )}
      <dl className="metrics">
        {METRIC_SLOTS.map((label) => (
          <div className="metric" key={label}>
            <dt>{label}</dt>
            <dd>—</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
