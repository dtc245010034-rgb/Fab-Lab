import { describe, expect, it } from 'vitest';
import { dofNm } from '../../src/physics/aerial';
import { type LightSourceId } from '../../src/physics/constants';
import { exposeResist, type ExposureInput } from '../../src/physics/exposure';
import { minFeatureNm } from '../../src/physics/litho';
import {
  passesProcessWindow,
  processWindow,
  type ProcessWindowSpec,
} from '../../src/physics/processWindow';

const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];

const base: ExposureInput = {
  spinRpm: 3000,
  source: 'i',
  designNm: 800,
  dose: 1,
  defocusNm: 0,
  polarity: 'positive',
  softBake: { tempC: 90, timeMin: 1 },
  developMin: 1,
};

/** Dose ×0.7 … ×1.3 and focus ±600 nm, an odd number of steps so that (×1, 0) is a grid point. */
const spec: ProcessWindowSpec = {
  doseMin: 0.7,
  doseMax: 1.3,
  doseSteps: 25,
  defocusMinNm: -600,
  defocusMaxNm: 600,
  defocusSteps: 25,
};

/** Computed on first use, so that a failure shows up in the test that needs it, not at collection. */
const once = <T>(make: () => T) => {
  let value: T | undefined;
  return () => (value ??= make());
};

const at = (w: { pass: Uint8Array }, nDose: number, iFocus: number, iDose: number) =>
  w.pass[iFocus * nDose + iDose]!;

describe('processWindow layout', () => {
  const win = once(() => processWindow(base, spec));

  it('samples both axes evenly, ends included', () => {
    const w = win();
    expect(w.doses).toHaveLength(25);
    expect(w.defocusNm).toHaveLength(25);
    expect(w.doses[0]).toBeCloseTo(0.7, 12);
    expect(w.doses[24]).toBeCloseTo(1.3, 12);
    expect(w.defocusNm[0]).toBeCloseTo(-600, 9);
    expect(w.defocusNm[24]).toBeCloseTo(600, 9);
    expect(w.doses[12]).toBeCloseTo(1, 12);
    expect(w.defocusNm[12]).toBeCloseTo(0, 9);
  });

  it('stores one value per sample, focus rows by dose columns', () => {
    const w = win();
    expect(w.cdNm).toHaveLength(25 * 25);
    expect(w.pass).toHaveLength(25 * 25);
    expect(w.passCount).toBe(w.pass.reduce((a, v) => a + v, 0));
  });

  it('agrees with exposeResist at every sample it is asked about', () => {
    const w = win();
    for (const [iFocus, iDose] of [
      [0, 0],
      [12, 12],
      [5, 20],
      [24, 3],
      [18, 18],
      [12, 0],
    ] as const) {
      const r = exposeResist({
        ...base,
        dose: w.doses[iDose]!,
        defocusNm: w.defocusNm[iFocus]!,
      });
      const i = iFocus * 25 + iDose;
      expect(w.cdNm[i], `${iFocus},${iDose}`).toBe(r.printedNm);
      expect(w.pass[i], `${iFocus},${iDose}`).toBe(passesProcessWindow(r) ? 1 : 0);
    }
  });

  it('ignores the dose and defocus of the base input: the grid decides them', () => {
    const w = win();
    const other = processWindow({ ...base, dose: 2, defocusNm: 300 }, spec);
    expect(other.pass).toEqual(w.pass);
    expect(other.cdNm).toEqual(w.cdNm);
  });
});

describe('what counts as passing', () => {
  it('is a clean, on-size window', () => {
    expect(passesProcessWindow(exposeResist(base))).toBe(true);
  });

  it('rejects scum, a window of the wrong size, and no window', () => {
    expect(passesProcessWindow(exposeResist({ ...base, dose: 0.55 }))).toBe(false); // scum
    expect(passesProcessWindow(exposeResist({ ...base, dose: 1.3 }))).toBe(false); // too wide
    expect(passesProcessWindow(exposeResist({ ...base, dose: 0.7, designNm: 150 }))).toBe(false); // none
  });

  it('rejects a window that is on size but carries scum (an underdeveloped film)', () => {
    const r = exposeResist({ ...base, developMin: 0.97 });
    // 3% of the film is left at the foot, but the foot is still within the size tolerance, so
    // the residue alone must be what fails it.
    expect(r.blockedFraction).toBeGreaterThan(0.01);
    expect(Math.abs(r.cdErrorFraction)).toBeLessThanOrEqual(0.1);
    expect(r.openAtTop).toBe(true);
    expect(r.cleanToFoot).toBe(false);
    expect(passesProcessWindow(r)).toBe(false);
  });

  it('rejects an underbaked resist, which fails whatever it prints', () => {
    const r = exposeResist({ ...base, softBake: { tempC: 60, timeMin: 1 } });
    expect(passesProcessWindow(r)).toBe(false);
  });
});

