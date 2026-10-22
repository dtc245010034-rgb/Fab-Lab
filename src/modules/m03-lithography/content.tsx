import type { ReactNode } from 'react';
import Clean from '../../content/vi/m03/clean.mdx';
import Coat from '../../content/vi/m03/coat.mdx';
import Expose from '../../content/vi/m03/expose.mdx';
import ExposeMechanism from '../../content/vi/m03/exposeMechanism.mdx';
import SoftBake from '../../content/vi/m03/softbake.mdx';
import type { M03Step } from '../../sim/m03';
import EquationChip from '../../ui/EquationChip';
import type { SlotName } from '../../ui/Traveler';

/** What the MDX of this module may use as a tag. A tag that is not here fails the page, loudly. */
const MDX_COMPONENTS = { EquationChip };

type Slots = Partial<Record<SlotName, ReactNode>>;

/**
 * What each step puts in the traveler apart from its controls, which depend on the session.
 * (`Record<M03Step, …>`: TypeScript names a step that is not listed.) The MDX is typeset by KaTeX
 * when the site is built, so no maths library is in the page, only the markup and the CSS.
 */
const SLOTS: Record<M03Step, Slots> = {
  clean: { 'Cơ chế': <Clean components={MDX_COMPONENTS} /> },
  coat: { 'Cơ chế': <Coat components={MDX_COMPONENTS} /> },
  softbake: { 'Cơ chế': <SoftBake components={MDX_COMPONENTS} /> },
  expose: {
    'Cơ chế': <ExposeMechanism components={MDX_COMPONENTS} />,
    'Phương trình': <Expose components={MDX_COMPONENTS} />,
  },
  develop: {},
  inspect: {},
  overlay: {},
};

/** The slots of a step; `controls` is the content of its "Điều khiển" slot, if it has any. */
export function slotsFor(step: M03Step, controls: ReactNode = null): Slots {
  return controls === null ? SLOTS[step] : { ...SLOTS[step], 'Điều khiển': controls };
}
