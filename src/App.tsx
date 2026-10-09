import type { MainBench } from './ui/benchStore';
import { isBenchMainThreadRequested, isBenchRequested } from './ui/describe';
import BenchPanel from './ui/BenchPanel';
import Lab from './ui/Lab';
import type { SimClient } from './workers/simClient';
import { createWorkerClient } from './workers/spawn';

/**
 * The main-thread benchmark of `?bench=1&thread=main`, loaded with `import()` so that the
 * computation stays out of the main bundle and nothing but that page ever pulls it in.
 */
async function loadMainThreadBench(): Promise<MainBench> {
  return (await import('./ui/benchMainThread')).createMainThreadBench();
}

interface Props {
  /** Starts the simulation worker. Tests pass a stable function that answers without a Worker. */
  createClient?: () => SimClient;
  /** Starts the main-thread benchmark (`?bench=1&thread=main` only). Tests pass a fake. */
  createMainBench?: () => Promise<MainBench>;
}

export default function App({
  createClient = createWorkerClient,
  createMainBench = loadMainThreadBench,
}: Props) {
  const bench = isBenchRequested(window.location.search);
  const mainThread = isBenchMainThreadRequested(window.location.search);
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
      {bench ? (
        <BenchPanel
          createClient={createClient}
          createMainBench={mainThread ? createMainBench : undefined}
        />
      ) : (
        <Lab createClient={createClient} />
      )}
    </div>
  );
}
