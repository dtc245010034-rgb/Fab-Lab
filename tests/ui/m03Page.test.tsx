// @vitest-environment jsdom
/**
 * `/m03`: the lithography page, chosen from `location.pathname`, loaded only when asked for, and
 * driven by the M03 worker's client (a stand-in that answers with the real model here).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resistThicknessNm } from '../../src/physics/litho';
import App from '../../src/App';
import { dofNm } from '../../src/physics/aerial';
import { inlineClient } from './clients';
import { inlineM03Client, manualM03Client, type TestM03Client } from './m03Clients';

// `App` loads the page with React.lazy. The first import compiles the lessons' MDX and the
// stylesheet of KaTeX, which on a slow shared machine takes longer than the 1 s that `findBy*`
// waits (Cloudflare Workers Builds: 1084 ms). Load it here, under the hook's own timeout, so that
// no test pays for it and the "Đang tải…" fallback is not what a test happens to see.
beforeAll(async () => {
  await import('../../src/modules/m03-lithography/M03Page');
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

function openM03(client: TestM03Client = inlineM03Client()) {
  window.history.replaceState({}, '', '/m03');
  const createM03Client = () => client;
  render(<App createClient={() => inlineClient()} createM03Client={createM03Client} />);
  return client;
}

const stepNav = () => screen.findByRole('navigation', { name: /các bước/i });
const goTo = async (code: string) => {
  const nav = await stepNav();
  fireEvent.click(within(nav).getByRole('button', { name: new RegExp(code.replace('.', '\\.')) }));
};
const slider = (name: RegExp) => screen.getByRole('slider', { name });
const change = (name: RegExp, value: number) =>
  fireEvent.change(slider(name), { target: { value: String(value) } });

describe('/m03', () => {
  it('shows seven steps, the first one current, instead of the six of the etch lab', async () => {
    openM03();
    const nav = await stepNav();
    const steps = within(nav).getAllByRole('button');
    expect(steps).toHaveLength(7);
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('heading', { level: 2, name: /3\.1/ })).toBeInTheDocument();
  });

  it('does not start the etch worker: that page is not the one asked for', async () => {
    const createClient = vi.fn(() => inlineClient());
    window.history.replaceState({}, '', '/m03');
    render(<App createClient={createClient} createM03Client={() => inlineM03Client()} />);
    await stepNav();
    expect(createClient).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: /mặt cắt wafer:?$/i })).not.toBeInTheDocument();
  });

  it('keeps the product header, with one h1', async () => {
    openM03();
    await stepNav();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent(/Fab Lab/i);
  });

  it('puts the cross-section frame before the traveler in DOM order', async () => {
    openM03();
    await stepNav();
    const viewer = screen.getByRole('region', { name: /mặt cắt quang khắc/i });
    const traveler = screen.getByRole('complementary', { name: /phiếu công đoạn/i });
    expect(
      viewer.compareDocumentPosition(traveler) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows the equation of the exposure step as typeset KaTeX, from the MDX, in its own chip', async () => {
    openM03();
    expect(screen.queryByRole('group', { name: /giới hạn phân giải/i })).not.toBeInTheDocument();
    await goTo('3.4');
    const chip = await screen.findByRole('group', { name: /giới hạn phân giải/i });
    // typeset at build time: the markup of KaTeX is already there, no script ran to make it
    expect(chip.querySelector('.katex')).not.toBeNull();
    // and the TeX source is kept for assistive technology, in the MathML that KaTeX writes
    expect(chip.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toContain(
      '\\mathrm{CD}_{\\min}',
    );
  });
});

describe('/m03: before the first session lands', () => {
  it('the controls slot says it is working, never "Chưa có nội dung."', async () => {
    const manual = manualM03Client();
    openM03(manual.client);
    await stepNav();
    const slot = screen.getByRole('heading', { level: 3, name: 'Điều khiển' }).parentElement!;
    expect(within(slot).getByRole('status')).toHaveTextContent('Đang tính…');
    expect(within(slot).queryByText('Chưa có nội dung.')).not.toBeInTheDocument();
    // the session lands: the slot has its controls
    await act(async () => manual.answerStart());
    expect(await within(slot).findByText(/không có điều khiển ở bước này/i)).toBeInTheDocument();
    expect(within(slot).queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('/m03: steps 3.1 – 3.6 have no empty slot', () => {
  /** A slot is written or dropped, never left to say "Chưa có nội dung." */
  const SLOTS_AT: [string, string[]][] = [
    ['3.1', ['Cơ chế', 'Điều khiển']],
    ['3.2', ['Cơ chế', 'Phương trình', 'Điều khiển']],
    ['3.3', ['Cơ chế', 'Điều khiển']],
    ['3.4', ['Cơ chế', 'Phương trình', 'Điều khiển', 'Ghi chú']],
    ['3.5', ['Cơ chế', 'Điều khiển', 'Ghi chú']],
    ['3.6', ['Cơ chế', 'Điều khiển', 'Ghi chú']],
  ];

  it.each(SLOTS_AT)(
    '%s keeps the slots %j and none says "Chưa có nội dung."',
    async (code, titles) => {
      openM03();
      await screen.findByRole('img', { name: /oxit trần/i });
      await goTo(code);
      const traveler = screen.getByRole('complementary', { name: /phiếu công đoạn/i });
      const slotTitles = within(traveler)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent);
      expect(slotTitles).toEqual(titles);
      expect(within(traveler).queryByText('Chưa có nội dung.')).not.toBeInTheDocument();
    },
  );

  it('the mechanism of each of the six steps ends with one "Nếu làm sai:" sentence', async () => {
    openM03();
    await screen.findByRole('img', { name: /oxit trần/i });
    for (const [code] of SLOTS_AT) {
      await goTo(code);
      const traveler = screen.getByRole('complementary', { name: /phiếu công đoạn/i });
      expect(within(traveler).getAllByText(/^Nếu làm sai:/), code).toHaveLength(1);
    }
  });
});

