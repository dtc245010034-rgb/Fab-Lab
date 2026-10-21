/**
 * The worker also runs M03. Requests are told apart by kind (the M04 recipe, an M03 view, an M03
 * process window); each kind has its own mailbox, so a newer request replaces a waiting one of the
 * same kind and never one of another kind. Everything is computed one at a time, in the order the
 * requests arrived, and the M04 path keeps behaving as tests/workers/simService.test.ts says.
 */
import * as Comlink from 'comlink';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_M03_RECIPE, DEFAULT_RECIPE, M03_BENCH_WARMUP_RUNS } from '../../src/sim/defaults';
import {
  createSession,
  deriveView,
  goToStep,
  processWindowSpecFor,
  runM03Request,
  setRecipe,
  type M03Request,
} from '../../src/sim/m03';
import { runRecipe, type Recipe } from '../../src/sim/recipe';
import { SimService, type SimApi } from '../../src/workers/simService';
import { drive, manualYield, settle } from './helpers';

const view = (step = 0, seed = 1): M03Request => ({
  kind: 'view',
  session: goToStep(createSession(seed), step),
});
const windowRequest = (): M03Request => ({
  kind: 'window',
  recipe: DEFAULT_M03_RECIPE,
  spec: processWindowSpecFor('i'),
});

function countingService() {
  const gate = manualYield();
  const m03: M03Request[] = [];
  const etch: Recipe[] = [];
  const service = new SimService({
    yieldToEventLoop: gate.yieldToEventLoop,
    compute: (recipe) => {
      etch.push(recipe);
      return runRecipe(recipe);
    },
    computeM03: (request) => {
      m03.push(request);
      return runM03Request(request);
    },
  });
  return { service, gate, m03, etch };
}

describe('SimService.runM03', () => {
  it('answers a view request with the view of the session', async () => {
    const { service, gate } = countingService();
    const request = view(4);
    const pending = service.runM03(1, request);
    gate.release();
    const outcome = await pending;
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok' || request.kind !== 'view') return;
    expect(outcome.id).toBe(1);
    expect(outcome.result.kind).toBe('view');
    if (outcome.result.kind !== 'view') return;
    const direct = deriveView(request.session);
    expect(outcome.result.view.exposure).toEqual(direct.exposure);
    expect(outcome.result.view.verdict).toEqual(direct.verdict);
    expect(outcome.result.view.section.materials).toEqual(direct.section.materials);
  });

  it('answers a window request with the process window of the recipe', async () => {
    const { service, gate } = countingService();
    const pending = service.runM03(7, windowRequest());
    gate.release();
    const outcome = await pending;
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok' || outcome.result.kind !== 'window') return;
    expect(outcome.id).toBe(7);
    expect(outcome.result.window.pass).toHaveLength(25 * 25);
    expect(outcome.result.window.passCount).toBeGreaterThan(0);
  });

  it('does not compute until the event loop has had a turn', () => {
    const { service, m03 } = countingService();
    void service.runM03(1, view());
    expect(m03).toHaveLength(0);
  });

  it('computes one request per turn', async () => {
    const { service, gate, m03 } = countingService();
    const a = service.runM03(1, view(1));
    const b = service.runM03(2, windowRequest());
    gate.release();
    await a;
    expect(m03).toHaveLength(1);
    gate.release();
    await b;
    expect(m03).toHaveLength(2);
  });

  it('replaces a waiting request of the same kind with a newer one, and says so', async () => {
    const { service, gate, m03 } = countingService();
    const older = service.runM03(1, view(1));
    const newer = service.runM03(2, view(5));
    gate.release();
    expect(await older).toEqual({ status: 'superseded', id: 1 });
    expect((await newer).status).toBe('ok');
    expect(m03).toHaveLength(1);
    expect(m03[0]).toEqual(view(5));
  });

  it('does not let a view replace a process-window request, or the other way round', async () => {
    const { service, gate, m03 } = countingService();
    const first = service.runM03(1, windowRequest());
    const second = service.runM03(2, view(3));
    gate.release();
    const a = await first;
    gate.release();
    const b = await second;
    expect(a.status).toBe('ok');
    expect(b.status).toBe('ok');
    expect(m03.map((r) => r.kind)).toEqual(['window', 'view']); // in the order they arrived
  });

  it('keeps M03 and M04 requests apart: neither replaces the other', async () => {
    const { service, gate, m03, etch } = countingService();
    const etchRun = service.run(1, DEFAULT_RECIPE);
    const m03Run = service.runM03(2, view(2));
    gate.release();
    expect((await etchRun).status).toBe('ok');
    gate.release();
    expect((await m03Run).status).toBe('ok');
    expect(etch).toEqual([DEFAULT_RECIPE]);
    expect(m03).toHaveLength(1);
  });

  it('still replaces a waiting M04 request with a newer M04 request when M03 is waiting too', async () => {
    const { service, gate, etch } = countingService();
    const old = service.run(1, DEFAULT_RECIPE);
    void service.runM03(2, view());
    const fresh = service.run(3, DEFAULT_RECIPE);
    gate.release();
    expect(await old).toEqual({ status: 'superseded', id: 1 });
    gate.release();
    gate.release();
    expect((await fresh).status).toBe('ok');
    expect(etch).toHaveLength(1);
  });

  it('rejects the request the model refuses, and goes on serving the next one', async () => {
    const { service, gate } = countingService();
    const bad = setRecipe(createSession(1), { dose: -1 });
    const failed = service.runM03(1, { kind: 'view', session: bad });
    const caught = failed.then(
      () => null,
      (error: unknown) => error,
    );
    gate.release();
    expect(await caught).toBeInstanceOf(RangeError);
    const next = service.runM03(2, view());
    gate.release();
    expect((await next).status).toBe('ok');
  });

  it('counts as a real request for the warm-up: the warm-up waits for it, then runs', async () => {
    const gate = manualYield();
    const etch: Recipe[] = [];
    const service = new SimService({
      yieldToEventLoop: gate.yieldToEventLoop,
      compute: (recipe) => {
        etch.push(recipe);
        return runRecipe(recipe);
      },
      warmUp: [DEFAULT_RECIPE, DEFAULT_RECIPE],
    });
    service.startWarmUp();
    gate.release();
    await settle();
    expect(etch).toHaveLength(0); // nothing real has been answered yet: the warm-up holds back

    const pending = service.runM03(1, view());
    gate.release();
    await pending;
    expect(etch).toHaveLength(0); // the M03 request was served first
    gate.release();
    await settle();
    gate.release();
    await settle();
    expect(etch).toHaveLength(2); // and now the warm-up has had its turns
  });
});

