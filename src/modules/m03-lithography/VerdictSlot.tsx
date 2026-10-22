/**
 * What step 3.6 puts in its notes: the verdict with its sentence, and under it the cautions. The
 * verdict is read from the view that is on screen (the one the picture and the tiles come from),
 * and only from a view of this step: a view of another step is not this step's verdict (at 3.7 the
 * overlay counts), so until one of this step lands the slot says it is working.
 */
import { cautions } from '../../content/vi/m03/cautions';
import { constants } from '../../physics/constants';
import { M03_STEPS } from '../../sim/m03Session';
import Grade from '../../ui/Grade';
import type { M03State } from '../../ui/m03Store';
import { fixedVi } from '../../ui/numbers';
import { cautionsFor, GRADE_TONES, GRADE_WORDS, verdictText } from './verdict';

const INSPECT = M03_STEPS.indexOf('inspect');

const percent = (fraction: number) => `${fixedVi(fraction * 100, 0)}%`;

export default function VerdictSlot({
  shown,
  pending,
}: {
  shown: M03State['shown'];
  pending: boolean;
}) {
  if (!shown || shown.view.step !== INSPECT) return <p role="status">Đang tính…</p>;
  const { view } = shown;
  const { grade } = view.verdict;
  const { why, others } = verdictText(view);
  const watch = cautionsFor(view.exposure, view.verdict);
  const { cdToleranceFraction, scumOkFraction } = constants.litho.exposure;

  return (
    <>
      <Grade
        tone={GRADE_TONES[grade]}
        word={GRADE_WORDS[grade]}
        why={why}
        others={others}
        busy={pending}
      >
        <p className="grade-foot">
          Phán quyết ở bước này chưa tính căn chỉnh lớp (bước 3.7). Các ngưỡng của nó, bề rộng ±
          {percent(cdToleranceFraction.value)} và cặn {percent(scumOkFraction.value)} độ dày, là giá
          trị minh họa.
        </p>
      </Grade>
      {watch.length > 0 && (
        <>
          <h4 className="ctl-title">Lưu ý</h4>
          <ul className="cautions" aria-label="Lưu ý">
            {watch.map((code) => (
              <li key={code}>{cautions[code](view.exposure)}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
