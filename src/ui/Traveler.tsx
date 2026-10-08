import { useState } from 'react';
import StepNav from './StepNav';

/** The traveler always shows six steps (docs/DESIGN.md, "Bố cục"). */
const STEP_COUNT = 6;

/** Empty slots, in the order given by docs/DESIGN.md: mechanism → equation → controls → notes. */
const SLOTS = ['Cơ chế', 'Phương trình', 'Điều khiển', 'Ghi chú'] as const;

export default function Traveler() {
  const [step, setStep] = useState(0);

  return (
    <aside className="traveler" aria-label="Phiếu công đoạn">
      <StepNav count={STEP_COUNT} current={step} onSelect={setStep} />
      <div className="tbody">
        <h2>Bước {step + 1}</h2>
        {SLOTS.map((label) => (
          <div className="slot" key={label}>
            <h3>{label}</h3>
            <p>Chưa có nội dung.</p>
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
            disabled={step === STEP_COUNT - 1}
            onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
          >
            Bước sau
          </button>
        </div>
      </div>
    </aside>
  );
}
