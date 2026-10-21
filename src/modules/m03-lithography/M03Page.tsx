// KaTeX's stylesheet and fonts belong to this page: it is loaded with import(), so `/` never asks
// for them. The markup is typeset when the site is built; only the look is needed here.
import 'katex/dist/katex.min.css';
import '../../ui/styles/kit.css';

import { DEFAULT_GRID_SPEC } from '../../sim/defaults';
import Traveler from '../../ui/Traveler';
import { slotsFor } from './content';
import { M03_UI_STEPS } from './steps';

/** M03 — lithography, at `/m03`. The cross-section and the controls follow in the next steps. */
export default function M03Page() {
  const { widthCells, heightCells } = DEFAULT_GRID_SPEC;
  return (
    <main className="lab">
      <section className="viewer" aria-labelledby="viewer-title">
        <div className="vhead">
          <h2 id="viewer-title">Mặt cắt quang khắc</h2>
        </div>
        <div
          className="screen placeholder"
          style={{ aspectRatio: `${widthCells} / ${heightCells}` }}
        >
          <p>Chưa có mặt cắt.</p>
        </div>
      </section>
      <Traveler steps={M03_UI_STEPS} content={(i) => slotsFor(M03_UI_STEPS[i]!.id)} />
    </main>
  );
}
