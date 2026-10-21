import { describe, expect, it } from 'vitest';
import { M03_STEPS } from '../../src/sim/m03';
import { M03_UI_STEPS } from '../../src/modules/m03-lithography/steps';

describe('M03 steps in the UI', () => {
  it('has one entry per step of the session, in the same order', () => {
    expect(M03_UI_STEPS.map((s) => s.id)).toEqual([...M03_STEPS]);
  });

  it('numbers them 3.1 … 3.7 as docs/modules/m03-lithography.md does', () => {
    expect(M03_UI_STEPS.map((s) => s.code)).toEqual([
      '3.1',
      '3.2',
      '3.3',
      '3.4',
      '3.5',
      '3.6',
      '3.7',
    ]);
  });

  it('has a label short enough for a button 49 px wide, and the label is part of the name', () => {
    for (const s of M03_UI_STEPS) {
      expect(s.label.length, s.id).toBeLessThanOrEqual(5);
      expect(s.label, s.id).not.toMatch(/\s/);
      expect(s.name.toLowerCase(), s.id).toContain(s.label.toLowerCase());
    }
  });

  it('gives every step a distinct label and a distinct name', () => {
    expect(new Set(M03_UI_STEPS.map((s) => s.label)).size).toBe(M03_UI_STEPS.length);
    expect(new Set(M03_UI_STEPS.map((s) => s.name)).size).toBe(M03_UI_STEPS.length);
  });
});
