/**
 * The tiles under the cross-section at each step: the numbers of the step, read from the view.
 * Nothing is invented here: a figure is the model's, or a constant of constants.ts, and a status is
 * a flag the model already raised (the Đạt / Cảnh báo / Lỗi of a tile is not the verdict).
 */
import { constants } from '../../physics/constants';
import { resistThicknessNm } from '../../physics/litho';
import type { M03Step, M03View } from '../../sim/m03';
import { fixedVi, nmVi } from '../../ui/numbers';
import type { Status } from '../../ui/status';

export interface MetricSpec {
  label: string;
  /** Already formatted, with its unit. */
  value: string;
  status?: Status;
}

export function metricsFor(step: M03Step, view: M03View): MetricSpec[] {
  const e = view.exposure;
  const has = (flag: (typeof e.flags)[number]) => e.flags.includes(flag);
  switch (step) {
    case 'clean':
      return [];
    case 'coat':
      return [
        { label: 'Độ dày resist', value: nmVi(resistThicknessNm(e.spinRpm)) },
        { label: 'Tốc độ quay', value: `${e.spinRpm} rpm` },
      ];
    case 'softbake':
      return [
        {
          label: `Nung quy về ${constants.litho.bake.refTempC.value} °C`,
          value: `${fixedVi(e.bakeEquivalentMin, 2)} phút`,
          status: has('underbaked') ? 'bad' : has('overbaked') ? 'warn' : 'ok',
        },
      ];
    case 'expose': {
      const { wavelengthNm, na } = constants.litho.sources[e.source];
      return [
        { label: 'CD_min (mô hình)', value: nmVi(e.cdMinNm) },
        {
          label: 'k₁ hiệu dụng',
          value: fixedVi((e.cdMinNm * na.value) / wavelengthNm.value, 2),
        },
        { label: `DOF (k₂ = ${fixedVi(constants.litho.k2.value, 1)})`, value: nmVi(e.dofNm) },
        { label: 'Độ nhòe hiệu dụng σ', value: nmVi(e.sigmaNm) },
        {
          label: 'Lệch tiêu cự',
          value: nmVi(e.defocusNm),
          status: has('out-of-focus') ? 'warn' : 'ok',
        },
      ];
    }
    case 'develop':
    case 'inspect':
    case 'overlay':
      return []; // steps 3.5 – 3.7 come with the next part of the page
  }
}
