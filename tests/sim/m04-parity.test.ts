/**
 * The TypeScript port must reproduce reference/prototype-m04-etch.html, not just the ±20 nm of the
 * regression table. tests/sim/prototype-golden.ts holds the prototype's own output (regenerate with
 * reference/capture-m04-golden.mjs); here the port is held to it at float precision.
 */
import { describe, expect, it } from 'vitest';
import { printLitho } from '../../src/physics/litho';
import { simulate } from './helpers';
import { GOLDEN_ETCH, GOLDEN_LITHO } from './prototype-golden';

const close = (label: string, actual: number, expected: number) =>
  expect(
    Math.abs(actual - expected),
    `${label}: got ${actual}, prototype ${expected}`,
  ).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));

describe('litho parity with the prototype', () => {
  it.each(
    GOLDEN_LITHO.map((g) => [`${g.rpm} rpm ${g.source} ${g.designNm} nm ×${g.dose}`, g] as const),
  )('%s', (_name, g) => {
    const r = printLitho({
      spinRpm: g.rpm,
      source: g.source,
      designNm: g.designNm,
      dose: g.dose,
    });
    expect(r.resistThicknessNm).toBe(g.resistThicknessNm);
    close('cdMinNm', r.cdMinNm, g.cdMinNm);
    close('ratio', r.ratio, g.ratio);
    close('printedNm', r.printedNm, g.printedNm);
    close('scumNm', r.scumNm, g.scumNm);
    close('taperNm', r.taperNm, g.taperNm);
    expect(r.status).toBe(g.status);
  });
});

describe('etch parity with the prototype', () => {
  it.each(GOLDEN_ETCH.map((g) => [g.id, g] as const))('case %s', (_id, g) => {
    const s = simulate({
      litho: {
        spinRpm: g.litho.rpm,
        source: g.litho.source,
        designNm: g.litho.designNm,
        dose: g.litho.dose,
      },
      etch: g.recipe,
    });
    const m = s.metrics;
    close('printedNm', m.printedNm, g.metrics.printedNm);
    expect(m.cleared).toBe(g.metrics.cleared);
    close('topNm', m.topNm, g.metrics.topNm);
    close('bottomNm', m.bottomNm, g.metrics.bottomNm);
    close('undercutNm', m.undercutNm, g.metrics.undercutNm);
    close('siLossNm', m.siLossNm, g.metrics.siLossNm);
    close('resistLeftNm', m.resistLeftNm, g.metrics.resistLeftNm);
    close('sidewallAngleDeg', m.sidewallAngleDeg, g.metrics.sidewallAngleDeg);

    // Fingerprint of the whole arrival-time field, not only the cells the metrics look at.
    let finiteCount = 0;
    let sumFinite = 0;
    for (const t of s.arrival) {
      if (Number.isFinite(t)) {
        finiteCount++;
        sumFinite += t;
      }
    }
    expect(finiteCount).toBe(g.arrival.finiteCount);
    close('sum of arrival times', sumFinite, g.arrival.sumFinite);
  });
});
