/**
 * What the lithography cross-section says for screen readers. Short strings built from numbers;
 * the lessons themselves are in src/content/vi/m03/.
 */
import { resistThicknessNm } from '../physics/litho';
import type { DimensionMetrics } from '../render/canvas2d/crossSection';
import { formatApproxNm } from '../render/canvas2d/pixels';
import type { M03View } from '../sim/m03';
import { nmVi } from './numbers';

/** The picture at its stage: bare oxide, coated, exposed (latent image), developed. */
export function describeM03Section(view: M03View): string {
  const e = view.exposure;
  const cellNm = view.section.cellNm;
  switch (view.stage) {
    case 'ox':
      return 'Mặt cắt wafer: oxit trần, chưa phủ resist.';
    case 'resist':
      return `Mặt cắt wafer: oxit đã phủ resist dày ${nmVi(resistThicknessNm(e.spinRpm))}, chưa chiếu sáng.`;
    case 'exposed':
      return 'Mặt cắt wafer: resist đã chiếu sáng; vùng cửa sổ là ảnh ẩn, chưa tráng.';
    case 'developed':
      if (e.cleanToFoot) {
        return `Mặt cắt wafer sau khi tráng: cửa sổ mở tới oxit, ở chân resist rộng ${formatApproxNm(e.printedNm, cellNm)}, ở đỉnh ${formatApproxNm(e.cdTopNm, cellNm)}.`;
      }
      if (e.openAtTop) {
        return `Mặt cắt wafer sau khi tráng: cửa sổ mở ở đỉnh nhưng còn cặn dày ${nmVi(e.scumNm)} ở chân nên chưa tới oxit.`;
      }
      return 'Mặt cắt wafer sau khi tráng: cửa sổ không mở (không có cửa sổ, hoặc còn màng che phía trên).';
  }
}

/**
 * What the dimension line on the picture is told: the width of the window at the foot of the
 * resist, only once it is developed and open to the oxide (before that there is no window to
 * measure, and a window blocked by scum has no width at the foot). There is no etch yet, so no
 * bottom line.
 */
export function dimensionMetrics(view: Pick<M03View, 'stage' | 'exposure'>): DimensionMetrics {
  const { stage, exposure } = view;
  return {
    topNm: stage === 'developed' && exposure.cleanToFoot ? exposure.printedNm : 0,
    bottomNm: 0,
    cleared: false,
  };
}
