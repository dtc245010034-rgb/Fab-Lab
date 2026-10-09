/**
 * Material codes stored in a grid's `materials` array. They live apart from etch.ts on purpose:
 * the page's own code (the cross-section drawing) needs the codes, and a module that is imported
 * by both the page and something loaded later is kept whole in the page's main bundle. Importing
 * `Material` from etch.ts would carry the whole etch search into every page load; e2e/bundle.spec.ts
 * checks that it stays out. Import `Material` from here, never from etch.ts.
 *
 * (A const object: `enum` is not allowed.)
 */
export const Material = { AIR: 0, SI: 1, OX: 2, PR: 3 } as const;
export type MaterialCode = (typeof Material)[keyof typeof Material];
