// KaTeX's stylesheet and fonts belong to this page: it is loaded with import(), so `/` never asks
// for them. The markup is typeset when the site is built; only the look is needed here.
import 'katex/dist/katex.min.css';
import '../../ui/styles/kit.css';

import { useEffect } from 'react';
import { M03_STEPS } from '../../sim/m03Session';
import { useM03 } from '../../ui/useM03';
import Traveler from '../../ui/Traveler';
import ViewerPlaceholder from '../../ui/ViewerPlaceholder';
import type { M03Client } from '../../workers/m03Client';
import Controls from './controls';
import { slotsFor } from './content';
import M03Viewer from './M03Viewer';
import { metricsFor } from './metrics';
import VerdictSlot from './VerdictSlot';
import { M03_UI_STEPS } from './steps';

/**
 * M03 — lithography, at `/m03`. The cross-section follows the step; the controls change the
 * session held in the store; the worker computes the view and the process-window chart. Step 3.6
 * shows the verdict; step 3.7 (overlay) follows in the next part.
 */
export default function M03Page({ createClient }: { createClient: () => M03Client }) {
  const { state, setRecipe, goToStep } = useM03(createClient);
  const { session, shown, chart, pending, chartPending, error } = state;

  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

  const step = session?.step ?? 0;
  return (
    <main className="lab">
      {shown ? (
        <M03Viewer
          view={shown.view}
          metrics={metricsFor(M03_STEPS[shown.view.step]!, shown.view)}
          pending={pending}
          failed={error !== null}
        />
      ) : (
        <ViewerPlaceholder failed={error !== null} title="Mặt cắt quang khắc" />
      )}
      <Traveler
        steps={M03_UI_STEPS}
        step={step}
        onStepChange={goToStep}
        content={(i) => {
          const id = M03_UI_STEPS[i]!.id;
          const controls = session ? (
            <Controls
              step={id}
              session={session}
              shown={shown}
              chart={chart}
              chartPending={chartPending}
              setRecipe={setRecipe}
            />
          ) : null;
          const notes =
            id === 'inspect' ? <VerdictSlot shown={shown} pending={pending} /> : undefined;
          return slotsFor(id, { controls, notes });
        }}
      />
    </main>
  );
}
