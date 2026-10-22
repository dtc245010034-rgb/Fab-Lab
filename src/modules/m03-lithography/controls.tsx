/**
 * The "Điều khiển" slot of steps 3.1 – 3.4: sliders and choices built from the UI kit, whose
 * ranges come from M03_CONTROLS, and (at 3.4) the two charts that answer them. The sliders show
 * the session at once; the pictures show the last result that arrived.
 */
import { constants } from '../../physics/constants';
import type { ExposureInput } from '../../physics/exposure';
import { M03_CONTROLS } from '../../sim/defaults';
import type { M03Step } from '../../sim/m03';
import { changeSource, defocusInDofs, defocusNmFor, windowKey } from '../../sim/m03Controls';
import type { M03Session } from '../../sim/m03Session';
import AerialChart from '../../ui/AerialChart';
import type { M03State } from '../../ui/m03Store';
import { fixedVi, nmVi } from '../../ui/numbers';
import ParamSlider from '../../ui/ParamSlider';
import ProcessWindowChart from '../../ui/ProcessWindowChart';
import Segmented from '../../ui/Segmented';

export interface ControlsProps {
  step: M03Step;
  session: M03Session;
  shown: M03State['shown'];
  chart: M03State['chart'];
  chartPending: boolean;
  setRecipe: (patch: Partial<ExposureInput>) => void;
}

const SOURCES = [
  { value: 'g', label: 'g-line' },
  { value: 'i', label: 'i-line' },
  { value: 'krf', label: 'KrF' },
  { value: 'arf', label: 'ArF' },
] as const;

const POLARITIES = [
  { value: 'positive', label: 'Dương' },
  { value: 'negative', label: 'Âm' },
] as const;

const integer = (v: number) => String(v);
/** A step of 0.025 or 0.125 needs three decimals to be read exactly. */
const threeDecimals = (v: number) => fixedVi(v, 3);

function CoatControls({ session, setRecipe }: ControlsProps) {
  const c = M03_CONTROLS.spinRpm;
  return (
    <ParamSlider
      id="m03-spin"
      label="Tốc độ quay"
      value={session.recipe.spinRpm}
      min={c.min}
      max={c.max}
      step={c.step}
      unit="rpm"
      format={integer}
      onChange={(spinRpm) => setRecipe({ spinRpm })}
    />
  );
}

function SoftBakeControls({ session, setRecipe }: ControlsProps) {
  const { softBake } = session.recipe;
  const temp = M03_CONTROLS.softBakeTempC;
  const time = M03_CONTROLS.softBakeTimeMin;
  return (
    <>
      <ParamSlider
        id="m03-bake-temp"
        label="Nhiệt độ nung"
        value={softBake.tempC}
        min={temp.min}
        max={temp.max}
        step={temp.step}
        unit="°C"
        format={integer}
        onChange={(tempC) => setRecipe({ softBake: { ...softBake, tempC } })}
      />
      <ParamSlider
        id="m03-bake-time"
        label="Thời gian nung"
        value={softBake.timeMin}
        min={time.min}
        max={time.max}
        step={time.step}
        unit="phút"
        format={(v) => fixedVi(v, 2)}
        onChange={(timeMin) => setRecipe({ softBake: { ...softBake, timeMin } })}
      />
    </>
  );
}

function ExposeControls({ session, shown, chart, chartPending, setRecipe }: ControlsProps) {
  const r = session.recipe;
  const source = constants.litho.sources[r.source];
  const design = M03_CONTROLS.designNm;
  const dose = M03_CONTROLS.dose;
  const focus = M03_CONTROLS.defocusInDofs;
  // the nearest thousandth: the focus is kept in nm, and 0.1250000001 DOF is not a position
  const dofs = Math.round(defocusInDofs(r.source, r.defocusNm) * 1000) / 1000;

  return (
    <>
      <Segmented
        label="Nguồn sáng"
        options={SOURCES}
        value={r.source}
        onChange={(next) => {
          const { source: picked, defocusNm } = changeSource(r, next);
          setRecipe({ source: picked, defocusNm });
        }}
      />
      <p className="ctl-note">
        λ = {source.wavelengthNm.value} nm, NA = {fixedVi(source.na.value, 2)} (giá trị minh họa)
      </p>
      <Segmented
        label="Loại resist"
        options={POLARITIES}
        value={r.polarity}
        onChange={(polarity) => setRecipe({ polarity })}
      />
      <ParamSlider
        id="m03-design"
        label="Độ rộng cửa sổ thiết kế"
        value={r.designNm}
        min={design.min}
        max={design.max}
        step={design.step}
        unit="nm"
        format={integer}
        onChange={(designNm) => setRecipe({ designNm })}
      />
      <ParamSlider
        id="m03-dose"
        label="Liều chiếu"
        value={r.dose}
        min={dose.min}
        max={dose.max}
        step={dose.step}
        format={(v) => `×${threeDecimals(v)}`}
        onChange={(next) => setRecipe({ dose: next })}
      />
      <ParamSlider
        id="m03-focus"
        label="Lệch tiêu cự"
        value={dofs}
        min={focus.min}
        max={focus.max}
        step={focus.step}
        format={(v) => `${threeDecimals(v)} DOF (${nmVi(defocusNmFor(r.source, v))})`}
        onChange={(next) => setRecipe({ defocusNm: defocusNmFor(r.source, next) })}
      />

      <h4 className="ctl-title">Ảnh trên không</h4>
      {shown ? <AerialChart profile={shown.view.aerial} /> : <p role="status">Đang tính…</p>}

      <h4 className="ctl-title">Cửa sổ quy trình</h4>
      {chart ? (
        <ProcessWindowChart
          window={chart.window}
          current={{ dose: r.dose, defocusNm: r.defocusNm }}
          stale={chartPending || windowKey(chart.recipe) !== windowKey(r)}
        />
      ) : (
        <p role="status">Đang tính biểu đồ…</p>
      )}
    </>
  );
}

function DevelopControls({ session, setRecipe }: ControlsProps) {
  const c = M03_CONTROLS.developMin;
  return (
    <ParamSlider
      id="m03-develop"
      label="Thời gian tráng"
      value={session.recipe.developMin}
      min={c.min}
      max={c.max}
      step={c.step}
      unit="phút"
      format={(v) => fixedVi(v, 2)}
      onChange={(developMin) => setRecipe({ developMin })}
    />
  );
}

/** The slot's content for a step, or null when the step has no control yet. */
export default function Controls(props: ControlsProps) {
  switch (props.step) {
    case 'clean':
    case 'inspect':
      return <p>Không có điều khiển ở bước này.</p>;
    case 'coat':
      return <CoatControls {...props} />;
    case 'softbake':
      return <SoftBakeControls {...props} />;
    case 'expose':
      return <ExposeControls {...props} />;
    case 'develop':
      return <DevelopControls {...props} />;
    case 'overlay':
      return null; // step 3.7 comes with the next part of the page
  }
}
