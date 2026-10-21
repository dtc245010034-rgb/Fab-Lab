/**
 * The M03 session (what the learner has chosen and where they are), what it shows (view), how it
 * is judged (verdict), and what it hands to M04 (output). Pure functions; the worker only runs
 * them (tests/workers/m03Service.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { dofNm } from '../../src/physics/aerial';
import { constants, type LightSourceId } from '../../src/physics/constants';
import { exposeResist, modelCdMinNm, type ExposureInput } from '../../src/physics/exposure';
import { minFeatureNm, resistThicknessNm } from '../../src/physics/litho';
import { Material } from '../../src/physics/materials';
import {
  contactLanding,
  measurementSites,
  overlayErrorAt,
  overlayToleranceNm,
  overlayVerdict,
  worstOverlayNm,
  type Alignment,
} from '../../src/physics/overlay';
import { passesProcessWindow, processWindow } from '../../src/physics/processWindow';
import { DEFAULT_GRID_SPEC, DEFAULT_M03_RECIPE, M03_SCENARIO } from '../../src/sim/defaults';
import { runEtchOnSection } from '../../src/sim/etchFrom';
import { buildGrid } from '../../src/sim/grid';
import {
  M03_STEPS,
  canCommit,
  canRework,
  commit,
  createSession,
  deriveView,
  goToStep,
  judge,
  m03Output,
  processWindowSpecFor,
  readOverlay,
  rework,
  runM03Request,
  scenarioMisalignment,
  setPlan,
  setRecipe,
  stageOf,
  toGridLitho,
  type M03Session,
} from '../../src/sim/m03';
import { seededRandom } from '../../src/sim/random';

const ZERO: Alignment = { dxNm: 0, dyNm: 0, rotationUrad: 0 };
const R = constants.geometry.waferRadiusMm.value;
const SOURCES: LightSourceId[] = ['g', 'i', 'krf', 'arf'];
const LAST = M03_STEPS.length - 1;

/** A session with a perfectly placed mask unless the test says otherwise. */
const session = (over: Partial<M03Session> = {}): M03Session => ({
  ...createSession(1),
  hidden: ZERO,
  ...over,
});
const at = (s: M03Session, step: number) => goToStep(s, step);
const withRecipe = (patch: Partial<ExposureInput>, over: Partial<M03Session> = {}) =>
  setRecipe(session(over), patch);
const designAt = (ratio: number) => ratio * minFeatureNm('i');
const codes = (v: { causes: { code: string }[] }) => v.causes.map((c) => c.code);

describe('scenarioMisalignment (the hidden placement error, drawn from the seed)', () => {
  it('is the same for the same seed and different for different seeds', () => {
    expect(scenarioMisalignment(5)).toEqual(scenarioMisalignment(5));
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => JSON.stringify(scenarioMisalignment(i))),
    );
    expect(seen.size).toBe(30);
  });

  /** The tolerance of the default window: what the starting overlay has to exceed. */
  const startTolerance = () => overlayToleranceNm(exposeResist(DEFAULT_M03_RECIPE).printedNm);

  /** The documented draw, written out again: dx, dy, rotation; sign then size; redrawn until it is outside. */
  function drawsOf(seed: number) {
    const next = seededRandom(seed);
    const component = (range: number) => (next() < 0.5 ? -1 : 1) * (0.4 + 0.6 * next()) * range;
    const draw = (): Alignment => ({
      dxNm: component(M03_SCENARIO.shiftRangeNm),
      dyNm: component(M03_SCENARIO.shiftRangeNm),
      rotationUrad: component(M03_SCENARIO.rotationRangeUrad),
    });
    const tolerance = startTolerance();
    const rejected: Alignment[] = [];
    for (;;) {
      const a = draw();
      if (worstOverlayNm(a) > tolerance) return { accepted: a, rejected };
      rejected.push(a);
    }
  }

  it('draws dx, dy and the rotation in that order, each as a sign then a size, from the seed', () => {
    for (const seed of [42, 1, 0, 7]) {
      expect(scenarioMisalignment(seed), `seed ${seed}`).toEqual(drawsOf(seed).accepted);
    }
  });

  it('draws again, from the same sequence, until the start is outside the tolerance', () => {
    // The redraw is a real path: some seeds start with a draw that is too small.
    const needingRedraw = Array.from({ length: 60 }, (_, seed) => seed).filter(
      (seed) => drawsOf(seed).rejected.length > 0,
    );
    expect(needingRedraw.length).toBeGreaterThan(0);
    for (const seed of needingRedraw) {
      const { accepted, rejected } = drawsOf(seed);
      for (const small of rejected)
        expect(worstOverlayNm(small)).toBeLessThanOrEqual(startTolerance());
      expect(scenarioMisalignment(seed), `seed ${seed}`).toEqual(accepted);
    }
  });

  it('starts every exercise outside the overlay tolerance of the default window, for 1000 seeds', () => {
    const tolerance = startTolerance();
    for (let seed = 0; seed < 1000; seed++) {
      expect(worstOverlayNm(scenarioMisalignment(seed)), `seed ${seed}`).toBeGreaterThan(tolerance);
    }
  });

  it('therefore needs a rework with the default window: the first reading is never "ok"', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const s = goToStep(createSession(seed), LAST);
      expect(deriveView(s).overlay.verdict, `seed ${seed}`).not.toBe('ok');
    }
  });

  it('is never zero in any component: between 0.4 and 1.0 of the range, with either sign', () => {
    const signs = {
      dxNm: new Set<number>(),
      dyNm: new Set<number>(),
      rotationUrad: new Set<number>(),
    };
    for (let seed = 0; seed < 300; seed++) {
      const a = scenarioMisalignment(seed);
      for (const [key, range] of [
        ['dxNm', M03_SCENARIO.shiftRangeNm],
        ['dyNm', M03_SCENARIO.shiftRangeNm],
        ['rotationUrad', M03_SCENARIO.rotationRangeUrad],
      ] as const) {
        expect(Math.abs(a[key]), `${key} @${seed}`).toBeGreaterThanOrEqual(0.4 * range);
        expect(Math.abs(a[key]), `${key} @${seed}`).toBeLessThanOrEqual(range);
        signs[key].add(Math.sign(a[key]));
      }
    }
    for (const set of Object.values(signs)) expect([...set].sort()).toEqual([-1, 1]);
  });
});

