import { isBenchRequested } from './ui/describe';
import BenchPanel from './ui/BenchPanel';
import Lab from './ui/Lab';
import type { SimClient } from './workers/simClient';
import { createWorkerClient } from './workers/spawn';

interface Props {
  /** Starts the simulation worker. Tests pass a stable function that answers without a Worker. */
  createClient?: () => SimClient;
}

export default function App({ createClient = createWorkerClient }: Props) {
  const bench = isBenchRequested(window.location.search);
  return (
    <div className="app">
      <header className="app-head">
        <p className="eyebrow">Phòng sạch · đèn vàng</p>
        <h1>Fab Lab</h1>
        <p className="sub">
          Học chế tạo chip bằng cách tự tay làm: chỉnh thông số từng công đoạn và xem mặt cắt wafer
          thay đổi.
        </p>
      </header>
      {bench ? <BenchPanel createClient={createClient} /> : <Lab createClient={createClient} />}
    </div>
  );
}
