import { formatViNumber } from './describe';

interface Props {
  /** Ties the label and the readout to the input; unique on the page. */
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** How the value is written; a decimal comma by default. */
  format?: (value: number) => string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/** A labelled range input whose value is written out with its unit, for the eye and for speech. */
export default function ParamSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  format = formatViNumber,
  disabled = false,
  onChange,
}: Props) {
  const text = unit ? `${format(value)} ${unit}` : format(value);
  return (
    <div className="ctl">
      <div className="ctl-head">
        <label htmlFor={id}>{label}</label>
        {/* aria-live off: the slider reads out its own aria-valuetext as it moves */}
        <output htmlFor={id} aria-live="off">
          {text}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={text}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