describe('steps and stages', () => {
  it('has the seven steps 3.1 to 3.7 in order', () => {
    expect([...M03_STEPS]).toEqual([
      'clean',
      'coat',
      'softbake',
      'expose',
      'develop',
      'inspect',
      'overlay',
    ]);
  });

  it('shows bare oxide, coated resist, the latent image, then the developed pattern', () => {
    expect(M03_STEPS.map((_, i) => stageOf(i))).toEqual([
      'ox',
      'resist',
      'resist',
      'exposed',
      'developed',
      'developed',
      'developed',
    ]);
  });

  it.each([-1, 7, 1.5, Number.NaN])('has no step %s', (step) => {
    expect(() => stageOf(step)).toThrow(RangeError);
  });
});

describe('createSession', () => {
  it('starts at the first step with nothing applied, nothing reworked and nothing committed', () => {
    const s = createSession(7);
    expect(s).toEqual({
      seed: 7,
      recipe: DEFAULT_M03_RECIPE,
      step: 0,
      hidden: scenarioMisalignment(7),
      applied: ZERO,
      plan: ZERO,
      reworks: 0,
      committed: false,
    });
  });

  it('takes a recipe of its own', () => {
    const recipe = { ...DEFAULT_M03_RECIPE, source: 'krf', designNm: 300 } as const;
    expect(createSession(7, recipe).recipe).toEqual(recipe);
  });

  it('rejects a seed that is not a whole 32-bit number', () => {
    expect(() => createSession(1.5)).toThrow(RangeError);
    expect(() => createSession(-3)).toThrow(RangeError);
  });
});

