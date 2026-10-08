import Traveler from './ui/Traveler';
import Viewer from './ui/Viewer';

export default function App() {
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
        <Viewer />
        <Traveler />
      </main>
    </div>
  );
}
