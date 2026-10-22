import type { ReactNode } from 'react';
import Clean from '../../content/vi/m03/clean.mdx';
import Coat from '../../content/vi/m03/coat.mdx';
import CoatEquation from '../../content/vi/m03/coatEquation.mdx';
import Develop from '../../content/vi/m03/develop.mdx';
import DevelopNote from '../../content/vi/m03/developNote.mdx';
import Expose from '../../content/vi/m03/expose.mdx';
import ExposeMechanism from '../../content/vi/m03/exposeMechanism.mdx';
import ExposeNote from '../../content/vi/m03/exposeNote.mdx';
import Inspect from '../../content/vi/m03/inspect.mdx';
import ModelLimitsText from '../../content/vi/m03/modelLimits.mdx';
import SoftBake from '../../content/vi/m03/softbake.mdx';
import type { M03Step } from '../../sim/m03';
import EquationChip from '../../ui/EquationChip';
import ModelLimits from '../../ui/ModelLimits';
import type { SlotName } from '../../ui/Traveler';

/** What the MDX of this module may use as a tag. A tag that is not here fails the page, loudly. */
const MDX_COMPONENTS = { EquationChip };

type Slots = Partial<Record<SlotName, ReactNode>>;

/**
 * What each step puts in the traveler apart from its controls, which depend on the session.
 * (`Record<M03Step, …>`: TypeScript names a step that is not listed.) The MDX is typeset by KaTeX
 * when the site is built, so no maths library is in the page, only the markup and the CSS.
 *
 * A slot is written or `null`: `null` drops the slot with its heading (the step has nothing to put
 * there), so a step of 3.1 – 3.6 never says "Chưa có nội dung.". The notes of step 3.6, the verdict,
 * depend on the session and come from `slotsFor`.
 */
const SLOTS: Record<M03Step, Slots> = {
  clean: {
    'Cơ chế': <Clean components={MDX_COMPONENTS} />,
    'Phương trình': null,
    'Ghi chú': null,
  },
  coat: {
    'Cơ chế': <Coat components={MDX_COMPONENTS} />,
    'Phương trình': <CoatEquation components={MDX_COMPONENTS} />,
    'Ghi chú': null,
  },
  softbake: {
    'Cơ chế': <SoftBake components={MDX_COMPONENTS} />,
    'Phương trình': null,
    'Ghi chú': null,
  },
  expose: {
    'Cơ chế': <ExposeMechanism components={MDX_COMPONENTS} />,
    'Phương trình': <Expose components={MDX_COMPONENTS} />,
    'Ghi chú': (
      <>
        <ExposeNote components={MDX_COMPONENTS} />
        <ModelLimits>
          <ModelLimitsText components={MDX_COMPONENTS} />
        </ModelLimits>
      </>
    ),
  },
  develop: {
    'Cơ chế': <Develop components={MDX_COMPONENTS} />,
    'Phương trình': null,
    'Ghi chú': <DevelopNote components={MDX_COMPONENTS} />,
  },
  inspect: {
    'Cơ chế': <Inspect components={MDX_COMPONENTS} />,
    'Phương trình': null,
  },
  overlay: {},
};

/**
 * The slots of a step: what the MDX gives it, and what depends on the session (the controls, and
 * the notes of the step that has a verdict) added to it.
 */
export function slotsFor(
  step: M03Step,
  extra: { controls?: ReactNode; notes?: ReactNode } = {},
): Slots {
  const slots: Slots = { ...SLOTS[step] };
  if (extra.controls != null) slots['Điều khiển'] = extra.controls;
  if (extra.notes != null) slots['Ghi chú'] = extra.notes;
  return slots;
}