describe('changing a session', () => {
  it('returns a new session and leaves the old one as it was', () => {
    const s = session();
    const frozen = JSON.stringify(s);
    const changed = [
      setRecipe(s, { dose: 1.2 }),
      goToStep(s, 3),
      setPlan(s, { dxNm: 10, dyNm: 0, rotationUrad: 0 }),
      rework(goToStep(s, 2)),
      commit(goToStep(s, LAST)),
    ];
    for (const c of changed) expect(c).not.toBe(s);
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('setRecipe changes only what it is told to and keeps the step', () => {
    const s = at(session(), 3);
    const c = setRecipe(s, { dose: 1.2, polarity: 'negative' });
    expect(c.recipe).toEqual({ ...s.recipe, dose: 1.2, polarity: 'negative' });
    expect({ ...c, recipe: s.recipe }).toEqual({ ...s, recipe: s.recipe });
  });

  it('goToStep moves to a step, in either direction, and refuses a step that does not exist', () => {
    expect(goToStep(session(), 5).step).toBe(5);
    expect(goToStep(goToStep(session(), 5), 1).step).toBe(1);
    for (const step of [-1, 7, 2.5, Number.NaN])
      expect(() => goToStep(session(), step)).toThrow(RangeError);
  });

  it('setPlan stores the correction for the next exposure and leaves what is on the wafer alone', () => {
    const plan = { dxNm: -30, dyNm: 12, rotationUrad: 0.4 };
    const c = setPlan(session(), plan);
    expect(c.plan).toEqual(plan);
    expect(c.applied).toEqual(ZERO);
  });

  it.each([
    { dxNm: Number.NaN, dyNm: 0, rotationUrad: 0 },
    { dxNm: 0, dyNm: Number.POSITIVE_INFINITY, rotationUrad: 0 },
    { dxNm: 0, dyNm: 0, rotationUrad: Number.NaN },
  ])('setPlan refuses %o', (plan) => {
    expect(() => setPlan(session(), plan)).toThrow(RangeError);
  });
});

describe('rework (strip the resist and do the layer again, until the etch has begun)', () => {
  it('is possible once there is resist on the wafer, and not before', () => {
    expect(canRework(at(session(), 0))).toBe(false);
    for (let step = 1; step <= LAST; step++)
      expect(canRework(at(session(), step)), `step ${step}`).toBe(true);
    expect(() => rework(at(session(), 0))).toThrow();
  });

  it('strips the resist: back to the first step, bare oxide, with the plan applied to the next exposure', () => {
    const plan = { dxNm: -40, dyNm: 5, rotationUrad: -0.3 };
    const before = setRecipe(setPlan(at(session(), LAST), plan), { dose: 1.1 });
    const after = rework(before);
    expect(after.step).toBe(0);
    expect(stageOf(after.step)).toBe('ox');
    expect(after.applied).toEqual(plan);
    expect(after.plan).toEqual(plan);
    expect(after.reworks).toBe(1);
    expect(after.recipe).toEqual(before.recipe);
    expect(after.hidden).toEqual(before.hidden);
    expect(after.seed).toBe(before.seed);
    expect(after.committed).toBe(false);
    expect(rework(at(after, 4)).reworks).toBe(2);
  });

  it('leaves no resist on the cross-section it then shows', () => {
    const reworked = rework(at(session(), LAST));
    const { section } = deriveView(reworked);
    expect(section.materials.includes(Material.PR)).toBe(false);
    expect(section.latent.every((v) => v === 0)).toBe(true);
  });

  it('cannot be done once the etch has begun', () => {
    const done = commit(at(session(), LAST));
    expect(canRework(done)).toBe(false);
    expect(() => rework(done)).toThrow(/committed/);
  });
});

describe('commit (the etch begins; nothing can be redone)', () => {
  it('is possible only at the last step', () => {
    for (let step = 0; step < LAST; step++)
      expect(canCommit(at(session(), step)), `step ${step}`).toBe(false);
    expect(canCommit(at(session(), LAST))).toBe(true);
    expect(() => commit(at(session(), 3))).toThrow();
    expect(commit(at(session(), LAST)).committed).toBe(true);
  });

  it('freezes the session: every change is refused afterwards', () => {
    const done = commit(at(session(), LAST));
    expect(() => setRecipe(done, { dose: 1.1 })).toThrow(/committed/);
    expect(() => goToStep(done, 1)).toThrow(/committed/);
    expect(() => setPlan(done, ZERO)).toThrow(/committed/);
    expect(() => commit(done)).toThrow(/committed/);
    expect(canCommit(done)).toBe(false);
  });
});

describe('toGridLitho (the lithography result in the shape the grid reads)', () => {
  it('forwards the numbers the grid draws from', () => {
    const e = exposeResist({ ...DEFAULT_M03_RECIPE, designNm: designAt(0.9) });
    const l = toGridLitho(e);
    expect(l).toMatchObject({
      spinRpm: e.spinRpm,
      source: e.source,
      designNm: e.designNm,
      dose: e.dose,
      resistThicknessNm: e.resistThicknessNm,
      cdMinNm: e.cdMinNm,
      ratio: e.ratio,
      printedNm: e.printedNm,
      scumNm: e.scumNm,
      taperNm: e.taperNm,
      status: e.status,
      skinNm: 0,
    });
  });

  it('keeps only the flags the prototype model knows', () => {
    const e = exposeResist({ ...DEFAULT_M03_RECIPE, defocusNm: 400, developMin: 0.5 });
    expect(e.flags).toEqual(expect.arrayContaining(['out-of-focus', 'underdeveloped']));
    for (const flag of toGridLitho(e).flags) {
      expect(['below-resolution', 'near-resolution', 'underdose', 'overdose']).toContain(flag);
    }
  });

  it('passes on the skin of a negative resist, less what overdevelopment took off the top', () => {
    const bridged = {
      ...DEFAULT_M03_RECIPE,
      polarity: 'negative',
      designNm: designAt(1.2),
    } as const;
    const e = exposeResist(bridged);
    expect(e.skinNm).toBeGreaterThan(0);
    expect(toGridLitho(e).skinNm).toBe(e.skinNm);

    const thinned = exposeResist({ ...bridged, developMin: 3 });
    const lost = resistThicknessNm(3000) - thinned.resistThicknessNm;
    expect(lost).toBeGreaterThan(0);
    expect(toGridLitho(thinned).skinNm).toBeCloseTo(Math.max(0, thinned.skinNm - lost), 9);
  });
});

describe('readOverlay (what the verniers show at the five sites)', () => {
  const hidden: Alignment = { dxNm: 60, dyNm: -30, rotationUrad: 0.8 };
  const exposure = exposeResist(DEFAULT_M03_RECIPE);

  it('is the hidden misplacement plus what the mask was corrected by at exposure', () => {
    const o = readOverlay(
      session({ hidden, applied: { dxNm: -10, dyNm: 4, rotationUrad: 0.1 } }),
      exposure,
    );
    expect(o.residual).toEqual({ dxNm: 50, dyNm: -26, rotationUrad: 0.8 + 0.1 });
  });

  it('reads the error at the wafer centre and the four rim sites', () => {
    const o = readOverlay(session({ hidden }), exposure);
    const sites = measurementSites();
    expect(o.readings.map((r) => r.site)).toEqual(sites);
    o.readings.forEach((r, i) => expect(r.error).toEqual(overlayErrorAt(o.residual, sites[i]!)));
  });

  it('points at the worst site and gives its size', () => {
    const o = readOverlay(session({ hidden }), exposure);
    const sizes = o.readings.map((r) => r.error.magnitudeNm);
    expect(o.worstNm).toBe(Math.max(...sizes));
    expect(o.worstIndex).toBe(sizes.indexOf(o.worstNm));
  });

  it('shows no rotation at the centre: reading only the centre hides it', () => {
    const o = readOverlay(session({ hidden: { dxNm: 0, dyNm: 0, rotationUrad: 1 } }), exposure);
    expect(o.readings[0]!.error.magnitudeNm).toBe(0);
    expect(o.worstNm).toBeCloseTo(R, 9);
    // the four rim sites tie exactly; the first of them (+x) is the one pointed at
    expect(o.worstIndex).toBe(1);
  });

  it('judges the worst error against a fraction of the printed width, and where the contact lands', () => {
    const o = readOverlay(session({ hidden }), exposure);
    expect(o.cdNm).toBe(exposure.printedNm);
    expect(o.toleranceNm).toBe(overlayToleranceNm(o.cdNm));
    expect(o.verdict).toBe(overlayVerdict(o.worstNm, o.cdNm));
    expect(o.landing).toEqual(
      contactLanding({
        windowNm: o.cdNm,
        offsetNm: o.readings[o.worstIndex]!.error.exNm,
        marginNm: o.toleranceNm,
      }),
    );
  });

  it('uses the design width when nothing printed, so the tolerance is still defined', () => {
    const closed = exposeResist({ ...DEFAULT_M03_RECIPE, designNm: 150 });
    expect(closed.printedNm).toBe(0);
    expect(readOverlay(session({ hidden }), closed).cdNm).toBe(150);
  });

  it('is perfect, and the contact lands, for a perfectly placed mask', () => {
    const o = readOverlay(session(), exposure);
    expect(o.worstNm).toBe(0);
    expect(o.verdict).toBe('ok');
    expect(o.landing.landed).toBe(true);
  });

  it('is cured by a rework with the opposite correction: translation and rotation both', () => {
    const wrong = at(session({ hidden: { dxNm: 90, dyNm: -60, rotationUrad: 1.4 } }), LAST);
    expect(readOverlay(wrong, exposure).verdict).not.toBe('ok');
    const plan = { dxNm: -90, dyNm: 60, rotationUrad: -1.4 };
    const fixed = at(rework(setPlan(wrong, plan)), LAST);
    const o = deriveView(fixed).overlay;
    expect(o.worstNm).toBe(0);
    expect(o.verdict).toBe('ok');
  });

  it('is only half cured by correcting the shift: the rotation still shows at the rim', () => {
    const wrong = at(session({ hidden: { dxNm: 90, dyNm: -60, rotationUrad: 1.4 } }), LAST);
    const fixed = at(rework(setPlan(wrong, { dxNm: -90, dyNm: 60, rotationUrad: 0 })), LAST);
    const o = deriveView(fixed).overlay;
    expect(o.readings[0]!.error.magnitudeNm).toBe(0);
    expect(o.worstNm).toBeCloseTo(1.4 * R, 9);
  });
});

describe('judge (Đạt / Biên / Hỏng, and why)', () => {
  const run = (patch: Partial<ExposureInput>) => exposeResist({ ...DEFAULT_M03_RECIPE, ...patch });
  const perfect = () => readOverlay(session(), run({}));

  it('passes the standard condition with nothing to say', () => {
    expect(judge(run({}), null)).toEqual({ grade: 'ok', causes: [] });
    expect(judge(run({}), perfect())).toEqual({ grade: 'ok', causes: [] });
  });

  it('fails a window that never opens, and names the residue that covers the foot', () => {
    const e = run({ designNm: 150 });
    const v = judge(e, null);
    expect(v.grade).toBe('fail');
    expect(v.causes[0]).toMatchObject({ code: 'below-resolution', severity: 'fail' });
    const scum = v.causes.find((c) => c.code === 'scum');
    expect(scum).toEqual({ code: 'scum', severity: 'fail', valueNm: e.resistThicknessNm });
  });

  it('puts the root cause before its effect', () => {
    const v = judge(run({ designNm: 150 }), null);
    expect(codes(v).indexOf('below-resolution')).toBeLessThan(codes(v).indexOf('scum'));
  });

  it('lists the resolution that left the scum before the scum, and the scum before the size', () => {
    const v = judge(run({ designNm: designAt(0.9) }), null);
    expect(codes(v)).toEqual(['near-resolution', 'scum']);
    expect(v.causes.every((c) => c.severity === 'fail')).toBe(true);
  });

  it('does not blame a residue within the tolerance, nor the develop time that left it', () => {
    // 0.5% of the film is left (2.5 nm of 500 nm): too little to count as scum, and the window is
    // the right size, so the print has nothing wrong with it and the verdict has nothing to say.
    const e = run({ developMin: 0.995 });
    expect(e.scumNm).toBeGreaterThan(0);
    expect(e.flags).toContain('underdeveloped');
    expect(judge(e, null)).toEqual({ grade: 'ok', causes: [] });
  });

  it('fails an undeveloped film on the residue alone', () => {
    const v = judge(run({ developMin: 0 }), null);
    expect(v.grade).toBe('fail');
    expect(v.causes.find((c) => c.code === 'scum')).toMatchObject({ severity: 'fail' });
    expect(codes(v)).toContain('underdeveloped');
  });

  it('fails a window that opens at the top but scums: the layer in the way is a fail whatever the top does', () => {
    const e = run({ dose: 0.55 });
    expect(e.openAtTop).toBe(true);
    expect(e.scumNm).toBeGreaterThan(50);
    const v = judge(e, null);
    expect(v.grade).toBe('fail');
    expect(v.causes).toEqual([
      { code: 'underdose', severity: 'fail' },
      { code: 'scum', severity: 'fail', valueNm: e.scumNm },
    ]);
  });

  it('treats scum at the foot and a skin on top alike: thicker than the tolerance is a fail, thinner is not', () => {
    const tolerance = constants.litho.exposure.scumOkFraction.value * resistThicknessNm(3000);
    // scum: 6 nm of 500 nm is over 1%, 4 nm is under
    const thinScum = run({ developMin: 0.992 });
    const scum = run({ developMin: 0.988 });
    expect(thinScum.scumNm).toBeLessThan(tolerance);
    expect(scum.scumNm).toBeGreaterThan(tolerance);
    expect(judge(thinScum, null)).toEqual({ grade: 'ok', causes: [] });
    expect(judge(scum, null).grade).toBe('fail');
    expect(judge(scum, null).causes.find((c) => c.code === 'scum')).toEqual({
      code: 'scum',
      severity: 'fail',
      valueNm: scum.scumNm,
    });

    // skin: just over the tolerance is a fail, just under it is not a cause at all
    const cdMin = modelCdMinNm('i', 3000, 'negative');
    const skinned = run({ polarity: 'negative', designNm: 0.999 * cdMin });
    const clear = run({ polarity: 'negative', designNm: 1.001 * cdMin });
    expect(skinned.skinNm).toBeGreaterThan(tolerance);
    expect(skinned.skinNm).toBeLessThan(20); // a few nm, like the scum above
    expect(clear.skinNm).toBeGreaterThan(0);
    expect(clear.skinNm).toBeLessThanOrEqual(tolerance);
    expect(judge(skinned, null).grade).toBe('fail');
    expect(judge(skinned, null).causes.find((c) => c.code === 'bridging')).toEqual({
      code: 'bridging',
      severity: 'fail',
      valueNm: skinned.skinNm,
    });
    // no bridging cause: the skin is within the tolerance. (At this limit of the negative resist the
    // foot is narrower than designed, so the size is what the verdict still has to say.)
    expect(codes(judge(clear, null))).not.toContain('bridging');
    expect(judge(clear, null).grade).not.toBe('fail');
  });

  it('gives a thick scum and a thin skin the same grade', () => {
    const thickScum = judge(run({ dose: 0.55 }), null);
    const thinSkin = judge(
      run({ polarity: 'negative', designNm: 0.999 * modelCdMinNm('i', 3000, 'negative') }),
      null,
    );
    expect(thickScum.grade).toBe('fail');
    expect(thinSkin.grade).toBe('fail');
  });

  it('fails a resist that was not baked enough', () => {
    const v = judge(run({ softBake: { tempC: 60, timeMin: 1 } }), null);
    expect(v.grade).toBe('fail');
    expect(v.causes[0]).toMatchObject({ code: 'underbaked', severity: 'fail' });
  });

  it('fails a negative window bridged by a skin', () => {
    const v = judge(run({ polarity: 'negative', designNm: designAt(1.2) }), null);
    expect(v.grade).toBe('fail');
    expect(v.causes.find((c) => c.code === 'bridging')).toMatchObject({ severity: 'fail' });
    expect(v.causes.find((c) => c.code === 'bridging')!.valueNm).toBeGreaterThan(0);
  });

  it('says nothing of the focus while the print is on size: out of focus is not a defect of the print', () => {
    const e = run({ defocusNm: 0.52 * dofNm('i') });
    expect(e.flags).toContain('out-of-focus');
    expect(judge(e, null)).toEqual({ grade: 'ok', causes: [] });
  });

  it('names the focus, before its effect, once the print is off size', () => {
    // 2·CD_min of an i-line window: scan out of focus for the first dose-×1 print that is clean to
    // the foot but off size.
    let found = null;
    for (let dz = 0.5; dz <= 1.5 && found === null; dz += 0.05) {
      const e = run({ designNm: designAt(2), defocusNm: dz * dofNm('i') });
      if (e.cleanToFoot && Math.abs(e.cdErrorFraction) > 0.1) found = e;
    }
    expect(found).not.toBeNull();
    const v = judge(found!, null);
    expect(v.grade).toBe('marginal');
    expect(codes(v)).toEqual(['out-of-focus', 'cd-off-size']);
  });

  it('keeps the process causes (bake, develop) out of the verdict while the print is fine, and lists them when it is not', () => {
    const fine = run({ softBake: { tempC: 110, timeMin: 2 }, dose: 1.8 }); // overbaked, dose made up for it
    expect(fine.flags).toContain('overbaked');
    expect(passesProcessWindow(fine)).toBe(true);
    expect(judge(fine, null)).toEqual({ grade: 'ok', causes: [] });

    const bad = run({ softBake: { tempC: 110, timeMin: 2 } }); // overbaked and underexposed
    expect(passesProcessWindow(bad)).toBe(false);
    expect(codes(judge(bad, null))).toContain('overbaked');
  });

  describe('cd-off-size: the window is not the size that was asked for', () => {
    const tolerance = constants.litho.exposure.cdToleranceFraction.value;
    const offSize = (e: ReturnType<typeof run>) =>
      judge(e, null).causes.find((c) => c.code === 'cd-off-size');

    it('is a Biên at 1.3·CD_min and dose ×1: clean to the foot, but narrower than designed', () => {
      const e = run({ designNm: designAt(1.3) });
      expect(e.cleanToFoot).toBe(true);
      expect(e.status).toBe('ok'); // the physics: it prints clean (the prototype threshold is 1.0)
      const v = judge(e, null);
      expect(v.grade).toBe('marginal'); // the verdict: it is not the size asked for
      expect(codes(v)).toEqual(['cd-off-size']);
      const cause = v.causes[0]!;
      expect(cause.severity).toBe('marginal');
      expect(cause.valueNm!).toBeLessThan(0);
      expect(cause.fraction!).toBeLessThan(-tolerance);
    });

    it('keeps the deviation with its sign, in nm and as a fraction of the design', () => {
      for (const [designRatio, dose] of [
        [1.3, 1],
        [2.2, 1.3],
        [2.2, 0.8],
        [3, 1.5],
      ] as const) {
        const e = run({ designNm: designAt(designRatio), dose });
        const cause = offSize(e);
        expect(cause, `${designRatio} ×${dose}`).toBeDefined();
        expect(cause!.valueNm, `${designRatio} ×${dose}`).toBeCloseTo(e.printedNm - e.designNm, 9);
        expect(cause!.fraction, `${designRatio} ×${dose}`).toBeCloseTo(e.cdErrorFraction, 12);
        expect(Math.sign(cause!.valueNm!)).toBe(Math.sign(cause!.fraction!));
      }
      expect(offSize(run({ designNm: designAt(2.2), dose: 1.3 }))!.valueNm!).toBeGreaterThan(0);
      expect(offSize(run({ designNm: designAt(2.2), dose: 0.8 }))!.valueNm!).toBeLessThan(0);
    });

    it('is not there while the window is within the tolerance, and not for a window that is blocked', () => {
      expect(offSize(run({}))).toBeUndefined();
      expect(offSize(run({ designNm: designAt(1.5) }))).toBeUndefined(); // −6.2%
      expect(offSize(run({ designNm: designAt(0.8) }))).toBeUndefined(); // scummed: width at the foot is 0
      expect(offSize(run({ designNm: 150 }))).toBeUndefined(); // nothing opens
    });

    it('stays a Biên however far off size: there is no Hỏng threshold for the size yet', () => {
      const e = run({ dose: 1.6 });
      expect(e.cleanToFoot).toBe(true);
      expect(e.cdErrorFraction).toBeGreaterThan(2 * tolerance);
      const v = judge(e, null);
      expect(v.grade).toBe('marginal');
      expect(offSize(e)!.severity).toBe('marginal');
    });

    it('says which way to turn the dose: positive resist, narrow → more, wide → less; negative, the reverse', () => {
      const cause = (patch: Partial<ExposureInput>) => {
        const e = run(patch);
        return { error: e.cdErrorFraction, advice: offSize(e)!.doseAdvice };
      };
      // positive: more light widens the window
      expect(cause({ designNm: designAt(1.3) })).toMatchObject({ advice: 'increase' });
      expect(cause({ designNm: designAt(1.3) }).error).toBeLessThan(0);
      expect(cause({ dose: 1.4 })).toMatchObject({ advice: 'decrease' });
      expect(cause({ dose: 1.4 }).error).toBeGreaterThan(0);
      // negative: the window is the unexposed line, so more light narrows it
      expect(cause({ polarity: 'negative', dose: 1.4 })).toMatchObject({ advice: 'decrease' });
      expect(cause({ polarity: 'negative', dose: 1.4 }).error).toBeLessThan(0);
      expect(cause({ polarity: 'negative', dose: 0.8 })).toMatchObject({ advice: 'increase' });
      expect(cause({ polarity: 'negative', dose: 0.8 }).error).toBeGreaterThan(0);
    });

    it('gives advice that works: a small step the advised way brings the width nearer to the design', () => {
      let checked = 0;
      for (const polarity of ['positive', 'negative'] as const) {
        for (const ratio of [1.3, 1.6, 2.2, 3]) {
          for (const dose of [0.75, 0.85, 1, 1.15, 1.3]) {
            const base = { polarity, designNm: designAt(ratio), dose };
            const cause = offSize(run(base));
            if (!cause) continue;
            const step = cause.doseAdvice === 'increase' ? 1.03 : 1 / 1.03;
            const after = run({ ...base, dose: dose * step });
            if (!after.cleanToFoot) continue;
            expect(Math.abs(after.cdErrorFraction), JSON.stringify(base)).toBeLessThan(
              Math.abs(run(base).cdErrorFraction),
            );
            checked++;
          }
        }
      }
      expect(checked).toBeGreaterThan(10); // the property was really exercised
    });

    it('can be put right with the dose: a dose in ×0.7 … ×1.3 gives Đạt at 1.5·CD_min and at 1.3·CD_min', () => {
      const doses = Array.from({ length: 25 }, (_, i) => 0.7 + (0.6 * i) / 24);
      for (const ratio of [1.5, 1.3]) {
        const ok = doses.filter(
          (dose) => judge(run({ designNm: designAt(ratio), dose }), null).grade === 'ok',
        );
        expect(ok.length, `${ratio}`).toBeGreaterThan(0);
        // dose-to-size: the window is narrower than designed at ×1, so the doses that fix it are above ×1
        if (ratio === 1.3) for (const dose of ok) expect(dose).toBeGreaterThan(1);
      }
    });
  });

  it('adds the overlay, with its size, when it is read', () => {
    const e = run({});
    const bad = readOverlay(session({ hidden: { dxNm: 900, dyNm: 0, rotationUrad: 0 } }), e);
    expect(bad.verdict).toBe('fail');
    const v = judge(e, bad);
    expect(v.grade).toBe('fail');
    expect(v.causes).toEqual([{ code: 'overlay', severity: 'fail', valueNm: bad.worstNm }]);

    const tol = overlayToleranceNm(e.printedNm);
    const meh = readOverlay(session({ hidden: { dxNm: 1.2 * tol, dyNm: 0, rotationUrad: 0 } }), e);
    expect(meh.verdict).toBe('marginal');
    expect(judge(e, meh)).toEqual({
      grade: 'marginal',
      causes: [{ code: 'overlay', severity: 'marginal', valueNm: meh.worstNm }],
    });
  });

  it('is consistent with the physics for every kind of input', () => {
    for (const polarity of ['positive', 'negative'] as const) {
      for (const ratio of [0.5, 0.8, 1, 1.3, 2.2]) {
        for (const dose of [0.5, 1, 1.4]) {
          for (const defocusNm of [0, 300]) {
            for (const developMin of [0, 0.6, 1, 3]) {
              for (const softBake of [
                { tempC: 90, timeMin: 1 },
                { tempC: 60, timeMin: 1 },
                { tempC: 120, timeMin: 2 },
              ]) {
                const e = run({
                  polarity,
                  designNm: designAt(ratio),
                  dose,
                  defocusNm,
                  developMin,
                  softBake,
                });
                for (const overlay of [
                  null,
                  readOverlay(session({ hidden: { dxNm: 120, dyNm: 0, rotationUrad: 0.9 } }), e),
                ]) {
                  const v = judge(e, overlay);
                  const tag = JSON.stringify({
                    polarity,
                    ratio,
                    dose,
                    defocusNm,
                    developMin,
                    softBake,
                    overlay: overlay?.verdict,
                  });
                  const blocked = e.blockedFraction > constants.litho.exposure.scumOkFraction.value;
                  const failing = e.status === 'fail' || blocked || overlay?.verdict === 'fail';
                  expect(v.grade === 'fail', tag).toBe(failing);
                  expect(v.grade === 'ok', tag).toBe(v.causes.length === 0);
                  // Đạt exactly where the chart would pass (and the overlay, when it is read, is Đạt)
                  expect(v.grade === 'ok', tag).toBe(
                    passesProcessWindow(e) && (overlay === null || overlay.verdict === 'ok'),
                  );
                  if (v.grade === 'fail')
                    expect(
                      v.causes.some((c) => c.severity === 'fail'),
                      tag,
                    ).toBe(true);
                  // every failing cause comes before every marginal one
                  const severities = v.causes.map((c) => c.severity);
                  const firstMarginal = severities.indexOf('marginal');
                  if (firstMarginal >= 0) {
                    expect(severities.slice(firstMarginal), tag).not.toContain('fail');
                  }
                  expect(new Set(codes(v)).size, tag).toBe(v.causes.length);
                }
              }
            }
          }
        }
      }
    }
  });
});

describe('the verdict and the process-window chart never contradict each other', () => {
  const tolerance = constants.litho.exposure.scumOkFraction.value;
  const designs = [3, 2.2, 1.8, 1.5, 1.3, 1.1, 0.9, 0.7];

  /** Every sample of the chart of each design, with its exposure, its verdict and the chart's answer. */
  function* samples() {
    for (const polarity of ['positive', 'negative'] as const) {
      for (const ratio of designs) {
        const recipe = { ...DEFAULT_M03_RECIPE, polarity, designNm: designAt(ratio) };
        const w = processWindow(recipe, processWindowSpecFor('i'));
        for (let iFocus = 0; iFocus < w.defocusNm.length; iFocus++) {
          for (let iDose = 0; iDose < w.doses.length; iDose++) {
            const e = exposeResist({
              ...recipe,
              dose: w.doses[iDose]!,
              defocusNm: w.defocusNm[iFocus]!,
            });
            const passes = w.pass[iFocus * w.doses.length + iDose] === 1;
            yield { e, v: judge(e, null), passes, tag: `${polarity} ${ratio} #${iFocus},${iDose}` };
          }
        }
      }
    }
  }

  it('reads the chart’s answer the same way the chart does', () => {
    for (const { e, passes, tag } of samples()) expect(passes, tag).toBe(passesProcessWindow(e));
  });

  it('calls Hỏng anything that has a layer in the way thicker than the tolerance', () => {
    for (const { e, v, tag } of samples()) {
      if (e.blockedFraction > tolerance) expect(v.grade, tag).toBe('fail');
    }
  });

  it('never calls Hỏng a sample the chart passes', () => {
    for (const { v, passes, tag } of samples()) {
      if (passes) expect(v.grade, tag).not.toBe('fail');
    }
  });

  it('is Đạt exactly where the chart passes: both ways, with no sample left over', () => {
    let ok = 0;
    let notOk = 0;
    for (const { v, passes, tag } of samples()) {
      expect(v.grade === 'ok', tag).toBe(passes);
      if (passes) expect(v.causes, tag).toEqual([]);
      else expect(v.causes.length, tag).toBeGreaterThan(0);
      if (v.grade === 'ok') ok++;
      else notOk++;
    }
    expect(ok).toBeGreaterThan(300); // both sides are really there
    expect(notOk).toBeGreaterThan(300);
  });

  it('is Đạt only if the overlay is Đạt too, when it is read', () => {
    const good = readOverlay(session(), exposeResist(DEFAULT_M03_RECIPE));
    const bad = readOverlay(
      session({ hidden: { dxNm: 900, dyNm: 0, rotationUrad: 0 } }),
      exposeResist(DEFAULT_M03_RECIPE),
    );
    for (const { e, passes, tag } of samples()) {
      expect(judge(e, good).grade === 'ok', tag).toBe(passes);
      expect(judge(e, bad).grade, tag).toBe('fail');
    }
  });

  it('puts a size, never a layer in the way, behind every sample that is clean but not Đạt', () => {
    for (const { e, v, tag } of samples()) {
      if (v.grade === 'ok' || e.blockedFraction > tolerance) continue;
      expect(e.cleanToFoot && e.status !== 'fail', tag).toBe(true);
      expect(
        v.causes.every((c) => c.severity === 'marginal'),
        tag,
      ).toBe(true);
      expect(
        v.causes.map((c) => c.code),
        tag,
      ).toContain('cd-off-size');
    }
  });
});

describe('deriveView', () => {
  const make = () => session({ hidden: { dxNm: 40, dyNm: 0, rotationUrad: 0.5 } });

  it('computes the exposure of the recipe and draws the stage of the step from it', () => {
    const s = make();
    for (let step = 0; step <= LAST; step++) {
      const v = deriveView(at(s, step));
      expect(v.step).toBe(step);
      expect(v.stage).toBe(stageOf(step));
      expect(v.exposure).toEqual(exposeResist(s.recipe));
      expect(v.section.materials, `step ${step}`).toEqual(
        buildGrid(DEFAULT_GRID_SPEC, toGridLitho(v.exposure), stageOf(step)).materials,
      );
    }
  });

  it('shows bare oxide, then resist, then the latent image, then the opened window', () => {
    const s = make();
    const count = (step: number, m: number) =>
      deriveView(at(s, step)).section.materials.filter((v) => v === m).length;
    expect(count(0, Material.PR)).toBe(0);
    expect(count(1, Material.PR)).toBeGreaterThan(0);
    expect(deriveView(at(s, 3)).section.latent.some((v) => v === 1)).toBe(true);
    expect(count(4, Material.PR)).toBeLessThan(count(3, Material.PR)); // the window dissolved
  });

  it('takes the grid from the caller', () => {
    const s = make();
    const spec = { ...DEFAULT_GRID_SPEC, widthCells: 200 };
    expect(deriveView(s, spec).section.widthCells).toBe(200);
  });

  it('reads the overlay and judges everything, but counts the overlay only from the last step on', () => {
    const s = session({ hidden: { dxNm: 900, dyNm: 0, rotationUrad: 0 } }); // far off the marks
    const early = deriveView(at(s, 3));
    expect(early.overlay).toEqual(readOverlay(at(s, 3), early.exposure));
    expect(early.overlay.verdict).toBe('fail');
    expect(early.verdict).toEqual(judge(early.exposure, null));
    expect(early.verdict.grade).toBe('ok'); // not measured yet, so not held against the exposure
    const last = deriveView(at(s, LAST));
    expect(last.verdict).toEqual(judge(last.exposure, last.overlay));
    expect(last.verdict.grade).toBe('fail');
  });
});

describe('m03Output (what M04 starts from)', () => {
  it('is available only once the session is committed', () => {
    expect(() => m03Output(at(session(), LAST))).toThrow(/commit/);
  });

  it('is the developed cross-section, the lithography result, the overlay and the verdict', () => {
    const done = commit(at(session(), LAST));
    const out = m03Output(done);
    const e = exposeResist(done.recipe);
    expect(out.exposure).toEqual(e);
    expect(out.litho).toEqual(toGridLitho(e));
    expect(out.overlay).toEqual(readOverlay(done, e));
    expect(out.verdict).toEqual(judge(e, out.overlay));
    expect(out.reworks).toBe(0);
    expect(out.section.materials).toEqual(
      buildGrid(DEFAULT_GRID_SPEC, toGridLitho(e), 'developed').materials,
    );
  });

  it('remembers how many times the layer was redone', () => {
    // each rework sends the learner back to the first step; they walk to the last one again
    const redone = commit(at(rework(at(rework(at(session(), LAST)), LAST)), LAST));
    expect(m03Output(redone).reworks).toBe(2);
  });
});

describe('M04 etches what M03 printed', () => {
  const finish = (patch: Partial<ExposureInput>) => m03Output(commit(at(withRecipe(patch), LAST)));
  const BOE = { mode: 'wet', etchant: 'boe6', timeMin: 3.3 } as const;
  const RIE = { mode: 'dry', powerW: 200, pressureMTorr: 30, timeMin: 4.6 } as const;

  it('goes through a clean window to the silicon', () => {
    const out = finish({});
    for (const etch of [BOE, RIE]) {
      const r = runEtchOnSection(out.section, etch);
      expect(r.metrics.cleared, etch.mode).toBe(true);
      expect(r.metrics.printedNm).toBe(out.exposure.printedNm);
    }
  });

  it('is stopped by scum at the foot, with no rule of its own for it: wet etchants do not attack resist', () => {
    const out = finish({ designNm: designAt(0.9) });
    expect(out.exposure.openAtTop).toBe(true);
    expect(out.exposure.scumNm).toBeGreaterThan(0);
    const r = runEtchOnSection(out.section, BOE);
    expect(r.metrics.cleared).toBe(false);
    expect(r.metrics.siLossNm).toBe(0);
  });

  it('is stopped by a skin over the window, even though the window under it is a closed cavity', () => {
    const bridged = { polarity: 'negative', designNm: designAt(1.2) } as const;
    const display = deriveView(at(withRecipe(bridged), LAST)).section;
    // What the learner sees: the skin at the top and the hollow below it.
    const cx = Math.floor(display.widthCells / 2);
    const col = (y: number) => display.materials[y * display.widthCells + cx];
    expect(col(display.oxideTopRow - display.resistRows)).toBe(Material.PR);
    expect(col(display.oxideTopRow - 1)).toBe(Material.AIR);

    const out = finish(bridged);
    expect(out.exposure.openAtTop).toBe(false);
    const r = runEtchOnSection(out.section, BOE);
    expect(r.metrics.cleared).toBe(false);
    expect(r.metrics.siLossNm).toBe(0);
  });

  it('seals only cavities: a section with none is handed over as it was drawn', () => {
    const done = commit(at(session(), LAST));
    expect(m03Output(done).section.materials).toEqual(deriveView(done).section.materials);
  });

  it('does not take an undercut window for a cavity: its wider foot is reached sideways', () => {
    // A negative resist leaves the window narrower at the top than at the foot. The air under the
    // overhang is reached only by going sideways from below the opening, on both sides.
    const undercut = commit(at(withRecipe({ polarity: 'negative' }), LAST));
    const view = deriveView(undercut);
    expect(view.exposure.taperNm).toBeLessThan(0);
    expect(m03Output(undercut).section.materials).toEqual(view.section.materials);
  });
});

describe('processWindowSpecFor', () => {
  it.each(SOURCES)('samples dose ×0.7 … ×1.3 and ±1.5 DOF on a 25 × 25 grid for %s', (source) => {
    const spec = processWindowSpecFor(source);
    expect(spec).toEqual({
      doseMin: 0.7,
      doseMax: 1.3,
      doseSteps: 25,
      defocusMinNm: -1.5 * dofNm(source),
      defocusMaxNm: 1.5 * dofNm(source),
      defocusSteps: 25,
    });
  });

  it('puts the standard condition on a grid point', () => {
    const w = processWindow(DEFAULT_M03_RECIPE, processWindowSpecFor('i'));
    expect(w.doses[12]).toBeCloseTo(1, 12);
    expect(w.defocusNm[12]).toBeCloseTo(0, 9);
    expect(w.pass[12 * 25 + 12]).toBe(1);
  });
});

describe('runM03Request (what the worker runs)', () => {
  it('answers a view request with the view of the session', () => {
    const s = at(session(), 4);
    const r = runM03Request({ kind: 'view', session: s });
    expect(r.kind).toBe('view');
    if (r.kind !== 'view') return;
    expect(r.view).toEqual(deriveView(s));
    expect(r.timingsMs.total).toBeGreaterThanOrEqual(0);
  });

  it('uses the grid of the request', () => {
    const r = runM03Request({
      kind: 'view',
      session: session(),
      spec: { ...DEFAULT_GRID_SPEC, widthCells: 180 },
    });
    expect(r.kind === 'view' && r.view.section.widthCells).toBe(180);
  });

  it('answers a window request with the process window of the recipe', () => {
    const spec = processWindowSpecFor('i');
    const r = runM03Request({ kind: 'window', recipe: DEFAULT_M03_RECIPE, spec });
    expect(r.kind).toBe('window');
    if (r.kind !== 'window') return;
    expect(r.window).toEqual(processWindow(DEFAULT_M03_RECIPE, spec));
    expect(r.timingsMs.total).toBeGreaterThanOrEqual(0);
  });

  it('passes on a failure of the model, as the errors the model throws', () => {
    expect(() =>
      runM03Request({ kind: 'view', session: setRecipe(session(), { dose: -1 }) }),
    ).toThrow(RangeError);
  });

  it('refuses a kind it does not know', () => {
    expect(() => runM03Request({ kind: 'nope' } as never)).toThrow(RangeError);
  });
});

describe('modelCdMinNm is what the session reports as the limit', () => {
  it('matches the model for the session recipe', () => {
    const v = deriveView(session());
    expect(v.exposure.cdMinNm).toBe(modelCdMinNm('i', 3000, 'positive'));
  });
});
