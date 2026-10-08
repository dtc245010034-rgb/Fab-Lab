import { useMemo } from 'react';
import { DEFAULT_RECIPE } from './sim/defaults';
import { runRecipe } from './sim/recipe';
import { isDebugRequested } from './ui/describe';
import Traveler from './ui/Traveler';
import Viewer from './ui/Viewer';

export default function App() {
  // On the main thread for now; the worker (S0.4) takes this over.
  const result = useMemo(() => runRecipe(DEFAULT_RECIPE), []);

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
        <Viewer
          recipe={DEFAULT_RECIPE}
          result={result}
          debug={isDebugRequested(window.location.search)}
        />
        <Traveler />
      </main>
    </div>
  );
}
