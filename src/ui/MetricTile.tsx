import { STATUS_WORDS, type Status } from './status';

interface Props {
  label: string;
  /** Already formatted, with its unit: "1,4 µm". */
  value: string;
  status?: Status;
}

/** One figure for a `<dl className="metrics">`. A status is a colour and a word. */
export default function MetricTile({ label, value, status }: Props) {
  return (
    <div className={status ? `metric metric--${status}` : 'metric'}>
      <dt>{label}</dt>
      <dd>
        {value}
        {status && <span className="metric-status">{STATUS_WORDS[status]}</span>}
      </dd>
    </div>
  );
}