describe('the process window of a well-resolved window (800 nm, i-line)', () => {
  const win = once(() => processWindow(base, spec));
  const row = (iFocus: number) =>
    Array.from({ length: 25 }, (_, iDose) => at(win(), 25, iFocus, iDose));
  const column = (iDose: number) =>
    Array.from({ length: 25 }, (_, iFocus) => at(win(), 25, iFocus, iDose));
  /** The pass samples form one unbroken run. */
  const contiguous = (v: number[]) => {
    const first = v.indexOf(1);
    const last = v.lastIndexOf(1);
    return first >= 0 && v.slice(first, last + 1).every((x) => x === 1);
  };

  it('has a window around dose ×1 and best focus', () => {
    expect(win().passCount).toBeGreaterThan(0);
    expect(at(win(), 25, 12, 12)).toBe(1);
  });

  it('is one unbroken range in dose at best focus, and in focus at dose ×1', () => {
    expect(contiguous(row(12))).toBe(true);
    expect(contiguous(column(12))).toBe(true);
  });

  it('is mirror-symmetric about best focus', () => {
    for (let iFocus = 0; iFocus < 25; iFocus++) {
      expect(row(iFocus), `focus row ${iFocus}`).toEqual(row(24 - iFocus));
    }
  });

  it('is bounded: it fills well under half of the sampled area, and the low-dose corners are outside', () => {
    expect(win().passCount).toBeLessThan(0.5 * 25 * 25);
    for (const [iFocus, iDose] of [
      [0, 0],
      [24, 0],
    ] as const) {
      expect(at(win(), 25, iFocus, iDose), `${iFocus},${iDose}`).toBe(0);
    }
  });

  it('narrows away from best focus, on both sides', () => {
    // Compared at three well-separated rows rather than row by row: the count of passing
    // samples jitters by one or two from row to row where the grid cuts the boundary.
    const rowSum = (iFocus: number) => row(iFocus).reduce((a, v) => a + v, 0);
    for (const sign of [1, -1]) {
      expect(rowSum(12), `sign ${sign}`).toBeGreaterThan(rowSum(12 + sign * 6));
      expect(rowSum(12 + sign * 6), `sign ${sign}`).toBeGreaterThan(rowSum(12 + sign * 12));
      expect(rowSum(12 + sign * 12), `sign ${sign}`).toBeGreaterThan(0);
    }
  });

  it('leans towards higher dose out of focus: more light buys back some of the lost blur', () => {
    // The shape of a real process window (a Bossung plot): the passing doses at large |Δz| sit
    // above those at best focus, on both sides of it.
    const meanPassingDose = (iFocus: number) => {
      const w = win();
      const passing = row(iFocus).flatMap((v, iDose) => (v === 1 ? [w.doses[iDose]!] : []));
      return passing.reduce((a, d) => a + d, 0) / passing.length;
    };
    expect(meanPassingDose(20)).toBeGreaterThan(meanPassingDose(12) + 0.05);
    expect(meanPassingDose(4)).toBeGreaterThan(meanPassingDose(12) + 0.05);
  });
});

describe('the process window shrinks as the window gets harder to print', () => {
  const count = (designNm: number) => processWindow({ ...base, designNm }, spec).passCount;

  it('has less area the narrower the design', () => {
    const areas = [3.0, 2.2, 1.8, 1.5].map((ratio) => count(ratio * minFeatureNm('i')));
    for (let i = 1; i < areas.length; i++) expect(areas[i]!).toBeLessThan(areas[i - 1]!);
    expect(areas[areas.length - 1]!).toBeGreaterThan(0);
  });

  it('has none for a window near the resolution limit within this range of dose', () => {
    expect(count(0.8 * minFeatureNm('i'))).toBe(0);
  });
});

describe('the process window across sources (depth of focus)', () => {
  const ratio = 2;
  const passFor = (source: LightSourceId, focusExtent: (s: LightSourceId) => number) =>
    processWindow(
      { ...base, source, designNm: ratio * minFeatureNm(source) },
      {
        ...spec,
        defocusMinNm: -focusExtent(source),
        defocusMaxNm: focusExtent(source),
      },
    );

  it('looks the same for every source when focus is measured in DOFs', () => {
    const reference = passFor('i', (s) => 1.5 * dofNm(s));
    expect(reference.passCount).toBeGreaterThan(0);
    for (const source of SOURCES) {
      expect(passFor(source, (s) => 1.5 * dofNm(s)).pass, source).toEqual(reference.pass);
    }
  });

  it('is shallower in nm for each shorter-wavelength, higher-NA source at the same ratio', () => {
    // The same absolute focus axis for all: the range of focus that still passes at dose ×1.
    const widthNm = SOURCES.map((source) => {
      const w = passFor(source, () => 1200);
      const step = (w.defocusNm[1]! - w.defocusNm[0]!) as number;
      let passing = 0;
      for (let iFocus = 0; iFocus < w.defocusNm.length; iFocus++) {
        passing += at(w, 25, iFocus, 12);
      }
      return passing * step;
    });
    for (let i = 1; i < widthNm.length; i++) expect(widthNm[i]!).toBeLessThan(widthNm[i - 1]!);
    expect(widthNm[widthNm.length - 1]!).toBeGreaterThan(0);
  });
});

describe('processWindow input checks', () => {
  it.each([
    { doseSteps: 1 },
    { defocusSteps: 1 },
    { doseSteps: 2.5 },
    { doseMin: 0 },
    { doseMin: 1.3 },
    { doseMax: 0.7 },
    { defocusMin: Number.NaN },
    { doseMax: Number.POSITIVE_INFINITY },
  ])('rejects %o', (over) => {
    const bad: ProcessWindowSpec = { ...spec };
    for (const [key, value] of Object.entries(over)) {
      if (key === 'defocusMin') bad.defocusMinNm = value;
      else (bad as unknown as Record<string, number>)[key] = value;
    }
    expect(() => processWindow(base, bad)).toThrow(RangeError);
  });

  it('rejects a spec whose focus range is empty', () => {
    expect(() => processWindow(base, { ...spec, defocusMinNm: 100, defocusMaxNm: 100 })).toThrow(
      RangeError,
    );
  });
});
