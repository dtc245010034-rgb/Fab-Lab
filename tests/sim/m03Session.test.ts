/**
 * The session functions that need no model live in sim/m03Session.ts so that the page can use them;
 * sim/m03.ts re-exports every one of them, so nothing that imports them from there changes.
 */
import { describe, expect, it } from 'vitest';
import * as m03 from '../../src/sim/m03';
import * as light from '../../src/sim/m03Session';

describe('sim/m03Session', () => {
  it.each([
    'M03_STEPS',
    'stageOf',
    'setRecipe',
    'goToStep',
    'setPlan',
    'canRework',
    'rework',
    'canCommit',
    'commit',
  ] as const)('%s is the very function sim/m03 exports', (name) => {
    expect(light[name]).toBeDefined();
    expect(m03[name]).toBe(light[name]);
  });

  it('keeps the guards: a committed session accepts no change, a step outside 0…6 is refused', () => {
    const session = m03.createSession(3);
    const committed = light.commit(light.goToStep(session, 6));
    expect(() => light.setRecipe(committed, { dose: 1.1 })).toThrow(/committed/);
    expect(() => light.goToStep(session, 7)).toThrow(RangeError);
    expect(() => light.goToStep(session, 1.5)).toThrow(RangeError);
  });
});