describe('SimService.runM03 over a Comlink channel', () => {
  const ports: MessagePort[] = [];
  afterEach(() => {
    ports.splice(0).forEach((p) => p.close());
  });

  function remote() {
    const { port1, port2 } = new MessageChannel();
    ports.push(port1, port2);
    Comlink.expose(new SimService(), port2 as unknown as Comlink.Endpoint);
    return Comlink.wrap<SimApi>(port1 as unknown as Comlink.Endpoint);
  }

  it('brings the grid and the chart back as typed arrays', async () => {
    const api = remote();
    const viewOutcome = await api.runM03(1, view(4));
    expect(viewOutcome.status).toBe('ok');
    if (viewOutcome.status === 'ok' && viewOutcome.result.kind === 'view') {
      const { section } = viewOutcome.result.view;
      expect(section.materials).toBeInstanceOf(Uint8Array);
      expect(section.materials).toHaveLength(section.widthCells * section.heightCells);
    }
    const windowOutcome = await api.runM03(2, windowRequest());
    expect(windowOutcome.status).toBe('ok');
    if (windowOutcome.status === 'ok' && windowOutcome.result.kind === 'window') {
      expect(windowOutcome.result.window.pass).toBeInstanceOf(Uint8Array);
      expect(windowOutcome.result.window.cdNm).toBeInstanceOf(Float64Array);
    }
  });

  it('brings a failure of the model back as an error', async () => {
    const api = remote();
    const bad = setRecipe(createSession(1), { dose: -1 });
    await expect(api.runM03(1, { kind: 'view', session: bad })).rejects.toThrow();
  });
});

describe('SimService.bench times the process window as well', () => {
  /** M04 `compute` and M03 `computeM03` that report the n-th call as taking n ms. */
  function stepped() {
    const gate = manualYield();
    const etchLog: Recipe[] = [];
    const m03Log: M03Request[] = [];
    const service = new SimService({
      yieldToEventLoop: gate.yieldToEventLoop,
      compute: (recipe) => {
        etchLog.push(recipe);
        const n = etchLog.length;
        return { ...runRecipe(recipe), timingsMs: { arrival: n / 2, total: n } };
      },
      computeM03: (request) => {
        m03Log.push(request);
        const result = runM03Request(request);
        return { ...result, timingsMs: { total: m03Log.length } };
      },
    });
    return { service, gate, etchLog, m03Log };
  }

  it('runs the 25 × 25 chart a few times untimed, then once per sample', async () => {
    const { service, gate, m03Log } = stepped();
    const report = await drive(gate, service.bench(2));
    expect(m03Log).toHaveLength(M03_BENCH_WARMUP_RUNS + 2);
    for (const request of m03Log) expect(request).toEqual(windowRequest());
    // the samples are the calls after the untimed ones
    expect(report.processWindow).toEqual({
      doseSteps: 25,
      defocusSteps: 25,
      totalMs: [M03_BENCH_WARMUP_RUNS + 1, M03_BENCH_WARMUP_RUNS + 2],
    });
  });

  it('leaves the M04 samples alone', async () => {
    const { service, gate, etchLog } = stepped();
    const report = await drive(gate, service.bench(2));
    expect(etchLog).toHaveLength(6); // cases A, B, C, twice each, as before
    expect(report.cases[0]).toEqual({ id: 'A', totalMs: [1, 2], arrivalMs: [0.5, 1] });
  });

  it('refuses a bad number of runs before timing anything', async () => {
    const { service, m03Log } = stepped();
    await expect(service.bench(0)).rejects.toThrow(RangeError);
    expect(m03Log).toHaveLength(0);
  });

  it('brings plain numbers back over a Comlink channel', async () => {
    const { port1, port2 } = new MessageChannel();
    try {
      Comlink.expose(new SimService(), port2 as unknown as Comlink.Endpoint);
      const api = Comlink.wrap<SimApi>(port1 as unknown as Comlink.Endpoint);
      const report = await api.bench(2);
      expect(report.processWindow?.totalMs).toHaveLength(2);
      for (const ms of report.processWindow!.totalMs)
        expect(Number.isFinite(ms) && ms >= 0).toBe(true);
    } finally {
      port1.close();
      port2.close();
    }
  });
});
