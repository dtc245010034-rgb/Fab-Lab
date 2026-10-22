import { STATUS_WORDS, type Status } from './status';

interface Props {
  label: string;
  /** Already formatted, with its unit: "1,4 µm". */
  value: string;
  status?: Status;
  /** The word beside the status, when the shared Đạt / Cảnh báo / Lỗi would say something else. */
  word?: string;
}

/** One figure for a `<dl className="metrics">`. A status is a colour and a word. */
export default function MetricTile({ label, value, status, word }: Props) {
  return (
    <div className={status ? `metric metric--${status}` : 'metric'}>
      <dt>{label}</dt>
      <dd>
        {value}
        {status && <span className="metric-status">{word ?? STATUS_WORDS[status]}</span>}
      </dd>
    </div>
  );
}
