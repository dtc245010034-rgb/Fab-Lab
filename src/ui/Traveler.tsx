import { useState, type ReactNode } from 'react';
import StepNav, { type StepNavItem } from './StepNav';

/** A step with a name of its own; a Traveler without steps shows six numbered ones. */
export type TravelerStep = StepNavItem;

/** The traveler always shows 6–7 steps, as many as the module has (docs/DESIGN.md, "Bố cục"). */
const DEFAULT_STEP_COUNT = 6;

/** Slots, in the order given by docs/DESIGN.md: mechanism → equation → controls → notes. */
export const SLOTS = ['Cơ chế', 'Phương trình', 'Điều khiển', 'Ghi chú'] as const;
export type SlotName = (typeof SLOTS)[number];

interface Props {
  steps?: readonly TravelerStep[];
  /** What a step puts in its slots; a slot left out says "Chưa có nội dung". */
  content?: (stepIndex: number) => Partial<Record<SlotName, ReactNode>>;
}

export default function Traveler({ steps, content }: Props) {
  const [step, setStep] = useState(0);
  const count = steps ? steps.length : DEFAULT_STEP_COUNT;
  const named = steps?.[step];
  const slots = content?.(step) ?? {};

  return (
    <aside className="traveler" aria-label="Phiếu công đoạn">
      <StepNav count={count} current={step} items={steps} onSelect={setStep} />
      <div className="tbody">
        <h2>{named ? `${named.code} ${named.name}` : `Bước ${step + 1}`}</h2>
        {SLOTS.map((label) => (
          <div className="slot" key={label}>
            <h3>{label}</h3>
            {slots[label] ?? <p>Chưa có nội dung.</p>}
          </div>
        ))}
        <div className="row">
          <button
            type="button"
            className="btn ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Bước trước
          </button>
          <button
            type="button"
            className="btn"
            disabled={step === count - 1}
            onClick={() => setStep((s) => Math.min(count - 1, s + 1))}
          >
            Bước sau
          </button>
        </div>
      </div>
    </aside>
  );
}
