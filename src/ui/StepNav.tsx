import type { CSSProperties } from 'react';

/** A step that has a name of its own: "3.3", "Nung", "Nung mềm". */
export interface StepNavItem {
  /** The number in the module's own scheme, shown small above the label: "3.3". */
  code: string;
  /** One short word for the button (about 49 px wide at 380 px with seven steps). */
  label: string;
  /** The whole name, for the heading and for assistive technology. Contains the label. */
  name: string;
}

interface StepNavProps {
  count: number;
  /** Zero-based index of the current step. */
  current: number;
  onSelect: (index: number) => void;
  /** Names for the steps; without them the buttons are numbered "Bước 1" … "Bước n". */
  items?: readonly StepNavItem[];
}

export default function StepNav({ count, current, onSelect, items }: StepNavProps) {
  if (items && items.length !== count) {
    throw new RangeError(`StepNav: ${items.length} items for ${count} steps`);
  }
  return (
    <nav className="steps" aria-label="Các bước">
      {/* the columns follow the number of steps: .steps ol in layout.css */}
      <ol style={{ '--steps': count } as CSSProperties}>
        {Array.from({ length: count }, (_, i) => {
          const item = items?.[i];
          return (
            <li key={i}>
              <button
                type="button"
                aria-label={item ? `Bước ${item.code}: ${item.name}` : `Bước ${i + 1}`}
                aria-current={i === current ? 'step' : undefined}
                onClick={() => onSelect(i)}
              >
                <em>{item ? item.code : i + 1}</em>
                <span>{item ? item.label : 'Bước'}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
