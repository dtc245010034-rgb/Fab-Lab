import { DEFAULT_GRID_SPEC } from '../sim/defaults';

/** Shown under the picture (or the empty frame) when the newest computation failed. */
export function ComputeFailedNotice() {
  return (
    <p className="notice" role="alert">
      Không tính được mặt cắt. Hãy tải lại trang để thử lại.
    </p>
  );
}

/**
 * The Viewer's frame before the first result exists: the same header and a screen of the same
 * proportions, so the page does not jump when the picture arrives.
 */
export default function ViewerPlaceholder({ failed }: { failed: boolean }) {
  const { widthCells, heightCells } = DEFAULT_GRID_SPEC;
  return (
    <section className="viewer" aria-labelledby="viewer-title" aria-busy={!failed}>
      <div className="vhead">
        <h2 id="viewer-title">Mặt cắt wafer</h2>
      </div>
      <div className="screen placeholder" style={{ aspectRatio: `${widthCells} / ${heightCells}` }}>
        {failed ? <p>Chưa có mặt cắt.</p> : <p role="status">Đang tính mặt cắt…</p>}
      </div>
      {failed && <ComputeFailedNotice />}
    </section>
  );
}
