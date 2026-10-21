/** The three states of docs/DESIGN.md. Colour alone never says one: these words go with it. */
export type Status = 'ok' | 'warn' | 'bad';

export const STATUS_WORDS: Readonly<Record<Status, string>> = {
  ok: 'Đạt',
  warn: 'Cảnh báo',
  bad: 'Lỗi',
};
