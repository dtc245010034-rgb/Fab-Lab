/**
 * What to watch in a print that is right. Out of focus, an overbaked resist and a wrong develop
 * time explain a defect when there is one (they are then causes in the verdict); when the print is
 * right they are not defects, and these sentences say so, in a "Lưu ý" apart from the verdict.
 * Learner copy, Vietnamese. Only types come from sim/ and physics/exposure.
 */
import { constants } from '../../../physics/constants';
import type { ExposureResult } from '../../../physics/exposure';
import { resistThicknessNm } from '../../../physics/litho';
import type { CauseCode } from '../../../sim/m03';
import { fixedVi, nmVi } from '../../../ui/numbers';

/** The flags that explain a defect and are not one. */
export const CAUTION_CODES = [
  'out-of-focus',
  'overbaked',
  'underdeveloped',
  'overdeveloped',
] as const satisfies readonly CauseCode[];
export type CautionCode = (typeof CAUTION_CODES)[number];

const DEVELOP = constants.litho.develop;
const STILL_RIGHT = 'Bản in vẫn đúng, nhưng';

export const cautions: Record<CautionCode, (e: ExposureResult) => string> = {
  'out-of-focus': (e) =>
    `${STILL_RIGHT} mặt phẳng lấy nét lệch ${nmVi(Math.abs(e.defocusNm))}, quá nửa độ sâu tiêu cự (DOF = ${nmVi(e.dofNm)}): biên an toàn của quy trình đã mỏng.`,
  overbaked: (e) =>
    `${STILL_RIGHT} resist nung quá (${fixedVi(e.bakeEquivalentMin, 1)} phút quy về ${constants.litho.bake.refTempC.value} °C): chất cảm quang (PAC) của resist dương phân hủy một phần, resist âm tự liên kết ngang vì nhiệt, tốc độ tan khi tráng đổi; mô hình gộp các hiệu ứng này thành liều hiệu dụng giảm, còn ×${fixedVi(e.effectiveDose, 2)}.`,
  underdeveloped: (e) =>
    `${STILL_RIGHT} thời gian tráng (${fixedVi(e.developMin, 2)} phút) ngắn hơn thời gian chuẩn (${fixedVi(DEVELOP.refMin.value, 0)} phút): rút ngắn thêm sẽ để lại cặn ở chân cửa sổ.`,
  overdeveloped: (e) =>
    `${STILL_RIGHT} tráng ${fixedVi(e.developMin, 2)} phút, lâu hơn ${fixedVi(DEVELOP.overdevelopAboveRel.value, 1)} lần thời gian chuẩn: resist còn lại mỏng đi, từ ${nmVi(resistThicknessNm(e.spinRpm))} xuống ${nmVi(e.resistThicknessNm)}.`,
};
