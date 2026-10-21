import type { ReactNode } from 'react';
import { STATUS_WORDS, type Status } from './status';

/** A sentence about what the learner sees, marked ok / warn / bad by a bar, a colour and a word. */
export default function Note({ tone, children }: { tone: Status; children: ReactNode }) {
  return (
    <div className={`note note--${tone}`} role="note">
      <strong className="note-tag">{STATUS_WORDS[tone]}</strong>
      {children}
    </div>
  );
}
