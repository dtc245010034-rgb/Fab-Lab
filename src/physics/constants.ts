/**
 * Every number the physics layer uses lives here (CLAUDE.md rule 1, docs/SCIENCE.md §1).
 *
 * All entries are tier C: illustrative values chosen to be the right order of magnitude and to
 * show the right trends. Learner-facing copy must label them "giá trị minh họa" and must never
 * present them as measured. Values to verify against a textbook are listed in docs/PROGRESS.md.
 *
 * Each entry also says what kind of number it is:
 *  - 'physical-quantity' (đại lượng vật lý): has a real counterpart that a book can confirm
 *    (a wavelength, a film thickness, an etch rate).
 *  - 'model-shape' (hệ số hình dạng mô hình): a coefficient of this model's curve, such as a
 *    slope, a clamp or a threshold. A book cannot confirm it; only the trend it produces matters.
 *
 * Grouping mirrors the dotted names used in docs: litho.*, etch.wet.*, etch.rie.*, geometry.*.
 * Units follow CLAUDE.md rule 3: nm, min, °C, mTorr, W, dose relative (×).
 *
 * Grid size and cell size are simulation settings, not physics: see src/sim/defaults.ts.
 */

export type ConstantKind = 'physical-quantity' | 'model-shape';

export interface Illustrative {
  readonly value: number;
  readonly unit: string;
  readonly tier: 'C';
  readonly illustrative: true;
  readonly kind: ConstantKind;
  readonly note?: string;
}

const entry = (value: number, unit: string, kind: ConstantKind, note?: string): Illustrative => ({
  value,
  unit,
  tier: 'C',
  illustrative: true,
  kind,
  ...(note === undefined ? {} : { note }),
});
const physical = (value: number, unit: string, note?: string) =>
  entry(value, unit, 'physical-quantity', note);
const shape = (value: number, unit: string, note?: string) =>
  entry(value, unit, 'model-shape', note);

export const constants = {
  litho: {
    k1: physical(0.6, 'dimensionless', 'k₁ in CD_min = k₁·λ/NA'),
    resistRefThicknessNm: physical(500, 'nm', 'resist thickness at the reference spin speed'),
    resistRefSpinRpm: physical(3000, 'rpm', 'reference spin speed for resistRefThicknessNm'),
    sources: {
      g: { wavelengthNm: physical(436, 'nm'), na: physical(0.45, 'dimensionless') },
      i: { wavelengthNm: physical(365, 'nm'), na: physical(0.6, 'dimensionless') },
      krf: { wavelengthNm: physical(248, 'nm'), na: physical(0.8, 'dimensionless') },
      arf: { wavelengthNm: physical(193, 'nm'), na: physical(0.93, 'dimensionless') },
    },
    doseWideningNmPerDose: shape(150, 'nm per ×', 'printed = design + this · (dose − 1)'),
    resolutionFailBelowRatio: shape(
      0.7,
      'dimensionless',
      'design/CD_min below this: nothing opens',
    ),
    resolutionMarginalBelowRatio: shape(
      1,
      'dimensionless',
      'design/CD_min below this: blurred, narrowed window with scum',
    ),
    marginalPrintedFractionAtFail: shape(
      0.55,
      'dimensionless',
      'fraction of the design width that prints at the fail threshold',
    ),
    marginalPrintedFractionGain: shape(
      0.45,
      'dimensionless',
      'extra fraction gained across the marginal band (1 − the value above)',
    ),
    marginalScumFractionAtFail: shape(
      0.5,
      'dimensionless',
      'fraction of resist thickness left as scum at the fail threshold, falling to 0 at marginal',
    ),
    underdoseBelowDose: shape(0.85, '×', 'dose below this leaves scum'),
    underdoseScumFractionPerSpan: shape(
      0.6,
      'dimensionless',
      'fraction of resist thickness added as scum across one underdoseDoseSpan',
    ),
    underdoseDoseSpan: shape(0.25, '×', 'dose range over which underdose scum builds up'),
    overdoseAboveDose: shape(1.35, '×', 'dose above this: window grows wider than design'),
    taperBelowRatio: shape(1.3, 'dimensionless', 'design/CD_min below this: sloped resist wall'),
    taperNmPerRatio: shape(
      80,
      'nm',
      'wall flare at the top of the resist per unit of ratio deficit',
    ),
  },

  etch: {
    wet: {
      etchants: {
        boe10: { rateNmPerMin: physical(50, 'nm/min', 'SiO₂ rate in BOE 10:1') },
        boe6: { rateNmPerMin: physical(100, 'nm/min', 'SiO₂ rate in BOE 6:1') },
        hf49: { rateNmPerMin: physical(2000, 'nm/min', 'SiO₂ rate in HF 49%') },
      },
      resistSelectivity: shape(
        Infinity,
        '×',
        'idealisation: wet oxide etchants do not attack resist',
      ),
      siSelectivity: shape(Infinity, '×', 'idealisation: wet oxide etchants do not attack silicon'),
    },
    rie: {
      baseRateNmPerMin: shape(
        20,
        'nm/min',
        'intercept of the linear rate fit rate = base + slope·power',
      ),
      rateNmPerMinPerW: shape(0.25, 'nm/min per W', 'slope of the linear rate fit'),
      anisotropyBase: shape(
        0.98,
        'dimensionless',
        'anisotropy at zero pressure and reference power',
      ),
      anisotropyPressureScaleMTorr: shape(
        250,
        'mTorr',
        'pressure that, alone, would lower anisotropy by 1',
      ),
      anisotropyPowerRefW: shape(
        150,
        'W',
        'power at which power neither raises nor lowers anisotropy',
      ),
      anisotropyPowerScaleW: shape(
        600,
        'W',
        'power change that moves anisotropy by 1 (raises it above the reference power, lowers it below)',
      ),
      anisotropyMin: shape(0.25, 'dimensionless', 'lower clamp of anisotropy'),
      anisotropyMax: shape(
        0.97,
        'dimensionless',
        'upper clamp of anisotropy (lateral rate never 0)',
      ),
      resistSelectivityBase: shape(8, '×', 'SiO₂:resist selectivity extrapolated to zero power'),
      resistSelectivityPowerScaleW: shape(45, 'W', 'power that lowers resist selectivity by 1×'),
      resistSelectivityMin: shape(1.4, '×', 'lower clamp of SiO₂:resist selectivity'),
      siSelectivityBase: shape(15, '×', 'SiO₂:Si selectivity extrapolated to zero power'),
      siSelectivityPowerScaleW: shape(40, 'W', 'power that lowers Si selectivity by 1×'),
      siSelectivityMin: shape(5, '×', 'lower clamp of SiO₂:Si selectivity'),
    },
  },

  geometry: {
    oxideThicknessNm: physical(300, 'nm', 'SiO₂ film that M04 starts from'),
    resistMeasureMarginNm: shape(
      40,
      'nm',
      'band around the window excluded when measuring how much resist is left',
    ),
  },
} as const;

export type LightSourceId = keyof typeof constants.litho.sources;
export type WetEtchantId = keyof typeof constants.etch.wet.etchants;
