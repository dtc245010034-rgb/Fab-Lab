/**
 * The small Vietnamese strings of the M03 page that are built from numbers: number formats, the
 * description of the cross-section for screen readers, and the tiles of each step.
 */
import { describe, expect, it } from 'vitest';
import { constants } from '../../src/physics/constants';
import { resistThicknessNm } from '../../src/physics/litho';
import { DEFAULT_M03_RECIPE } from '../../src/sim/defaults';
import { createSession, deriveView, goToStep, M03_STEPS, setRecipe } from '../../src/sim/m03';
import { metricsFor } from '../../src/modules/m03-lithography/metrics';
import { describeM03Section, dimensionMetrics } from '../../src/ui/describeM03';
import { fixedVi, nmVi } from '../../src/ui/numbers';

const viewAt = (step: number, patch: Partial<typeof DEFAULT_M03_RECIPE> = {}) =>
  deriveView(goToStep(setRecipe(createSession(1), patch), step));

describe('number formats', () => {
  it('writes a decimal comma and a real minus sign, and never "−0"', () => {
    expect(fixedVi(1.234, 2)).toBe('1,23');
    expect(fixedVi(-0.5, 2)).toBe('−0,50');
    expect(fixedVi(-0.0001, 2)).toBe('0,00');
    expect(fixedVi(0, 1)).toBe('0,0');
  });

  it('rounds nm to whole numbers with the unit', () => {
    expect(nmVi(797.9)).toBe('798 nm');
    expect(nmVi(-63.4)).toBe('−63 nm');
    expect(nmVi(-0.2)).toBe('0 nm');
  });
});

describe('describeM03Section: what a screen reader hears for each stage', () => {
  it('names the stage, and for a bare wafer says there is no resist', () => {
    expect(describeM03Section(viewAt(0))).toMatch(/oxit trần/i);
    expect(describeM03Section(viewAt(0))).not.toMatch(/resist dày/);
  });

  it('gives the film thickness once it is coated', () => {
    const t = resistThicknessNm(DEFAULT_M03_RECIPE.spinRpm);
    expect(describeM03Section(viewAt(1))).toContain(`${t} nm`);
    expect(describeM03Section(viewAt(1))).toMatch(/chưa chiếu sáng/i);
  });

  it('says the window is a latent image after exposure', () => {
    expect(describeM03Section(viewAt(3))).toMatch(/ảnh ẩn/i);
  });

  it('gives the widths at the foot and the top of an open window', () => {
    const text = describeM03Section(viewAt(4));
    expect(text).toMatch(/mở tới oxit/i);
    expect(text).toMatch(/chân[^.]*≈\s*800 nm/);
  });

  it('says what blocks a window that did not open to the oxide', () => {
    const scum = describeM03Section(viewAt(4, { designNm: 400, dose: 0.7 }));
    expect(scum).toMatch(/cặn/i);
    expect(describeM03Section(viewAt(4, { designNm: 150 }))).toMatch(/không mở/i);
  });
});