describe('/m03: the worker and the picture', () => {
  it('asks the worker for the first session and the first view, and describes the picture it gets', async () => {
    const client = openM03();
    expect(await screen.findByRole('img', { name: /oxit trần/i })).toBeInTheDocument();
    expect(client.starts).toHaveLength(1);
    expect(client.views[0]!.step).toBe(0);
  });

  it('draws the stage of the step: coated at 3.2, latent at 3.4, developed at 3.5', async () => {
    openM03();
    await screen.findByRole('img', { name: /oxit trần/i });
    await goTo('3.2');
    expect(
      await screen.findByRole('img', {
        name: new RegExp(`phủ resist dày ${resistThicknessNm(3000)} nm`),
      }),
    ).toBeInTheDocument();
    await goTo('3.4');
    expect(await screen.findByRole('img', { name: /ảnh ẩn/i })).toBeInTheDocument();
    await goTo('3.5');
    expect(await screen.findByRole('img', { name: /sau khi tráng/i })).toBeInTheDocument();
  });

  it('is released when the page goes away', async () => {
    window.history.replaceState({}, '', '/m03');
    const client = inlineM03Client();
    const { unmount } = render(
      <App createClient={() => inlineClient()} createM03Client={() => client} />,
    );
    await screen.findByRole('img', { name: /oxit trần/i });
    unmount();
    expect(client.disposed).toBe(true);
  });
});

