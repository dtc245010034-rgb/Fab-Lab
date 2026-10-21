interface Option<T> {
  value: T;
  label: string;
}

interface Props<T> {
  /** Names the group, e.g. "Nguồn sáng". */
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** One choice out of a few, as a row of buttons; the chosen one is pressed. */
export default function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          // choosing what is already chosen changes nothing, so it must not start a recompute
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
