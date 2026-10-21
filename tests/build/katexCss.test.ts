import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { keepWoff2Only } from '../../build/katexCss';

// The stylesheet that ships with the installed KaTeX, the one the page imports.
const CSS = readFileSync('node_modules/katex/dist/katex.min.css', 'utf8');

/** The `src:` of every @font-face in a stylesheet. */
function sources(css: string): string[] {
  return [...css.matchAll(/@font-face\{[^}]*?src:([^;}]*)/g)].map((m) => m[1]!);
}

describe('keepWoff2Only (KaTeX stylesheet)', () => {
  it('starts from a KaTeX that lists three formats for each of its faces', () => {
    const before = sources(CSS);
    expect(before.length).toBeGreaterThanOrEqual(10);
    for (const src of before) {
      expect(src.match(/url\(/g), src).toHaveLength(3);
    }
  });

  it('leaves each face with its woff2 file and nothing else', () => {
    const after = sources(keepWoff2Only(CSS));
    expect(after).toHaveLength(sources(CSS).length);
    for (const src of after) {
      expect(src, src).toMatch(/^url\([^)]*\.woff2\) ?format\("woff2"\)$/);
    }
  });

  it('keeps the same files, and all of the rest of the stylesheet', () => {
    const slim = keepWoff2Only(CSS);
    const files = (css: string) => [...css.matchAll(/fonts\/([\w-]+)\.woff2/g)].map((m) => m[1]);
    expect(files(slim)).toEqual(files(CSS));
    // nothing but the font sources changed: the rules that lay out the maths are all still there
    const rules = (css: string) => css.replace(/@font-face\{[^}]*\}/g, '');
    expect(rules(slim)).toBe(rules(CSS));
  });

  it('takes out the two formats and no more, even if more follows in the same face', () => {
    const face = (src: string) => `.a{x:1}@font-face{font-family:X;src:${src};unicode-range:U+0}`;
    const three =
      'url(x.woff2) format("woff2"),url(x.woff) format("woff"),url(x.ttf) format("truetype")';
    expect(keepWoff2Only(face(three))).toBe(face('url(x.woff2) format("woff2")'));
    // a face that lists some other format as well keeps it
    const withOtf = `${three},url(x.otf) format("opentype")`;
    expect(keepWoff2Only(face(withOtf))).toBe(
      face('url(x.woff2) format("woff2"),url(x.otf) format("opentype")'),
    );
  });

  it('does nothing to a stylesheet that has no such faces', () => {
    const plain = '.a{color:red}@font-face{font-family:X;src:url(x.woff2) format("woff2")}';
    expect(keepWoff2Only(plain)).toBe(plain);
  });
});
