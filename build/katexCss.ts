/**
 * KaTeX's stylesheet lists three files for each of its fonts (woff2, woff, ttf). A browser takes
 * the first it understands, and every browser this site runs on understands woff2, so the other
 * two are never fetched. Dropping them keeps 40 files out of the build and their hashed names out
 * of the stylesheet, which the page downloads whole.
 */
export function keepWoff2Only(css: string): string {
  return css.replace(
    /,url\([^)]*\.woff\) ?format\("woff"\),url\([^)]*\.ttf\) ?format\("truetype"\)/g,
    '',
  );
}
