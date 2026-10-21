// Only the type of the step id is taken from sim/m03.ts: importing its values would carry the
// whole lithography computation, which runs in the worker, into the page.
import type { M03Step } from '../../sim/m03';
import type { TravelerStep } from '../../ui/Traveler';

export interface M03UiStep extends TravelerStep {
  id: M03Step;
}

/**
 * Steps 3.1 … 3.7 of docs/modules/m03-lithography.md. The label is one short word: seven buttons
 * share 348 px at 380 px wide, about 49 px each, and each label is part of its step's name.
 * (`Record<M03Step, …>`: TypeScript names a step that has no text. That the order is the one of
 * `M03_STEPS` in the session is checked in tests/modules/m03Steps.test.ts.)
 */
const TEXT: Record<M03Step, { label: string; name: string }> = {
  clean: { label: 'Sạch', name: 'Làm sạch, phủ chất bám dính' },
  coat: { label: 'Phủ', name: 'Phủ quay' },
  softbake: { label: 'Nung', name: 'Nung mềm' },
  expose: { label: 'Phơi', name: 'Phơi sáng' },
  develop: { label: 'Tráng', name: 'Tráng' },
  inspect: { label: 'Kiểm', name: 'Nung cứng và kiểm tra' },
  overlay: { label: 'Căn', name: 'Căn chỉnh lớp thứ hai (overlay)' },
};

const ORDER = [
  'clean',
  'coat',
  'softbake',
  'expose',
  'develop',
  'inspect',
  'overlay',
] as const satisfies readonly M03Step[];

export const M03_UI_STEPS: readonly M03UiStep[] = ORDER.map((id, i) => ({
  id,
  code: `3.${i + 1}`,
  ...TEXT[id],
}));
