import { useEffect } from 'react';
import { DEFAULT_RECIPE } from './sim/defaults';
import { isDebugRequested } from './ui/describe';
import Traveler from './ui/Traveler';
import { useRecipeResult } from './ui/useRecipeResult';
import Viewer from './ui/Viewer';
import ViewerPlaceholder from './ui/ViewerPlaceholder';
import type { SimClient } from './workers/simClient';
import { createWorkerClient } from './workers/spawn';

interface Props {
  /** Starts the simulation worker. Tests pass a stable function that answers without a Worker. */
  createClient?: () => SimClient;
}

export default function App({ createClient = createWorkerClient }: Props) {
  const { shown, pending, error } = useRecipeResult(DEFAULT_RECIPE, createClient);

  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

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
      <main className="lab">
        {shown ? (
          <Viewer
            recipe={shown.recipe}
            result={shown.result}
            pending={pending}
            failed={error !== null}
            debug={isDebugRequested(window.location.search)}
          />
        ) : (
          <ViewerPlaceholder failed={error !== null} />
        )}
        <Traveler />
      </main>
    </div>
  );
}
