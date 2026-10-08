const METRIC_SLOTS = ['Chỉ số 1', 'Chỉ số 2', 'Chỉ số 3'] as const;

const EMPTY_LABEL = 'Mặt cắt wafer: chưa có dữ liệu mô phỏng';

export default function Viewer() {
  return (
    <section className="viewer" aria-labelledby="viewer-title">
      <div className="vhead">
        <h2 id="viewer-title">Mặt cắt wafer</h2>
        <span>Chưa có dữ liệu mô phỏng</span>
      </div>
      <div className="screen">
        <canvas width={400} height={250} role="img" aria-label={EMPTY_LABEL} />
      </div>
      <p className="legend">Chú giải vật liệu sẽ hiện ở đây.</p>
      <dl className="metrics">
        {METRIC_SLOTS.map((label) => (
          <div className="metric" key={label}>
            <dt>{label}</dt>
            <dd>—</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
