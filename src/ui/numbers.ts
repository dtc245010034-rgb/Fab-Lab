/** Numbers as the Vietnamese page writes them: a decimal comma and a true minus sign. */

/** `x` to `digits` decimals; "—" for a number that is not finite; never "−0,0". */
export function fixedVi(x: number, digits: number): string {
  if (!Number.isFinite(x)) return '—';
  const rounded = Number(x.toFixed(digits));
  const text = Math.abs(rounded).toFixed(digits).replace('.', ',');
  return rounded < 0 ? `−${text}` : text;
}

/** A length in whole nanometres with its unit; "—" for a length that does not exist. */
export function nmVi(nm: number): string {
  return Number.isFinite(nm) ? `${fixedVi(nm, 0)} nm` : '—';
}
