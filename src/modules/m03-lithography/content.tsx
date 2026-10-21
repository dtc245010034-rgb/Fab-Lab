import type { ReactNode } from 'react';
import Expose from '../../content/vi/m03/expose.mdx';
import type { M03Step } from '../../sim/m03';
import EquationChip from '../../ui/EquationChip';
import type { SlotName } from '../../ui/Traveler';

/** What the MDX of this module may use as a tag. A tag that is not here fails the page, loudly. */
const MDX_COMPONENTS = { EquationChip };

/**
 * What each step puts in the traveler. Steps not listed have no text yet. The MDX is typeset by
 * KaTeX when the site is built, so no maths library is in the page, only the markup and the CSS.
 */
const SLOTS: Partial<Record<M03Step, Partial<Record<SlotName, ReactNode>>>> = {
  expose: { 'Phương trình': <Expose components={MDX_COMPONENTS} /> },
};

export function slotsFor(step: M03Step): Partial<Record<SlotName, ReactNode>> {
  return SLOTS[step] ?? {};
}
