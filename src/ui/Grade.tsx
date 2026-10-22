import type { ReactNode } from 'react';
import type { Status } from './status';

interface Props {
  /** The colour of the verdict; the word beside it says the same. */
  tone: Status;
  /** The verdict in a word: "Đạt", "Biên", "Hỏng". */
  word: string;
  /** One sentence that says why. */
  why: ReactNode;
  /** A few words for each cause besides the one in `why`. */
  others?: readonly string[];
  /** A newer verdict is being computed; this one stays until it lands. */
  busy?: boolean;
  /** What goes below the sentence: a footnote, the cautions. */
  children?: ReactNode;
}

/**
 * The verdict of a step, with its sentence. Not a Note: a Note is a sentence about what the learner
 * sees, tagged Đạt / Cảnh báo / Lỗi, and the verdict is a different thing with different words.
 */
export default function Grade({ tone, word, why, others = [], busy = false, children }: Props) {
  return (
    <section className={`grade grade--${tone}`} aria-label="Phán quyết" aria-busy={busy}>
      <p className="grade-head">
        <span className="grade-label">Phán quyết:</span>
        <strong className="grade-word">{word}</strong>
      </p>
      <p className="grade-why">{why}</p>
      {others.length > 0 && (
        <div className="grade-others">
          <span>Còn lại:</span>
          <ul aria-label="Nguyên nhân còn lại">
            {others.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </section>
  );
}
