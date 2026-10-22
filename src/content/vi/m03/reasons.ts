/**
 * Why a print is not Đạt: one sentence for each cause the verdict can give (sim/m03.ts `judge`),
 * and the one sentence of a print that is Đạt. Learner copy, Vietnamese; the numbers are the
 * cause's own (nm, fraction, which way to turn the dose) or the constants'. A function takes the
 * whole `Cause`, not just a size: `cd-off-size` needs the sign, the percentage and `doseAdvice`,
 * which the simulation works out where it knows the polarity of the resist, so the copy never
 * guesses which way the dose goes.
 *
 * Only types come from sim/m03.ts: its values are the lithography model, which stays in the worker.
 */
import { constants } from '../../../physics/constants';
import type { ExposureResult } from '../../../physics/exposure';
import type { Cause, CauseCode } from '../../../sim/m03';
import { fixedVi, nmVi } from '../../../ui/numbers';

const percent = (fraction: number, digits = 0) => `${fixedVi(fraction * 100, digits)}%`;
const sizeTolerance = () => percent(constants.litho.exposure.cdToleranceFraction.value);
const scumTolerance = () => percent(constants.litho.exposure.scumOkFraction.value);

/** " dày 120 nm", or nothing when the cause carries no size. */
const thick = (c: Cause) => (c.valueNm === undefined ? '' : ` dày ${nmVi(c.valueNm)}`);

/** `Record<CauseCode, …>`: TypeScript names the code that has no sentence. */
export const reasons: Record<CauseCode, (cause: Cause) => string> = {
  'below-resolution': () =>
    'Cửa sổ thiết kế nhỏ hơn mức độ nhòe hiện tại cho phép mở: ngay ở liều chuẩn ×1 và thời gian tráng chuẩn, mô hình này không mở được cửa sổ nào. Hãy tăng độ rộng thiết kế, chọn nguồn sáng bước sóng ngắn hơn hoặc lấy nét chính xác hơn.',
  underbaked: () =>
    'Resist nung chưa đủ nên còn ướt và dính vào mask; bản in hỏng từ bước nung mềm, dù các bước sau đúng. Hãy tăng nhiệt độ hoặc thời gian nung.',
  bridging: (c) =>
    `Resist âm tạo một màng liên kết${thick(c)} bắc ngang miệng cửa sổ, nên chất khắc không xuống được tới đế. Hãy giảm liều hoặc tăng độ rộng thiết kế.`,
  underdose: () =>
    'Liều hiệu dụng (liều chiếu, trừ phần độ nhạy mất đi khi nung quá) thấp hơn liều chuẩn ×1, và đó là lý do bản in sai: ở liều hiệu dụng ×1, cùng thiết kế này không bị lỗi đó. Hãy tăng liều chiếu.',
  overdose: () =>
    'Liều hiệu dụng cao hơn liều chuẩn ×1, và đó là lý do bản in sai: ở liều hiệu dụng ×1, cùng thiết kế này không bị lỗi đó. Hãy giảm liều chiếu.',
  scum: (c) => `Cặn resist${thick(c)} còn ở chân cửa sổ, nên chất khắc không chạm được tới oxit.`,
  'near-resolution': () =>
    'Độ rộng thiết kế sát mức nhỏ nhất mà độ nhòe hiện tại cho phép: cửa sổ mở ra, nhưng ngay ở liều chuẩn ×1 vẫn còn một lớp resist chặn đường xuống đế. Hãy tăng độ rộng thiết kế.',
  'out-of-focus': () =>
    'Mặt phẳng lấy nét lệch quá nửa độ sâu tiêu cự (DOF) so với giữa lớp resist, nên ảnh nhòe thêm và góp phần làm sai bản in. Hãy đưa lệch tiêu cự về gần 0.',
  overbaked: () =>
    'Resist nung quá nên kém nhạy hơn, liều hiệu dụng giảm và góp phần làm sai bản in. Hãy giảm nhiệt độ hoặc thời gian nung mềm.',
  underdeveloped: () =>
    'Tráng chưa đủ lâu nên chưa hòa tan hết phần resist cần tan, để lại cặn ở chân cửa sổ. Hãy tăng thời gian tráng.',
  overdeveloped: () =>
    'Tráng quá lâu làm mỏng lớp resist còn lại và nở rộng cửa sổ, trong mô hình này. Hãy giảm thời gian tráng.',
  'cd-off-size': (c) => {
    const sign = c.fraction ?? c.valueNm;
    const direction = sign === undefined ? 'lệch khỏi' : sign < 0 ? 'hẹp hơn' : 'rộng hơn';
    const size = c.valueNm === undefined ? '' : ` ${nmVi(Math.abs(c.valueNm))}`;
    const share = c.fraction === undefined ? '' : ` (${percent(Math.abs(c.fraction), 1)})`;
    const advice =
      c.doseAdvice === 'increase'
        ? ' Thử tăng liều chiếu.'
        : c.doseAdvice === 'decrease'
          ? ' Thử giảm liều chiếu.'
          : '';
    return `Bề rộng ở chân cửa sổ ${direction} thiết kế${size}${share}, vượt dung sai ±${sizeTolerance()}.${advice}`;
  },
  overlay: (c) =>
    `Sai lệch căn chỉnh tệ nhất giữa hai lớp${c.valueNm === undefined ? '' : ` là ${nmVi(c.valueNm)}`} vượt dung sai, nên cửa sổ của lớp hai không rơi đúng lên vùng bên dưới.`,
};

/** A few words for a list of the causes that come after the first one. */
export const causeLabels: Record<CauseCode, string> = {
  'below-resolution': 'Cửa sổ không mở',
  underbaked: 'Nung mềm thiếu',
  bridging: 'Màng bắc cầu',
  underdose: 'Thiếu liều',
  overdose: 'Thừa liều',
  scum: 'Cặn ở chân',
  'near-resolution': 'Gần mức nhỏ nhất',
  'out-of-focus': 'Lệch tiêu cự',
  overbaked: 'Nung mềm quá',
  underdeveloped: 'Tráng thiếu',
  overdeveloped: 'Tráng quá',
  'cd-off-size': 'Sai kích thước',
  overlay: 'Lệch căn chỉnh',
};

/** Why a print is Đạt: the causes cover only what is wrong, so a print with none says this. */
export function passReason(
  e: Pick<ExposureResult, 'printedNm' | 'designNm' | 'cdErrorFraction'>,
): string {
  return `Cửa sổ mở tới oxit, rộng ${nmVi(e.printedNm)} ở chân so với ${nmVi(e.designNm)} thiết kế (lệch ${percent(Math.abs(e.cdErrorFraction), 1)}, trong dung sai ±${sizeTolerance()}), và cặn còn lại không quá ${scumTolerance()} độ dày resist.`;
}
