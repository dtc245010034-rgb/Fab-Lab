import type { ReactNode } from 'react';

/**
 * The frame of the one equation of a step. A long equation scrolls inside the chip rather than
 * widening the page (no horizontal page scroll at 380 px), so the chip takes the keyboard focus.
 */
export default function EquationChip({ label, children }: { label: string; children: ReactNode }) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroll area must be focusable
    <div className="eq" role="group" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