describe('metricsFor: the tiles of each step', () => {
  const tiles = (step: number, patch: Partial<typeof DEFAULT_M03_RECIPE> = {}) =>
    metricsFor(M03_STEPS[step]!, viewAt(step, patch));
  const byLabel = (list: ReturnType<typeof tiles>, label: RegExp) =>
    list.find((t) => label.test(t.label));

  it('has none for the cleaning step', () => {
    expect(tiles(0)).toEqual([]);
  });

  it('gives the film thickness and the spin speed for the coat', () => {
    const list = tiles(1, { spinRpm: 4000 });
    expect(byLabel(list, /độ dày/i)!.value).toBe(`${resistThicknessNm(4000)} nm`);
    expect(byLabel(list, /quay/i)!.value).toBe('4000 rpm');
  });

  it('gives the bake as minutes at the reference temperature, and flags a bake that is too short or too long', () => {
    const ref = constants.litho.bake.refTempC.value;
    const nominal = byLabel(tiles(2), /nung/i)!;
    expect(nominal.value).toBe('1,00 phút');
    expect(nominal.label).toContain(`${ref} °C`);
    expect(nominal.status).toBe('ok');
    expect(byLabel(tiles(2, { softBake: { tempC: 60, timeMin: 1 } }), /nung/i)!.status).toBe('bad');
    expect(byLabel(tiles(2, { softBake: { tempC: 110, timeMin: 1 } }), /nung/i)!.status).toBe(
      'warn',
    );
  });

  it('gives CD_min, the effective k₁ (CD_min · NA / λ), the DOF with its k₂, and the blur, for the exposure', () => {
    const view = viewAt(3);
    const list = tiles(3);
    const { wavelengthNm, na } = constants.litho.sources.i;
    expect(byLabel(list, /CD_min/)!.value).toBe(nmVi(view.exposure.cdMinNm));
    const k1 = (view.exposure.cdMinNm * na.value) / wavelengthNm.value;
    expect(byLabel(list, /k₁ hiệu dụng/)!.value).toBe(fixedVi(k1, 2));
    expect(byLabel(list, /DOF/)!.label).toContain(fixedVi(constants.litho.k2.value, 1));
    expect(byLabel(list, /DOF/)!.value).toBe(nmVi(view.exposure.dofNm));
    expect(byLabel(list, /nhòe/i)!.value).toBe(nmVi(view.exposure.sigmaNm));
  });

  it('shows k₁ hiệu dụng changing with the resist film and not with what the learner types: thicker film, larger k₁', () => {
    const k1 = (spinRpm: number) =>
      Number(byLabel(tiles(3, { spinRpm }), /k₁ hiệu dụng/)!.value.replace(',', '.'));
    expect(k1(1500)).toBeGreaterThan(k1(3000));
    expect(k1(3000)).toBeGreaterThan(k1(6000));
  });

  it('flags a focus offset beyond half a DOF, and not one inside it', () => {
    const dof = viewAt(3).exposure.dofNm;
    const focus = (defocusNm: number) => byLabel(tiles(3, { defocusNm }), /tiêu cự/i)!;
    expect(focus(0).status).toBe('ok');
    expect(focus(dof * 0.4).status).toBe('ok');
    expect(focus(dof * 0.6).status).toBe('warn');
    expect(focus(-dof * 0.6).status).toBe('warn');
  });

  it('names the state of the bake, with a word of its own and not the verdict', () => {
    const bake = (softBake: { tempC: number; timeMin: number }) =>
      byLabel(tiles(2, { softBake }), /nung/i)!;
    expect(bake({ tempC: 90, timeMin: 1 })).toMatchObject({ status: 'ok', word: 'Nung đủ' });
    expect(bake({ tempC: 60, timeMin: 1 })).toMatchObject({ status: 'bad', word: 'Nung thiếu' });
    expect(bake({ tempC: 110, timeMin: 1 })).toMatchObject({ status: 'warn', word: 'Nung quá' });
  });

  it('names the focus in words: inside the DOF or outside it', () => {
    const dof = viewAt(3).exposure.dofNm;
    const focus = (defocusNm: number) => byLabel(tiles(3, { defocusNm }), /tiêu cự/i)!;
    expect(focus(0)).toMatchObject({ status: 'ok', word: 'Trong DOF' });
    expect(focus(dof * 0.6)).toMatchObject({ status: 'warn', word: 'Ngoài DOF' });
  });

  it('writes a dash, not "Infinity", where the model has no CD_min', () => {
    const list = tiles(3, { polarity: 'negative', spinRpm: 1500 });
    for (const tile of list) expect(tile.value).not.toMatch(/Infinity|NaN/);
  });
});

describe('dimensionMetrics: what the line on the picture measures', () => {
  it('is the width at the foot once the window is developed and open to the oxide', () => {
    const view = viewAt(4);
    expect(dimensionMetrics(view)).toEqual({
      topNm: view.exposure.printedNm,
      bottomNm: 0,
      cleared: false,
    });
    expect(view.exposure.printedNm).toBeGreaterThan(700);
  });

  it.each([0, 1, 2, 3])('is nothing at step %i, before there is a window to measure', (step) => {
    const view = viewAt(step);
    expect(view.exposure.printedNm).toBeGreaterThan(0); // the model has a number; the picture has no window yet
    expect(dimensionMetrics(view).topNm).toBe(0);
  });

  it('is nothing for a window that scum keeps from the oxide', () => {
    const view = viewAt(4, { designNm: 400, dose: 0.7 });
    expect(view.exposure.openAtTop && !view.exposure.cleanToFoot).toBe(true);
    expect(dimensionMetrics(view).topNm).toBe(0);
  });
});
