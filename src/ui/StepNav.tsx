interface StepNavProps {
  count: number;
  /** Zero-based index of the current step. */
  current: number;
  onSelect: (index: number) => void;
}

export default function StepNav({ count, current, onSelect }: StepNavProps) {
  return (
    <nav className="steps" aria-label="Các bước">
      <ol>
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              aria-label={`Bước ${i + 1}`}
              aria-current={i === current ? 'step' : undefined}
              onClick={() => onSelect(i)}
            >
              <em>{i + 1}</em>
              <span>Bước</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
