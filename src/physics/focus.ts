/**
 * Depth of focus of a light source, DOF = k₂·λ/NA². In a module of its own because the M03 page
 * needs it (to turn a number of depths of focus into nm) and nothing else of aerial.ts, whose
 * error function the page does not carry. aerial.ts re-exports it.
 */
import { constants, type LightSourceId } from './constants';

const L = constants.litho;

export function sourceOf(id: LightSourceId) {
  const source = L.sources[id];
  if (source === undefined) throw new RangeError(`unknown light source "${String(id)}"`);
  return source;
}

/** Depth of focus DOF = k₂·λ/NA², nm: the focus range over which the blur grows by at most √2. */
export function dofNm(source: LightSourceId): number {
  const { wavelengthNm, na } = sourceOf(source);
  return (L.k2.value * wavelengthNm.value) / (na.value * na.value);
}
