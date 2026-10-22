/**
 * What the learner reads in src/content/vi/m03/ (the .ts and .mdx files), checked as text. These are
 * the rules of docs/modules/m03-lithography.md ("Quy tắc cho copy") that a sentence can break
 * without a type error: a claim about the soft bake that the source does not make, a sentence that
 * the mechanism of a step is not allowed to have.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const COPY_DIR = fileURLToPath(new URL('../../src/content/vi/m03', import.meta.url));

const FILES = readdirSync(COPY_DIR)
  .filter((f) => f.endsWith('.ts') || f.endsWith('.mdx'))
  .map((name) => ({ name, text: readFileSync(join(COPY_DIR, name), 'utf8') }));

const read = (name: string) => readFileSync(join(COPY_DIR, name), 'utf8');

/** Clauses: the text cut at a full stop or a semicolon followed by a space, and at a line end. */
const clauses = (text: string) =>
  text
    .split(/(?<=[.;])\s+|\n+/)
    .map((c) => c.trim())
    .filter(Boolean);

/** Sentences: cut at a full stop followed by a space, and at a line end. */
const sentences = (text: string) =>
  text
    .split(/(?<=\.)\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

describe('copy of M03: the soft bake, as the source says it', () => {
  it('has copy to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(7);
  });

  it('a resist that sticks to the mask is only said of contact exposure, in the same clause', () => {
    let seen = 0;
    for (const { name, text } of FILES) {
      for (const clause of clauses(text)) {
        if (!/dính/i.test(clause) || !/mask|mặt nạ/i.test(clause)) continue;
        seen++;
        expect(clause, `${name}: "${clause}"`).toMatch(/tiếp xúc/);
      }
    }
    // the clause exists once the 3.3 copy is written; if it is gone the test below names it
    expect(seen).toBeGreaterThanOrEqual(1);
  });

  it('softbake.mdx says the lens projection of this model has no such effect', () => {
    const clause = clauses(read('softbake.mdx')).find((c) => /dính/.test(c) && /mask/.test(c));
    expect(clause, 'a clause with "dính" and "mask" in softbake.mdx').toBeDefined();
    expect(clause).toMatch(/chiếu tiếp xúc \(contact\)/);
    expect(read('softbake.mdx')).toMatch(/thấu kính/);
  });

  it('softbake.mdx names the real effects of a thin bake and of an over-bake, then the model rule', () => {
    const text = read('softbake.mdx');
    for (const word of [/dung môi/, /không chiếu/, /liên kết ngang/, /bám đế/, /phân hủy/]) {
      expect(text, String(word)).toMatch(word);
    }
    expect(
      text.search(/phân hủy/),
      'the real effect comes before the rule of the model',
    ).toBeLessThan(text.search(/mô hình gộp/i));
    expect(text).toMatch(/liều hiệu dụng/);
  });

  it('never states "the sensitivity falls" as a fact: a sentence about it says it is the model that merges', () => {
    for (const { name, text } of FILES) {
      for (const sentence of sentences(text)) {
        if (!/độ nhạy|kém nhạy/i.test(sentence)) continue;
        expect(sentence, `${name}: "${sentence}"`).toMatch(/mô hình|gộp/i);
      }
    }
  });
});
