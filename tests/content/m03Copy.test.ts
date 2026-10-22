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

/** The six files that are the "Cơ chế" of steps 3.1 – 3.6. */
const MECHANISM = ['clean', 'coat', 'softbake', 'exposeMechanism', 'develop', 'inspect'];
const IF_WRONG = '**Nếu làm sai:**';
const paragraphs = (text: string) =>
  text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

describe('copy of M03: the mechanism of each step 3.1 – 3.6', () => {
  it.each(MECHANISM)(
    '%s.mdx: exactly one sentence opens with "Nếu làm sai:", on a paragraph of its own',
    (name) => {
      const text = read(`${name}.mdx`);
      expect(text.split(IF_WRONG).length - 1).toBe(1);
      const wrong = paragraphs(text).filter((p) => p.startsWith(IF_WRONG));
      expect(wrong).toHaveLength(1);
      expect(sentences(wrong[0]!), `"${wrong[0]}" is one sentence`).toHaveLength(1);
    },
  );

  it.each(MECHANISM)(
    '%s.mdx: the mechanism is 2 – 4 sentences, apart from "Nếu làm sai:"',
    (name) => {
      const body = paragraphs(read(`${name}.mdx`))
        .filter((p) => !p.startsWith(IF_WRONG))
        .join('\n');
      const count = sentences(body).length;
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(4);
    },
  );

  it('no other file of the module writes a "Nếu làm sai:" (one per step, six in all)', () => {
    const total = FILES.reduce((n, f) => n + (f.text.split(IF_WRONG).length - 1), 0);
    expect(total).toBe(MECHANISM.length);
  });

  it('at most one equation per step, each in a chip: 3.2 and 3.4 have one, the others none', () => {
    const withEquation = FILES.filter((f) => f.name.endsWith('.mdx') && /\$\$/.test(f.text)).map(
      (f) => f.name,
    );
    expect(withEquation.sort()).toEqual(['coatEquation.mdx', 'expose.mdx']);
    for (const name of withEquation) {
      expect(read(name), name).toMatch(/<EquationChip label="[^"]+">/);
      expect(read(name).split('$$').length - 1, `${name}: one display equation`).toBe(2);
    }
  });
});

describe('copy of M03: the model limits, in one place', () => {
  const limits = () => read('modelLimits.mdx');

  it('names each limit of the copy rules: one blur for the whole film, no standing waves, a step-threshold resist, no bleaching, one dimension, straight walls', () => {
    for (const word of [
      /độ nhòe/,
      /sóng đứng \(standing wave\)/,
      /bậc thang/,
      /tẩy màu \(bleaching\)/,
      /một chiều/,
      /đường thẳng/,
    ]) {
      expect(limits(), String(word)).toMatch(word);
    }
  });

  it('says the single-slit model has no hard resolution limit, and where the real one comes from', () => {
    expect(limits()).toMatch(/không có giới hạn phân giải cứng/);
    expect(limits()).toMatch(/nhiễu xạ/);
    expect(limits()).toMatch(/pitch/);
  });

  it('says the soft bake is a short rule: the real effects are not drawn', () => {
    expect(limits()).toMatch(/nung mềm/i);
    expect(limits()).toMatch(/không (được )?vẽ/);
  });

  it('says every figure is illustrative', () => {
    expect(limits()).toMatch(/giá trị minh họa/);
  });
});

describe('copy of M03: scum from too little dose is a fact of the positive resist', () => {
  const note = read('developNote.mdx');

  it('the sentence that explains it names the positive resist: the model says it of no other', () => {
    const explains = sentences(note).find((s) => /đáy/.test(s) && /cặn/.test(s));
    expect(explains, 'a sentence about the bottom of the film and the scum').toBeDefined();
    expect(explains).toMatch(/resist dương/i);
  });

  it('says the negative resist has none: in the model too little dose widens its window', () => {
    const sentence = sentences(note).find((s) => /^Resist âm/.test(s));
    expect(sentence, 'a sentence that opens with "Resist âm"').toBeDefined();
    expect(sentence).toMatch(/không/);
    expect(sentence).toMatch(/trong mô hình/);
  });
});
