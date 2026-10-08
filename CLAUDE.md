# Fab Lab — CLAUDE.md

Interactive web course that teaches semiconductor fabrication by letting learners run each
process step themselves (wafer → oxidation → lithography → etch → doping/films → packaging)
and watch a physically-grounded cross-section respond. UI language: **Vietnamese**.
Audience: students and curious non-experts. Accuracy matters more than spectacle.

## Commands
- `npm run dev` — local dev server (Vite)
- `npm test` — Vitest, must pass before any commit
- `npm run build` — type-check + production build, must pass before any commit
- `npm run lint` — ESLint + Prettier check
- `npm run e2e` — Playwright smoke tests (one per module), must pass before merging to main

## Stack
Vite + TypeScript (strict) + React 18 for the UI shell. Canvas 2D for cross-sections,
Three.js only for 3D scenes (wafer, equipment). Physics/sim run in a **Web Worker** (Comlink);
the UI thread only sends parameters and draws results. Learner text in **MDX + KaTeX**.
Vitest (unit) + Playwright (e2e smoke). GitHub Actions CI. Static deploy to Cloudflare Pages.
No backend until Phase 4 (see docs/PLAN.md). No external asset files: geometry is generated in code.

## Architecture (dependency direction: ui → sim → physics; never the reverse)
```
src/physics/   pure functions + typed data, no DOM, no React, no randomness without a seed
src/sim/       step state machine, recipes, scoring, grid ops (uses physics/)
src/workers/   sim.worker.ts — exposes sim/ via Comlink; never import React here
src/render/    canvas2d/ (cross-section, overlays) and three/ (3D scenes)
src/ui/        React components (Traveler, StepNav, ParamSlider, MetricTile, Note)
src/modules/   m01-wafer … m06-packaging: steps, params, scoring config per module
src/content/vi/ all learner-facing text as MDX, one folder per module
tests/physics/ reference-value tests for every physics function
docs/          PLAN, SCIENCE, DESIGN, SESSIONS, PROGRESS, modules/*.md
reference/     prototype-m04-etch.html (working single-file prototype of the etch model)
content-source/ raw study data (semi-intro-data.json) — source material only, never import into src/
```

## Rules that are never negotiable
1. **No invented numbers.** Every physical constant, rate or coefficient lives in
   `src/physics/constants.ts` with a `source` field (book + table/page) or the flag
   `illustrative: true`. If you don't have a sourced value, use `illustrative: true` and
   add a line to `docs/PROGRESS.md` under "Values to verify". Never present an illustrative
   value as real in UI copy.
2. **Physics stays pure and tested.** Any change in `src/physics/` needs a test in
   `tests/physics/` that checks a reference value or a qualitative law
   (monotonicity, limits, symmetry). Do not loosen a failing test to make it pass; report it.
3. **Units in code:** length nm, time minutes, temperature °C, pressure mTorr, power W,
   dose relative (×) unless the spec says otherwise. Name variables with units
   (`thicknessNm`, `timeMin`).
4. **Learner copy is Vietnamese**, plain and correct. Mechanisms explained in 2–4 sentences,
   one equation max per step. Technical terms: Vietnamese first, English in parentheses
   on first use (e.g. "khắc dị hướng (anisotropic)").
5. Read `docs/SCIENCE.md` before touching any physics or explanatory text.
6. When using `content-source/`: rewrite in your own words, drop items marked
   `courseSpecific: true`, apply the corrections listed in content-source/README.md.
7. Visual rules come from `docs/DESIGN.md` (tokens, fonts, cleanroom yellow-light look).
   Do not introduce new colors or fonts outside the tokens.

## How to work in a session
- Work on **one module or one milestone per session**. Read only the relevant
  `docs/modules/mXX-*.md`, not all of them.
- Start in plan mode: restate the acceptance criteria, list files to touch, then implement.
- Physics first (with tests), then sim, then render, then UI and copy.
- Before finishing: `npm test && npm run build`, update `docs/PROGRESS.md`
  (done / next / values to verify), then commit with a message `mXX: <what changed>`.
- If a spec is ambiguous or contradicts SCIENCE.md, stop and ask instead of guessing.

## Performance budget
- Cross-section grid ≤ 400×250 cells; a full etch recompute must finish < 50 ms on a
  mid-range phone. Recompute only when parameters change; animation only thresholds.
- Heavy compute (etch, diffusion, Bosch cycles) always runs in the worker; the UI must stay
  responsive while a recompute is in flight (show the previous result until the new one lands).
- Page JS ≤ 300 KB gzipped excluding Three.js; Three.js loaded only in modules that use 3D.
- Must work at 380 px width; no horizontal page scroll.

## Do not
- Do not add a backend or accounts before Phase 4. Analytics: Cloudflare Web Analytics only
  (cookieless); no third-party trackers, no personal data.
- Do not copy text or figures from textbooks or websites; paraphrase and cite.
- Do not name or imitate a specific real fab's proprietary recipe.
- Do not refactor modules you were not asked to touch.