describe('/m03: the controls of steps 3.1 – 3.4', () => {
  it('3.1 has no control, says so, and the lesson says why', async () => {
    openM03();
    await stepNav();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByText(/không có điều khiển/i)).toBeInTheDocument();
    expect(screen.getByText(/không mô phỏng bước đó/i)).toBeInTheDocument();
  });

  it('3.2: the spin speed changes the thickness, in the session sent to the worker and in the tile', async () => {
    const client = openM03();
    await goTo('3.2');
    change(/tốc độ quay/i, 4000);
    expect(screen.getByRole('slider', { name: /tốc độ quay/i })).toHaveValue('4000'); // at once
    await waitFor(() => expect(client.views.at(-1)!.recipe.spinRpm).toBe(4000));
    const tiles = await screen.findByLabelText(/chỉ số của bước/i);
    await waitFor(() =>
      expect(within(tiles).getByText(`${resistThicknessNm(4000)} nm`)).toBeInTheDocument(),
    );
  });

  it('3.3: a bake that is too cool is a "Nung thiếu" tile, a nominal one "Nung đủ", never the verdict word', async () => {
    openM03();
    await goTo('3.3');
    const tiles = await screen.findByLabelText(/chỉ số của bước/i);
    await waitFor(() => expect(within(tiles).getByText('Nung đủ')).toBeInTheDocument());
    expect(within(tiles).queryByText('Đạt')).not.toBeInTheDocument();
    change(/nhiệt độ nung/i, 60);
    await waitFor(() => expect(within(tiles).getByText('Nung thiếu')).toBeInTheDocument());
  });

  describe('3.4', () => {
    it('has the source, the resist, the width, the dose and the focus, and the two charts', async () => {
      openM03();
      await goTo('3.4');
      expect(screen.getByRole('group', { name: /nguồn sáng/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /loại resist/i })).toBeInTheDocument();
      for (const name of [/độ rộng cửa sổ/i, /liều chiếu/i, /lệch tiêu cự/i]) {
        expect(slider(name)).toBeInTheDocument();
      }
      expect(await screen.findByRole('img', { name: /ảnh trên không/i })).toBeInTheDocument();
      expect(await screen.findByRole('img', { name: /cửa sổ quy trình/i })).toBeInTheDocument();
    });

    it('shows the wavelength and NA of the source chosen, from the constants', async () => {
      openM03();
      await goTo('3.4');
      expect(screen.getByText(/λ = 365 nm/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /krf/i }));
      expect(await screen.findByText(/λ = 248 nm/)).toBeInTheDocument();
    });

    it('asks for the chart on arriving, again for another source, but not when only the dose moves', async () => {
      const client = openM03();
      await goTo('3.4');
      await screen.findByRole('img', { name: /cửa sổ quy trình/i });
      expect(client.windows).toHaveLength(1);
      change(/liều chiếu/i, 1.2);
      await waitFor(() => expect(client.views.at(-1)!.recipe.dose).toBe(1.2));
      expect(client.windows).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: /krf/i }));
      await waitFor(() => expect(client.windows).toHaveLength(2));
      expect(client.windows[1]!.recipe.source).toBe('krf');
    });

    it('keeps the focus at the same number of DOF when the source changes', async () => {
      const client = openM03();
      await goTo('3.4');
      change(/lệch tiêu cự/i, 0.5);
      await waitFor(() =>
        expect(client.views.at(-1)!.recipe.defocusNm).toBeCloseTo(0.5 * dofNm('i'), 6),
      );
      fireEvent.click(screen.getByRole('button', { name: /arf/i }));
      await waitFor(() =>
        expect(client.views.at(-1)!.recipe.defocusNm).toBeCloseTo(0.5 * dofNm('arf'), 6),
      );
    });

    it('turns the resist negative, and the aerial chart follows', async () => {
      openM03();
      await goTo('3.4');
      await screen.findByRole('img', { name: /ảnh trên không, resist dương/i });
      fireEvent.click(screen.getByRole('button', { name: /^âm$/i }));
      expect(
        await screen.findByRole('img', { name: /ảnh trên không, resist âm/i }),
      ).toBeInTheDocument();
    });

    it('shows the effective k₁ as a tile and offers no way to type it', async () => {
      openM03();
      await goTo('3.4');
      const tiles = await screen.findByLabelText(/chỉ số của bước/i);
      await waitFor(() => expect(within(tiles).getByText('k₁ hiệu dụng')).toBeInTheDocument());
      expect(screen.queryByRole('slider', { name: /k₁/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('spinbutton', { name: /k[₁₂]/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('slider', { name: /k₂/i })).not.toBeInTheDocument();
    });
  });

  it('leaves step 3.7 for the next part of the page: no control yet', async () => {
    openM03();
    await goTo('3.7');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});

describe('/m03: steps 3.5 and 3.6', () => {
  it('3.5 has the develop time as its one slider, and it changes the session sent to the worker', async () => {
    const client = openM03();
    await goTo('3.5');
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    change(/thời gian tráng/i, 2);
    expect(slider(/thời gian tráng/i)).toHaveValue('2'); // at once
    await waitFor(() => expect(client.views.at(-1)!.recipe.developMin).toBe(2));
    const tiles = await screen.findByLabelText(/chỉ số của bước/i);
    await waitFor(() => expect(within(tiles).getByText('Tráng quá')).toBeInTheDocument());
    expect(within(tiles).queryByText('Đạt')).not.toBeInTheDocument();
  });

  it('3.5 does not show the verdict: that is for the inspection', async () => {
    openM03();
    await goTo('3.5');
    await screen.findByLabelText(/chỉ số của bước/i);
    expect(screen.queryByText('Phán quyết:')).not.toBeInTheDocument();
  });

  it('3.6 has no control, shows the verdict of the default print and the sentence that says why', async () => {
    openM03();
    await goTo('3.6');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    const grade = await screen.findByRole('region', { name: /phán quyết/i });
    expect(within(grade).getByText('Phán quyết:')).toBeInTheDocument();
    expect(within(grade).getByText('Đạt')).toBeInTheDocument();
    expect(within(grade).getByText(/cửa sổ mở tới oxit, rộng/i)).toBeInTheDocument();
    expect(within(grade).getByText(/chưa tính căn chỉnh/i)).toBeInTheDocument();
  });

  it('3.6 says Hỏng, gives the root cause first and the scum among the others', async () => {
    const client = openM03();
    await goTo('3.4');
    change(/độ rộng cửa sổ/i, 400);
    change(/liều chiếu/i, 0.7);
    await waitFor(() => expect(client.views.at(-1)!.recipe.designNm).toBe(400));
    await goTo('3.6');
    const grade = await screen.findByRole('region', { name: /phán quyết/i });
    await waitFor(() => expect(within(grade).getByText('Hỏng')).toBeInTheDocument());
    expect(within(grade).getByText(/liều hiệu dụng .* thấp hơn liều chuẩn/i)).toBeInTheDocument();
    const others = within(grade).getByRole('list', { name: /nguyên nhân còn lại/i });
    expect(within(others).getByText('Cặn ở chân')).toBeInTheDocument();
  });

  it('3.6 lists a flag that is not a defect under Lưu ý, beside a verdict that stays Đạt', async () => {
    openM03();
    await goTo('3.5');
    change(/thời gian tráng/i, 2);
    await goTo('3.6');
    const grade = await screen.findByRole('region', { name: /phán quyết/i });
    await waitFor(() => expect(within(grade).getByText('Đạt')).toBeInTheDocument());
    const cautions = screen.getByRole('list', { name: /lưu ý/i });
    expect(within(cautions).getByText(/bản in vẫn đúng, nhưng tráng/i)).toBeInTheDocument();
    expect(within(grade).queryByText(/bản in vẫn đúng/i)).not.toBeInTheDocument();
  });

  it('3.6 has no Lưu ý when there is nothing to watch', async () => {
    openM03();
    await goTo('3.6');
    await screen.findByRole('region', { name: /phán quyết/i });
    expect(screen.queryByRole('list', { name: /lưu ý/i })).not.toBeInTheDocument();
  });
});
