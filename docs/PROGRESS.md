# Fab Lab — Tiến độ

## Done
- Prototype M04 (single-file HTML) — reference/prototype-m04-etch.html
- S0.1 Khởi tạo dự án
  - Vite 8 + TypeScript strict + React 18 + Vitest 5 + ESLint 9 (flat) + Prettier; cấu trúc thư mục theo CLAUDE.md.
  - ESLint chặn phụ thuộc ngược `ui → sim → physics` (`no-restricted-imports`) và chặn import `content-source/`.
  - Design tokens đúng `docs/DESIGN.md` (+ `--screen:#0f1320`, 3 biến font); có test khóa tên/giá trị token và cấm màu rời ngoài `tokens.css`.
  - Fonts tự host qua `@fontsource` (Saira Condensed 700/800, Be Vietnam Pro 400/500/600, JetBrains Mono 400/600), không gọi Google Fonts.
  - Khung `Viewer` + `Traveler` (6 bước, rỗng), responsive: lưới 2 cột ≥ 960 px, xếp dọc dưới 960 px (Viewer trước).
  - Kiểm tra: `npm test`, `npm run build`, `npm run lint` xanh; JS 46,7 KB gzip; ở viewport 380 px không cuộn ngang, nút bước 55×46 px.
- Tách token màu trạng thái (quyết định 2026-10-08): `--ok #2f7d4c`, `--warn #9a5c00` (đổi từ `#b9700d`), `--bad #b3261e` cho viền/chấm/icon;
  `--ok-ink #1f5c37`, `--warn-ink #844c00` cho chữ (chữ "bad" dùng `--bad`). Quy tắc ghi trong `docs/DESIGN.md`;
  `tests/ui/tokens.test.ts` kiểm tra tương phản và cấm dùng `--ok`/`--warn` làm màu chữ trong `src/`.
- S0.2 Port mô hình khắc từ prototype (nhánh `s0.2-etch-port`, đã merge vào `main`)
  - `src/physics/constants.ts`: mọi hằng số mức C, gom nhóm `litho.*`, `etch.wet.*`, `etch.rie.*`, `geometry.*`. Mỗi entry có `kind`:
    `physical-quantity` (đại lượng vật lý, sách kiểm chứng được) hoặc `model-shape` (hệ số hình dạng mô hình, chỉ xu hướng có nghĩa).
    Kích thước lưới 260×150 và 10 nm/ô nằm ở `src/sim/defaults.ts`, không gắn mức (là cấu hình mô phỏng, không phải phát biểu vật lý).
  - `src/physics/litho.ts`: `resistThicknessNm`, `minFeatureNm`, `printLitho`. Trả số (`cdMinNm`, `ratio`, `printedNm`, `scumNm`, `taperNm`, `resistThicknessNm`) và cờ
    (`below-resolution`, `near-resolution`, `underdose`, `overdose`), không trả câu tiếng Việt; chữ cho người học thuộc MDX.
  - `src/physics/etch.ts`: `wetEtchRates`, `rieRates`, `arrivalTime` (Dijkstra 16 hướng). Kiểu `MaterialGrid` đặt ở đây; mã vật liệu `Material` ở `src/physics/materials.ts` (từ S0.5, xem bên dưới)
    (physics không import sim; `erasableSyntaxOnly` cấm `enum` nên dùng `const` object).
  - `src/sim/grid.ts`: `buildGrid(spec, litho, stage)` và `measureEtch` (chỉ số của prototype). `grade` (chấm điểm) chưa port, để S1.2.
  - Test: 3 ca hồi quy `m04-etch.md` (±20 nm, ±2°); 4 quy luật SCIENCE mục 5; parity với prototype ở 1e-9 trên 10 công thức khắc + 11 hàng litho,
    kèm "dấu vân tay" toàn trường arrival-time. Fixture sinh bằng `reference/capture-m04-golden.mjs` (chạy nguyên văn hàm của prototype).
  - Kiểm đột biến: 17 lỗi cố ý chèn vào mã, 16 bị test bắt; lỗi còn lại tương đương (dòng `if (s === Infinity) continue` dư, vì `rate/Infinity = 0` đã bị chặn ngay sau).
  - Spec `docs/modules/m04-etch.md`: bảng ca hồi quy ghi rõ điều kiện litho chung (3000 rpm, i-line, liều ×1, lưới mặc định).
  - Phát hiện về quy luật ướt "undercut ≈ độ sâu ±1 ô": trên lưới, undercut = độ sâu đo được − đúng 1 ô (bước đầu từ ô không khí vào oxit tốn trọn một ô).
    So với `rate × t` thô, sai lệch có thể tới 2 ô (thêm 1 ô do làm tròn xuống số ô nguyên). Test kiểm ±1 ô theo độ sâu đo trong cùng mô hình, và kiểm hệ số góc
    (Δundercut ≈ rate × Δt, sai ≤ 1 ô) trên 5 cặp thời gian; không nới ngưỡng.
  - Tối ưu hiệu năng (commit riêng): `arrivalTime(grid, rates, { maxTimeMin })` dừng tìm khi vượt mốc; ô muộn hơn mốc trả `Infinity`.
    `maxTimeMin` phải là giá trị lớn nhất của thanh trượt thời gian cho công thức đó (BOE 8 phút, HF 49% 0,5 phút, RIE 14 phút), **không** phải thời gian hiện tại:
    kéo thanh thời gian chỉ đổi ngưỡng đọc `arrival ≤ T`, không tính lại. `arrivalTime` trả `{ arrival, maxTimeMin }` và `measureEtch(section, field, timeMin)` ném `RangeError` nếu `timeMin > maxTimeMin` (ô chưa tính là `Infinity`, đọc muộn hơn sẽ báo thiếu khắc mà không có dấu hiệu nào); worker (S0.4) phải tính lại khi đổi công thức.
    Ô không khí không đi qua heap (thời gian 0, relax thẳng sang lân cận), heap có cận trên chặt 16 ô/ô rắn và có chốt chặn tràn. Kết quả ≤ `maxTimeMin` trùng bản không giới hạn (test trên 10 công thức, 5 mốc thời gian mỗi công thức).
    Kiểm bằng Dijkstra quét mảng O(n²) độc lập trên lưới ngẫu nhiên có seed. Bài học đo được: tách phần relax thành closure làm vòng lặp chậm 15–60%, nên giữ một vòng lặp, relax viết thẳng trong thân.
  - Sau review (commit riêng): `arrivalTime` kiểm tra đầu vào và ném `RangeError`: tốc độ đứng phải hữu hạn và > 0, tốc độ ngang hữu hạn và ≥ 0, độ chọn lọc > 0 (cho phép `Infinity`), không NaN; mã vật liệu lạ trong lưới (kiểm trong vòng đếm ô rắn, không thêm vòng quét). Kiểm đột biến cho phần này: 10/10 bị bắt.
- S0.3 Renderer mặt cắt + deploy (nhánh `s0.3-renderer`, chưa merge vào `main`, chờ review)
  - `src/sim/recipe.ts`: `runRecipe(recipe, spec)` chạy litho → lưới → tốc độ → arrival-time → chỉ số, truyền `maxTimeMin` = mức tối đa của thanh trượt (BOE 8, HF 49% 0,5, RIE 14 phút; bảng `ETCH_TIME_MAX_MIN` trong `defaults.ts`),
    và trả `timingsMs` (`arrival`, `total`) cho `?debug=1`. `DEFAULT_RECIPE` = ca B (RIE 200 W, 30 mTorr, 4,6 phút, cửa sổ 800 nm; 3000 rpm, i-line, liều ×1). Test so với glue của test (`tests/sim/helpers.ts`) trên cả trường arrival và với bảng ca B.
  - `src/render/canvas2d/`, tách phần thuần (có unit test) khỏi phần gọi canvas:
    `pixels.ts` (grid → RGBA với cùng điều kiện "bị khắc" như `measureEtch`, kiểm ở ca A và B rằng độ rộng cửa sổ trên ảnh = `topNm`/`bottomNm`; `chooseScale`/`planCanvas`: số nguyên pixel thiết bị trên mỗi ô; `formatApproxNm`: làm tròn theo `cellNm` và có "≈"),
    `overlay.ts` (hình học đường kích thước đỉnh/đáy, thước 500 nm, chip nhãn, tính bằng pixel thiết bị),
    `palette.ts` (màu đọc từ token lúc vẽ; token không parse được thành hex → `RangeError` nêu tên token; font stack luôn kết thúc bằng `monospace`),
    `crossSection.ts` (lời gọi canvas: `imageSmoothingEnabled=false`, `drawImage` ở bội số nguyên, chip nhãn đo bằng `measureText` sau `document.fonts.load` rồi vẽ lại khi font về).
  - ESLint có thêm khối luật cho `src/render/**` (cấm import `ui`, `workers`, `modules`, `content` và React; đã thử chèn import sai để chắc luật bắt được). `tests/render/architecture.test.ts` quét import và màu rời (hex, `rgb()`) trong `src/render`.
  - Viewer nhận `recipe` + kết quả qua props; `App` tính `runRecipe(DEFAULT_RECIPE)` một lần trên main thread (worker ở S0.4). Có: dòng công thức và "1 ô = 10 nm", chú giải vật liệu bằng HTML (ô màu dùng `var(--token)`), dòng nhãn "mô hình hình học đơn giản, số liệu minh họa" (quy tắc 1), `aria-label` dựng từ chỉ số, và `?debug=1` hiện thời gian `runRecipe` và riêng `arrivalTime`.
    Ba ô chỉ số vẫn là chỗ trống (UI chỉ số thuộc S1.x).
  - Deploy: `wrangler.jsonc` (Worker `fab-lab`, chỉ có assets: `./dist`, `single-page-application`; không `main`, không binding), `wrangler` ghim đúng `4.148.0`, `npm run deploy` (phương án phụ), `.gitignore` thêm `.wrangler/` và `.dev.vars*`, `README.md` với Workers Builds là đường chính (build `npm ci && npm test && npm run build`, deploy `npx wrangler deploy`) và ghi rõ Actions ở S0.4 không deploy. `tests/deploy/config.test.ts` khóa các điểm này.
    Đã kiểm `npx wrangler deploy --dry-run` (đọc 52 tệp từ `dist/`); **chưa deploy thật** (cần nối Workers Builds trên dashboard, xem README). "Cloudflare Pages" trong `CLAUDE.md`, `docs/PLAN.md`, `docs/SESSIONS.md` đã đổi thành Workers static assets.
  - Kiểm tra: `npm test` (391 test), `npm run build`, `npm run lint` xanh. JS 54,0 KB gzip (S0.1: 46,7 KB; ngân sách 300 KB). Trong Chrome 154 (dpr 1,25 → ×3 ở 1536 px; iframe 380 px → ×1): dòng quét chỉ chứa đúng màu token, độ dài mọi đoạn là bội của hệ số phóng, không có màu pha; không cuộn ngang ở 380 px; không thấy lỗi nào do trang phát ra trong console (chỉ có lỗi của một extension Chrome, lọc theo từ khóa `React|Warning|canvas|font|RangeError`).
  - Điều quan sát được khi kiểm tra:
    - Trên ảnh ca B, resist chỉ còn ≈ 410 nm chứ không phải 500 nm: RIE ăn cả resist (độ chọn lọc resist ≈ 3,6 ở 200 W), đúng mô hình, không phải lỗi vẽ.
    - Điện thoại: hệ số phóng là số nguyên nên ảnh rộng ≈ 260 css px trong khung ≈ 317 px (dpr 2 và 3), hai bên có dải nền `--screen`; ở dpr 1,25 là ×1 (208 css px). Nhãn chiếm khá nhiều chỗ trên ảnh nhỏ; chưa chỉnh.
    - `npm audit`: 3 cảnh báo mức cao, cả ba qua chuỗi `wrangler → miniflare → sharp` (chỉ dev, không vào `dist/`; dependency production: 0). `npm audit fix --force` sẽ hạ wrangler xuống 4.15.2 nên không chạy.
- S0.3-fix: sửa nhỏ sau review S0.3 (nhánh `s0.3-fix`)
  - Nền canvas ngoài lưới không còn trùng màu không khí: canvas giờ rộng đúng bằng khung chứa (`planCanvas` thêm `gridWidthPx`, `gridX`; lưới nằm giữa, cạnh chia đều), hai bên tô bằng token `--navy` (`SURROUND_TOKEN`, không thêm hex mới; `.screen` trong CSS cùng token, có test khóa).
    Hai mép trái/phải có đường ngắt zigzag (`breakEdges` trong `overlay.ts`: răng sâu 4 css px, mỗi nét dốc 6 css px, nét 1 css px, màu `--panel`); răng cắn vào lưới tối đa 4 css px ở rìa, xa vùng cửa sổ khắc nên không ảnh hưởng số đo. Nét chéo của zigzag có khử răng cưa, nên hàng quét ở sát mép có màu pha (phần ô vẫn chỉ có màu token).
  - Test thuần: mọi pixel ngoài lưới (7 cỡ khung × dpr, với giá trị token thật đọc từ `tokens.css`) có màu surround và ≠ màu không khí; hai dải + lưới lát kín canvas; zigzag chạy từ đỉnh tới đáy, đối xứng, tỉ lệ theo dpr; `--navy` ≠ `--screen` và tương phản ≥ 1,3 với nó.
  - Header Viewer: " · " giữa dòng công thức và "1 ô = 10 nm" (chuỗi nằm trong văn bản, không phải CSS; khi xuống dòng ở 380 px dấu chấm nằm cuối dòng trên).
  - Số test: 426 (trước đó 391). `npm run build`, `npm run lint` xanh. JS 54,5 KB gzip.
  - Cần review mắt: chọn `--navy` vì là token tối khác hẳn `--screen` mà không trùng vật liệu nào (`--ink` quá gần `--screen`, `--muted` gần `--si`); tương phản `--navy`/`--screen` chỉ ≈ 1,4:1 nên phần việc phân biệt chủ yếu do đường zigzag sáng. Nếu muốn dải ngoài sáng hơn, đổi `SURROUND_TOKEN` và token của `.screen` (một dòng mỗi nơi).
  - Ghi chú về `CLAUDE.md`: `npm run e2e` chưa tồn tại (thuộc S0.4), nên chưa chạy được trước khi merge. (Đã có từ S0.4.)
  - Workers Builds chạy lần đầu trên nhánh này (build #94d8a808, 46 s): `npm ci`, 426 test và `npm run build` đều xanh trên Cloudflare (Node 24.18, JS 54,51 KB gzip, trùng bản local). Đỏ ở bước deploy: lệnh deploy của nhánh khác `main` trên dashboard là `npx wrangler preview`, và wrangler 4.148.0 từ chối nếu `wrangler.jsonc` thiếu khối `"previews"`. Đã thêm `"previews": {}` (test khóa, README ghi lại); `wrangler deploy --dry-run` cho kết quả như cũ. Chưa chạy được `wrangler preview` ở máy vì cần token Cloudflare: bằng chứng cuối là lần build kế tiếp trên Cloudflare, cần xem xanh trước khi merge.
  - Đã review đạt và merge `--ff-only` vào `main` ở đầu S0.4 (`main` = `0acea3d`).
- S0.4 Worker + CI + e2e (nhánh `s0.4-worker` từ `main`, đã push, chờ review)
  - Worker, `src/workers/`: `simService.ts` (lớp mà worker expose qua Comlink, test được trong Node), `sim.worker.ts` (chỉ nối dây), `simClient.ts` (phía trang), `spawn.ts` (nơi duy nhất tạo `Worker`). Không có đường dự phòng trên luồng chính (CLAUDE.md: tính nặng luôn trong worker). Worker không tải được hoặc chết thì client `abort`, UI hiện thông báo lỗi và mọi `run` sau đó từ chối ngay, chứ không chờ mãi.
  - Yêu cầu mới thay yêu cầu cũ ở hai nơi. Trong worker: hộp thư một ô, và worker nhường một lượt event loop trước khi tính, nên các tin nhắn đã xếp hàng được đọc trước và chỉ cái mới nhất được tính (kéo thanh trượt không tạo hàng đợi). Ở trang: client đánh số yêu cầu và trả `null` cho kết quả của yêu cầu đã bị thay, kể cả yêu cầu đang chạy dở (một lần tính không ngắt được).
  - `field.arrival` gửi bằng `Comlink.transfer` (312 KB, chuyển chứ không sao chép; bên worker buffer bị detach, có test), luôn nằm trong một đối tượng `{ arrival, maxTimeMin }`. Client kiểm `maxTimeMin` và `arrival.length = w×h` trước khi giao cho UI. Nếu `arrival` là view vào một buffer lớn hơn thì sao chép trước, để không detach cả buffer (có test). Lỗi gửi qua Comlink mất `instanceof RangeError`, chỉ còn `name`.
  - UI: `recipeStore` (+ `useRecipeResult` qua `useSyncExternalStore`) giữ kết quả cuối cùng **cùng công thức của nó**, nên tiêu đề Viewer luôn mô tả đúng hình đang hiện. `Viewer` nhận `pending` (`aria-busy`; chữ "Đang tính lại…" chỉ hiện sau 300 ms để một lần tính vài chục ms không nhấp nháy) và `failed`; `ViewerPlaceholder` là khung trước kết quả đầu. Worker được tạo khi có người subscribe đầu và dispose khi người cuối rời, nên StrictMode không để worker mồ côi (có test). `App` tách `Lab` (khóa học) và `BenchPanel`.
  - Làm ấm: `warmUpRecipes()` = A,B,C ×3 (`WARMUP_RUNS_PER_CASE`), mỗi lượt event loop một lần chạy, mỗi ranh giới ưu tiên yêu cầu thật; kết quả bỏ, không gửi gì lên trang, lỗi trong làm ấm không dừng hàng đợi. **Chỉ bắt đầu sau khi yêu cầu thật đầu tiên đã được trả lời** (hoặc khi bench cần). Bản đầu cho chạy ngay và đo được lần gọi đầu 54,5 ms thay vì 31,9 ms: tin nhắn đầu của trang chưa được giao ở lượt đầu của worker, nên worker chạy một ca làm ấm lạnh (≈ 28 ms) trước nó. Test cũ không thấy vì đặt yêu cầu vào hộp thư trước `startWarmUp()`; test mới để worker có vài lượt rảnh trước khi yêu cầu đến, và đỏ trên mã cũ. Giới hạn còn lại của "không chặn": yêu cầu đến giữa một lần chạy phải chờ hết lần đó.
  - `/?bench=1` (`BenchPanel`, `benchStore`): worker chờ làm ấm xong rồi chạy mỗi ca A/B/C `BENCH_RUNS_PER_CASE` = 30 lần bằng đúng `compute` của yêu cầu thật, chỉ gửi các con số về. Hiện hai bảng (`runRecipe`, riêng `arrivalTime`) với số lần / trung vị / p95 (hạng gần nhất) / lớn nhất, kèm trình duyệt, số luồng CPU, `devicePixelRatio` và nút "Chạy lại" (cùng worker). Đo phép tính trong worker, chưa gồm thời gian chuyển kết quả. Số cold của trang vẫn lấy ở `/?debug=1`.
  - Test: `tests/sim/helpers.ts` giờ bọc thẳng `runRecipe` (hết bản glue thứ hai), kèm `unboundedArrival` cho các phép so với prototype (dấu vân tay toàn trường arrival là của tìm kiếm không giới hạn). `src/sim/cases.ts`: `M04_CASES` (A, B, C của `m04-etch.md`, B là `DEFAULT_RECIPE`) dùng chung cho làm ấm, bench và `etch.bench.ts`. Cặp BOE 10:1 `[233, 417]` nm đổi thành `[233, 395]` (417 nm = 8,34 phút, vượt thanh trượt BOE 8 phút nên `runRecipe` từ chối); dung sai không đổi. Test "so với glue của test" trong `recipe.test.ts` bỏ vì không còn hai bản để so.
  - ESLint: `src/workers/**` cấm import `ui`, `render`, `modules`, `content` (đã thử chèn import sai). Kiểm đột biến (worker, client, làm ấm, bench, thống kê, workflow, và làm hỏng worker cho e2e): 24 lỗi cố ý, 23 bị bắt, 1 tương đương (dòng `generation++` thừa, đã bỏ).
  - e2e: `e2e/smoke.spec.ts` mở bản build production (`vite preview`) và kiểm canvas, `aria-label` có "thủng", đúng 1 Worker đang chạy, không có `pageerror` hay `console.error`. Cố ý làm hỏng worker thì test đỏ. `npm run e2e` build trước (không bao giờ test `dist/` cũ); `playwright.config.ts` không dùng lại server đang chạy và không retry. Chromium của Playwright ở cả máy và CI.
  - GitHub Actions `.github/workflows/ci.yml`: mỗi push chạy `npm ci`, lint, test, build, cài Chromium, `playwright test`. Quyền `contents: read`, không secret, không deploy, hủy lần chạy cũ, giữ report khi đỏ. `tests/deploy/ci.test.ts` khóa các điểm này (thêm bước wrangler, secret hay quyền write đều bị bắt). Đã chạy xanh trên GitHub cho `79daf98` (lint, test, build, e2e). Phiên bản action: `checkout`, `setup-node`, `upload-artifact` đều `v7` (tag chính mới nhất lúc làm); chưa ghim theo SHA.
  - Không có hằng số vật lý mới, không dòng mới ở "Values to verify". `WARMUP_RUNS_PER_CASE` = 3 và `BENCH_RUNS_PER_CASE` = 30 là cấu hình công cụ (`src/sim/defaults.ts`, không mức), như kích thước lưới.
  - Kiểm tra: `npm test` (558 test), `npm run build`, `npm run lint`, `npm run e2e` xanh. JS (gzip -9): chunk chính 54,8 KB + chunk worker 6,9 KB = 61,7 KB (ngân sách 300 KB).
  - **Giả thuyết GC không được xác nhận, nên không thêm `scratch`.** Nguyên nhân thật (cấp phát tạm trong vòng `for (const [dx, dy] of STENCIL)`) đã sửa theo quyết định review: `arrivalTime` đọc 16 bước theo chỉ số từ hai `Int8Array` (`08678c7`, kết quả không đổi). Số đo, thực nghiệm và số trước/sau ở "Worker, làm ấm và GC" bên dưới.
  - Sau review S0.4: harness đo vào `scripts/perf/` (README ngắn: cách chạy, cách đọc trace; `tsc -b` và ESLint kiểm tra, không vào `npm run build`, đầu ra ở `scripts/perf/out/` bị git bỏ qua); thông báo lỗi worker là "Không tính được mặt cắt. Tải lại trang để thử lại." (trước đó là "...Hãy tải lại trang để thử lại.", cả hai chỗ hiện nó đều dùng chung một thành phần).
- S0.5 `arrivalTime` trên điện thoại (**đóng 2026-10-10**; nhánh `s0.5-arrival-perf` từ `main` = `4bb8fa2`, mỗi bước một lần duyệt rồi `merge --ff-only`; bước 2 đã hủy, xem cuối mục)
  - Số đo thật do người dùng đo, Samsung S20 FE (Snapdragon 865), Chrome 154, worker đã làm ấm, 30 mẫu × 2 lần đo, đang sạc: `runRecipe` trung vị A/B/C ≈ 69 / 80 / 67 ms, p95 ≈ 73 / 85 / 71 ms, `arrivalTime` ≈ 95% của tổng. Cùng mã ở worker desktop ≈ 4 ms (chênh ~18×). Lúc đó trên ngưỡng 50 ms (ô M04 "warm < 50 ms trên điện thoại" chưa tick; xem kết luận ở cuối mục này, sau khi đo thêm trên cùng máy).
  - **Bước 0, chẩn đoán: `/?bench=1&thread=main`.** Cùng bộ bench, thêm một lượt đo cùng `SimService` ngay trên luồng chính của trang, để kiểm giả thuyết "worker bị xếp lên lõi nhỏ" (JS không đọc được lõi nào đang chạy, nên so hai luồng trên cùng máy là cách kiểm trực tiếp). Chỉ ở trang đo: `isBenchMainThreadRequested` đòi `bench=1`, nên trang học không bao giờ tính trên luồng chính (CLAUDE.md: tính nặng luôn trong worker).
    - Worker đo xong thì luồng chính mới đo (không song song, khỏi tranh CPU). Luồng chính được làm ấm đúng như worker (A, B, C × 3, `warmUpRecipes()`, chín lần) trước khi đo, vì JIT làm ấm riêng theo từng luồng; chỉ làm ấm một lần mỗi trang, "Chạy lại" không làm ấm lại. `src/ui/benchMainThread.ts` nạp bằng `import()`, `benchStore` giữ kết quả đo của hai luồng.
    - Bảng cột ghép: mỗi ô là Worker | Luồng chính cho trung vị, p95, lớn nhất (số trần, đơn vị ms ở tiêu đề, ca chỉ ghi A/B/C và mô tả ca nằm trên bảng) để vừa 380 px không cuộn ngang; thêm bảng tỉ số trung vị luồng chính ÷ worker cho từng ca (dưới 1× là luồng chính nhanh hơn; gạch ngang khi trung vị worker bằng 0). Không có `thread=main` thì trang y như cũ.
    - e2e `e2e/bench.spec.ts` (viewport 380 px, bản build production, worker và luồng chính thật): cả `?bench=1&thread=main` lẫn `?bench=1` không cuộn ngang (`scrollWidth ≤ clientWidth`, và mép phải của mọi bảng ≤ 380), số trong ô đúng định dạng, đúng 1 Worker, không `pageerror`/`console.error`.
    - Kiểm đột biến: bỏ `startWarmUp()` của luồng chính thì 3 test đỏ (bench treo vì hàng đợi làm ấm không bao giờ xong).
    - Chrome desktop (Windows, Chrome 156, headless, một lần mở trang): luồng chính / worker ≈ 1,02–1,09× ở cả ba ca (trung vị `runRecipe` worker 3,0 / 3,4 / 3,0 ms), luồng chính có vài mẫu lớn nhất cao hơn (đến 15,5 ms ở ca B). Một phiên, không có khoảng tin cậy; chỉ để biết trang chạy được, không phải kết luận.
    - **Số trên S20 FE, cùng máy** (người dùng đo, ghi là "bước 0"; chưa ghi số điện thoại riêng cho bước 1), trung vị / p95 / lớn nhất của `runRecipe` cho ca A / B / C:
      - AdGuard (Chromium, UA giống Chrome), worker: trung vị **6,6 / 7,7 / 6,5 ms**, p95 7,4 / 8,1 / 9,6 ms, lớn nhất ≤ 12,8 ms.
      - Chrome 154: trung vị **44,7 / 80,0 / 65,8 ms** (p95 và lớn nhất không ghi lại).
      - Tỉ số trung vị luồng chính ÷ worker ≈ 1,0 ở cả hai trình duyệt, nên **giả thuyết "worker bị xếp lên lõi nhỏ" sai**: luồng chính chậm đúng như worker trên cùng trình duyệt. Cái khác nhau là trình duyệt: cùng điện thoại, Chrome chậm hơn AdGuard khoảng 7–10 lần (A 6,8×, B 10,4×, C 10,1×).
    - **Lệch so với kế hoạch: gói JS chính không còn đứng yên.** Chunk chính (bản build production) 166,25 → 175,05 kB (gzip 55,69 → 58,38 kB). 3,07 kB (gzip 0,64) là mã bảng mới. 5,73 kB (gzip 2,05) là `arrivalTime`, `rieRates`, `wetEtchRates` và hằng số bị kéo vào chunk chính: `render/canvas2d/pixels.ts` đã import `Material` từ `physics/etch.ts`, nên module đó thuộc chunk chính, và `import()` của `benchMainThread` (qua `runRecipe`) làm các hàm còn lại của nó không còn bị bỏ khi tối giản. Kiểm bằng bản build tạm không có `import()` (chunk chính 169,32 kB, không có `arrivalTime`). Chunk `benchMainThread` 6,30 kB (gzip 2,73) chỉ nạp ở `thread=main`. Vẫn xa ngân sách 300 KB gzip; chưa sửa vì cách gọn nhất (tách `Material` ra module riêng, ba file import đổi theo) đụng vào `physics/` và `render/`, ngoài phạm vi bước này. Đã sửa ở đầu bước 1, ngay dưới.
  - **Bước 1, commit 1: `Material` sang `src/physics/materials.ts`** (theo quyết định của người dùng; commit riêng, không đổi hành vi). `src/sim/grid.ts`, `src/render/canvas2d/pixels.ts` và các test import thẳng từ `materials.ts`; `etch.ts` không re-export. Số đo bản build production, trước/sau:

    | | Chunk chính | gzip | Chunk `benchMainThread` | gzip |
    |---|---|---|---|---|
    | Trước S0.5 (`4bb8fa2`) | 166,25 kB | 55,69 kB | không có | |
    | Sau bước 0 (`de280c4`) | 175,05 kB | 58,38 kB | 6,30 kB | 2,73 kB |
    | Sau `materials.ts` | **168,32 kB** | **55,96 kB** | 13,10 kB | 5,09 kB |

    Chunk chính hơn mức trước S0.5 2,07 kB (gzip 0,27 kB), tức phần mã bảng cột ghép; `etch.ts` (`arrivalTime`, `rieRates`, hằng số) nay nằm trong chunk `benchMainThread`, chỉ nạp ở `thread=main`. Chunk worker không đổi (17,61 kB, cùng tên băm). Ước lượng lúc quyết định là ≈ 56,3 kB gzip; thực tế 55,96.
  - Chống tái phạm: `e2e/bundle.spec.ts` mở `/` ở bản build production, lấy mọi tệp `.js` mà trang tải (trừ worker) và đòi chúng không chứa hai thông báo lỗi nằm trong `etch.ts` (`unknown material code`, `heap capacity exceeded`; sống sót qua tối giản); script của worker phải chứa cả hai, nếu không test sẽ đúng trên một bundle nó không nhìn được. Kiểm đột biến: cho `pixels.ts` import `Material` từ `etch.ts` lại (và `etch.ts` re-export) thì chunk chính về 175,21 kB và test đỏ ("index-….js carries “unknown material code”").
  - **Bước 1, commit 2: bảng chi phí tính sẵn** (`stepCostTable(rates, cellNm)` trong `src/physics/etch.ts`). Bảng `Float64Array(4 × 16)`, chỉ số `material * 16 + step`, dựng một lần mỗi lần gọi bằng đúng biểu thức cũ; vòng nóng chỉ tra một ô, không còn `sqrt`, chia hay nhánh về tốc độ. `Infinity` = bước không đi được, quyết **theo từng bước** khi dựng bảng, đúng các điều kiện cũ: không khí; vật liệu không bị khắc; bước có phần dọc mà tốc độ dọc (hoặc ngang, với bước đi lên) bằng 0; bước có phần ngang mà tốc độ ngang bằng 0. Nên tốc độ ngang 0 vẫn cho bước thẳng xuống đi (không gộp thành "tốc độ 0 ⇒ Infinity"). Bảng có NaN thì ném `RangeError`. Khác kế hoạch chút: chỉ số thứ ba `[up|down]` bỏ vì hướng đã nằm trong `step`.
    - Test: `tests/physics/stepCostTable.test.ts` (bố cục, từng ô khớp công thức cũ **từng bit** trên 10 bộ tốc độ, chặn không khí và vật liệu không bị khắc, riêng cho tốc độ ngang 0, tốc độ dọc 0, đối xứng trái-phải, tỉ lệ theo ô lưới và tốc độ, không NaN trên mọi tốc độ app tạo ra, ném khi có NaN). `tests/physics/arrivalTime.parity.test.ts` so với bản đông cứng của `arrivalTime` ở `4bb8fa2` (`tests/physics/legacy/arrivalTimeV1.ts`, sinh bằng script từ `git show` rồi `diff` từng dòng, chỉ đổi tên hàm và đường dẫn import): **bằng nhau từng bit** (`Object.is`), không dùng dung sai, trên ca A/B/C (lưới thật 260×150, có giới hạn của app, không giới hạn, và `timeMin`) và 3 × 11 × 8 lưới ngẫu nhiên có seed (đối xứng, lệch đúng một ô, không liên quan; rộng 1 đến 60, chẵn và lẻ; 7 bộ tốc độ gồm tốc độ ngang 0 và vật liệu không bị khắc; giới hạn giữa trường, 0 và 1e-9). Tổng 275 test (273 phép so, và 2 test cho chính hàm so: thấy được lệch một bit, coi `Infinity` bằng `Infinity`); `npm test` 912 test.
    - Kiểm đột biến (10 lỗi cố ý, kết quả đếm test đỏ): chọn tốc độ dọc bằng `dy < 0` (213), đổi selectivity resist và Si (134), "tốc độ 0 của một trong hai chiều chặn mọi bước" (54), tốc độ ngang 0 chặn cả bước không có phần ngang (54), không khí thành oxit (13), bỏ kiểm NaN (5), chỉ số bảng đảo bước/vật liệu (243), kiểm mã vật liệu lệch một (1), `Math.hypot` thay căn của tổng bình phương, chỉ khác ở bit cuối (87). Lỗi thứ mười, bỏ dòng `if (cost === Infinity) continue`, **không đổi được kết quả** (`time + Infinity` không bao giờ nhỏ hơn giá trị đang có), đó là một dòng thoát sớm, giữ lại cho rõ.
    - Số đo, desktop, bảng "arrivalTime: bảng chi phí" ở mục Hiệu năng bên dưới. Tóm tắt: ở worker 1× trung vị `runRecipe` A/B/C giảm 3,1 / 3,4 / 3,0 → 2,6 / 2,8 / 2,5 ms (−16 đến −18%); `arrivalTime` 3,0 / 3,3 / 2,9 → 2,5 / 2,7 / 2,4 ms. Ít hơn mức mong đợi khi viết kế hoạch: `sqrt` và phép chia không phải phần chính của vòng nóng; phần còn lại là đống (heap) và truy cập bộ nhớ, thứ mà bước 2 (gập gương) giảm một nửa. Nếu tỉ lệ −17% giữ trên S20 FE (67–80 ms hiện nay) thì còn ≈ 56–66 ms: đây là ngoại suy, chưa đo, và vẫn trên 50 ms.
  - Việc đo trước/sau chạy bằng subagent Haiku trên harness `scripts/perf` (checkout từng commit, dựng trang đo, chạy, lưu JSON); số trong PROGRESS là số tôi tự tóm tắt lại từ JSON thô bằng `summarize.mjs`, trùng báo cáo của subagent. Một sai lệch quy trình: ở lượt đầu, lệnh `summarize` của vòng 1 (đọc JSON đã xong) chạy cùng lúc với lệnh đo luồng chính, nên bản gốc đo lại ở cuối (vòng 4) để so; hai lần lệch ≤ 0,1 ms.
  - **Bước 2 (gập gương) hủy.** Quyết định của người dùng 2026-10-10: không còn vấn đề hiệu năng cần giải, và thêm phức tạp vào lõi vật lý không đáng. Không có mã nào của bước 2 trong repo; các yêu cầu đã duyệt cho nó (kiểm đối xứng thật trên `materials`, phản xạ bước đích, lật nửa còn lại, test độ rộng chẵn và lẻ) không thực hiện. Các lưới đối xứng và lệch một ô đã có trong `tests/physics/arrivalTime.parity.test.ts` giữ nguyên làm lưới an toàn cho những thay đổi sau của `arrivalTime`.
  - **Kết luận:** phần cứng và mã đạt. Trên S20 FE với trình duyệt Chromium có JIT, `runRecipe` trung vị 6,5–7,7 ms, p95 ≤ 9,6 ms, lớn nhất ≤ 12,8 ms, thấp xa ngưỡng 50 ms. Chrome trên máy thử chậm khoảng 10×, khớp với việc JIT bị tắt, nhưng **chưa xác định cài đặt hay chính sách cụ thể** (đã thử chỉnh "Trình tối ưu hóa JS" và "Bảo vệ nâng cao" của Chrome, không đổi).
  - **Giới hạn đã biết:** ở trình duyệt tắt JIT `runRecipe` mất ≈ 45–90 ms (Chrome của máy thử: A 44,7, B 80,0, C 65,8 ms). Phép tính vẫn nằm trong worker nên UI không đứng, người học chỉ chờ lâu hơn để thấy hình mới.
  - **Bước 1 (bảng chi phí):** −17% ở desktop (worker 1×, trung vị `runRecipe` A/B/C −16, −18, −17%), kết quả trùng từng bit với bản `4bb8fa2`; chi tiết ở trên và ở "arrivalTime: bảng chi phí" trong mục Hiệu năng.
  - **Ô M04 "warm < 50 ms trên điện thoại tầm trung" đã tick** (`docs/modules/m04-etch.md`) theo quyết định của người dùng, kèm ghi chú: "S20 FE, trình duyệt Chromium có JIT; Chrome trên máy thử là ngoại lệ chưa rõ nguyên nhân". Lưu ý cho người đọc sau: ở chính Chrome đó, ca B (80,0 ms) và C (65,8 ms) vượt 50 ms.
  - Không có hằng số vật lý mới, không dòng mới ở "Values to verify".

- S1.1 M03 quang khắc (nhánh `s1.1-m03-litho` từ `main` = `459c707`; mỗi bước một lần duyệt rồi `merge --ff-only`; kế hoạch và 9 quyết định đã duyệt 2026-10-21)
  - **Bước 1, physics, chưa có UI, chưa đụng M04.** Giữ nguyên `printLitho`, `etch.ts`, `sim/`, worker và `ui/`; 912 test cũ không sửa. File mới: `physics/special.ts` (`erf`, `erfc`, `erfinv`: chuỗi toàn số hạng dương dưới 2,5, phân số liên tục 40 số hạng từ đó; sai số ~1e-15), `aerial.ts` (σ theo lệch tiêu cự, DOF, ảnh khe đơn, vị trí mép), `exposure.ts` (`exposeResist`, `modelCdMinNm`, `bakeEquivalentMin`), `processWindow.ts`, `overlay.ts`. Hằng số mới nằm trong nhóm sẵn có (`litho.k2`, `litho.exposure|bake|develop|overlay`, `geometry.waferRadiusMm`) nên `constants.test.ts` không đổi; tất cả mức C, đã vào "Values to verify".
  - **Mô hình** (một chiều, ngưỡng cứng, không phải TCAD): khe sáng bề rộng w bị nhòe Gauss, σ = σ₀·√(1 + (2Δz/DOF)²), σ₀ = 0,445·λ/NA, DOF = k₂·λ/NA² (k₂ = 0,5). Quy ước này *định nghĩa* DOF ở đây: tại ±DOF/2 độ nhòe tăng đúng √2 lần; σ phụ thuộc Δz² nên mô hình đối xứng quanh tiêu điểm tốt nhất. Ánh sáng bị hấp thụ theo độ sâu, E(x,d) = D·I(x)·e^(−α·d), α = 6,4·10⁻⁴ nm⁻¹; D = liều × ảnh hưởng của nung mềm. Resist dương tan ở E ≥ E_th; resist âm ở lại ở E ≥ E_th (mask đảo cực tự động, cửa sổ là vạch tối: I → 1 − I). E_th không phải tham số tự do: liều ×1 in đúng bề rộng thiết kế **ở chân** của lớp resist dày 500 nm với cửa sổ rộng hơn độ nhòe nhiều (E_th = 0,5·e^(−α·500 nm)). Từ đó: resist dương mở tới độ sâu d* = ln(D·I₀/E_th)/α, thiếu thì còn cặn ở chân và thành loe ở đỉnh; resist âm có màng liên kết ở đỉnh (bắc cầu) và thành lẹm ở chân. Thành xấp xỉ bằng đường thẳng qua hai đầu của phần đã mở. Nung mềm: giờ tương đương ở 90 °C (cứ +10 °C thì gấp đôi), dưới 0,5 phút → dính mask (Hỏng), trên 3 phút → độ nhạy giảm. Tráng: dưới 1 phút còn cặn, trên 1,5 phút resist mỏng đi và cửa sổ nở. Toàn bộ nêu ở đầu `exposure.ts`, kể cả giới hạn.
  - **Hiệu chỉnh** (`blurAtBestFocus` và `absorptionPerNm` được chọn từ hai ngưỡng của prototype): ở liều ×1, tiêu điểm tốt nhất, resist 500 nm, bề rộng thiết kế tính theo k₁·λ/NA: cửa sổ bắt đầu mở ở **0,700** (prototype 0,7) và sạch (cặn ≤ 1% độ dày) từ **0,997** (prototype 1,0); test kiểm ±0,03 ở cả bốn nguồn (mô hình chỉ phụ thuộc tỉ số design/(λ/NA) nên cả bốn nguồn giống hệt nhau).
  - **Ngưỡng phụ thuộc liều** (yêu cầu bắt buộc của bước 1): mở từ 0,895 / 0,785 / 0,700 / 0,632 / 0,577 ở liều ×0,8 / ×0,9 / ×1 / ×1,1 / ×1,2. Test "dưới ngưỡng thì không mở" cố định dải liều ×0,8 … ×1,2: 0,55·CD_min không mở ở mọi liều trong dải, 0,95·CD_min mở ở mọi liều trong dải. Mô hình khe đơn **không có giới hạn phân giải cứng**: 0,3·CD_min không mở ở ×1 nhưng mở ở ×3 (có test). Copy phải nói rõ điều này; giới hạn thật đến từ nhiễu xạ của dãy vạch theo pitch, nằm ngoài mô hình.
  - **CD_min của mô hình** (nhỏ nhất in sạch ở liều ×1, tiêu điểm tốt nhất) so với k₁·λ/NA, độ lệch giống nhau ở cả bốn nguồn: **−0,32%** ở 3000 rpm (500 nm); +8,39% ở 2000 rpm (612 nm), +16,62% ở 1500 rpm (707 nm); −5,10% ở 4000 rpm (433 nm), −10,36% ở 6000 rpm (354 nm). Lệch theo độ dày vì E_th cố định ở độ dày chuẩn; test kiểm dưới 0,5% ở độ dày chuẩn, đúng chiều ở độ dày khác, và CD_min đúng là mép của "sạch" (±0,1%). Với resist âm, ở 3000 rpm CD_min lớn hơn k₁·λ/NA tới +34,59%.
  - **Gần `printLitho`** (liều ×1, tiêu điểm tốt nhất, 3000 rpm, bề rộng ở chân; test có dung sai ghi rõ, bằng số đo làm tròn lên): mô hình mới nhỏ hơn −15,1% ở 1,3·CD_min, −6,2% ở 1,5, −1,7% ở 1,8, −0,7% ở 2,0, dưới 0,1% từ 2,5 trở lên. Cửa sổ 800 nm i-line mặc định: chân 797,9 nm, đỉnh 988,9 nm, loe 95,5 nm mỗi bên, góc thành 79,2° (prototype: 90°), σ = 270,7 nm, DOF = 506,9 nm, CD_min = 363,8 nm. Resist âm cùng điều kiện: chân 797,9, đỉnh 603,5, lẹm −97,2 nm mỗi bên, góc 101,0°.
  - **Cửa sổ quy trình** (800 nm, i-line, liều ×0,7 … ×1,3, ±600 nm, 25×25): 142 / 625 mẫu đạt, hình nghiêng về phía liều cao khi |Δz| tăng ở cả hai phía (liều cao bù độ nhòe, như đường cong Bossung thật); ở tiêu điểm tốt nhất đạt trong ≈ ×0,90 … ×1,13. Cửa sổ co lại khi bề rộng thiết kế nhỏ đi (207 / 142 / 71 mẫu ở 3,0 / 2,19 / 1,5·CD_min) và hết hẳn ở 0,8·CD_min trong dải này. Cùng một hình ở bốn nguồn khi tiêu cự đo bằng đơn vị DOF; tính bằng nm thì nông dần g > i > KrF > ArF.
  - **Overlay** (`overlay.ts`): sai lệch tại (x, y) = (dx − θ·y, dy + θ·x), θ tính bằng µrad, vị trí bằng mm nên 1 µrad × 1 mm = 1 nm, không cần hệ số đổi. Chỉ số là lớn nhất trên 5 điểm (tâm và 4 điểm ở rìa, bán kính wafer 150 mm mức C); công thức "dx + r·θ" của spec là cận trên của nó. Dung sai = 0,3·CD (mức C); Đạt đến dung sai, Biên đến 1,5 lần, Hỏng khi lớn hơn. `contactLanding`: vùng đích = cửa sổ cộng dung sai mỗi bên, nên cửa sổ rơi trọn đúng khi |lệch| ≤ dung sai (test kiểm đúng điều này).
  - **Điều quan sát khi hiệu chỉnh, cần bạn duyệt vật lý:**
    1. Hai ngưỡng 0,7 / 1,0 của prototype buộc σ₀ ≈ 2× độ rộng của Gauss khớp đĩa Airy giới hạn nhiễu xạ (≈ 0,2·λ/NA, chưa đối chiếu sách) và αT ≈ 0,32; hệ quả là thành loe 79° ở cửa sổ rộng, không thẳng như prototype. Đây là giá của việc bám prototype.
    2. `printedNm` là bề rộng **ở chân**, nên khi cặn do liều/quang học làm cửa sổ khép lại thành hình chữ V thì `printedNm = 0` dù `open = true`; `cdTopNm` cho biết chỗ đã mở. Prototype giữ `printedNm > 0` kèm cặn. Cần quyết định ở bước 2 khi đưa vào `buildGrid` (cặn nằm ở các hàng dưới, cửa sổ hàng trên được loe từ `taperNm`).
    3. Ngưỡng liều khác prototype: cửa sổ 800 nm sạch từ liều ≈ ×0,58 (prototype: thiếu liều dưới ×0,85) và vượt dung sai kích thước ±10% khi liều ≈ ×1,14 (prototype: quá liều trên ×1,35). Chỉ ngưỡng 0,7/1,0 tại ×1 được yêu cầu tái hiện.
    4. Resist âm cần cửa sổ lớn hơn dương 34,6% trong mô hình này. Lý do là phép chuẩn hóa liều ×1 ở chân cho cả hai: dương chỉ bị cặn ở chân, âm bị màng ở đỉnh (chỗ nhận nhiều ánh sáng nhất). Copy không được viết "resist âm luôn phân giải kém hơn".
    5. Mô hình dùng một σ cho cả độ dày resist (không đổi lấy nét theo độ sâu) và không có sóng đứng; phản ứng của resist là bậc thang ở E_th.
    6. Spec nói k₁, k₂ chỉnh được ở chế độ nâng cao. Trong mô hình mới k₂ chỉnh được (là DOF), nhưng k₁ không còn là tham số tự do: nó chỉ dùng cho `printLitho` và cho việc hiệu chỉnh σ₀, α. Cần quyết định trước bước 3b.
  - **Duyệt vật lý bước 1 (người dùng, 2026-10-21), trả lời 6 quan sát:**
    1. Thành loe 79°: chấp nhận. α đối chiếu AZ MiR 701 và σ₀ ≈ 2× Gauss khớp Airy đã vào "Values to verify". Copy gọi σ là "độ nhòe hiệu dụng", không gọi là PSF quang học.
    2. `printedNm = 0` khi cặn khép chân: đồng ý. Bước 2 tách `open` thành hai khái niệm (mở ở đỉnh / sạch tới đáy); `buildGrid` vẽ cặn bằng RESIST ở hàng dưới để M04 tự bị chặn, không thêm luật riêng; phán quyết Hỏng có câu "vì sao" nêu cặn.
    3. k₁ bỏ khỏi tham số chỉnh được; chỉ hiện chỉ đọc "k₁ hiệu dụng = CD_min(mô hình)·NA/λ", đổi theo độ dày resist. Spec M03 đã sửa (`0c74f1d`).
    4. Resist âm +34,6%: ổn. Copy ghi "trong mô hình này, do cách chuẩn hóa liều".
    5. Ngưỡng liều ×0,58 / ×1,14: chấp nhận (mức C).
    6. Một σ cho cả độ dày, không sóng đứng, ngưỡng bậc thang: ghi vào khối "giới hạn mô hình" của copy (xem "Quy tắc cho copy" trong `docs/modules/m03-lithography.md`).
  - **Kiểm tra:** 227 test mới (`special` 25, `aerial` 47, `exposure` 86, `processWindow` 27, `overlay` 42), `npm test` 1139 test (912 cũ không sửa). `npm run build`, `npm run lint` xanh; chunk chính 168,34 kB (gzip 55,99 kB), gần như không đổi (physics mới chưa được trang nào import). Kiểm đột biến: 39 lỗi cố ý (đổi dấu, bỏ hệ số hấp thụ, quy lỗi do liều đảo ngược, bỏ kẹp, đảo chiều quy ước DOF, bỏ phần dư…), 38 bị bắt, 1 tương đương (một `Math.min(1, …)` thừa, đã bỏ). 4 lỗi sống sót ở vòng đầu chỉ ra chỗ test lỏng (biên ±0,5% quanh CD_min, độ dày còn lại sau tráng quá, cặn kèm kích thước đúng), đã thêm test rồi bắt hết.
  - **Hiệu năng** (Node, Ryzen 5 PRO 4650G, chưa đo trên điện thoại): `exposeResist` ≈ 0,008 ms; `processWindow` 25×25 ≈ 4,1 ms, 41×41 ≈ 12,3 ms.
  - **Bước 2, sim và worker, chưa có UI** (nhánh `s1.1-m03-litho`; theo 6 trả lời duyệt vật lý bước 1 và 9 quyết định). Giữ nguyên `printLitho`, `recipe.ts`, `etch.ts`, `simClient.ts`; mọi test M04, worker và UI có từ trước không sửa.
    - **`open` tách làm hai** (`443c019`): `openAtTop` (mở ở đỉnh) và `cleanToFoot` (sạch tới đáy, kéo theo `openAtTop`). Cửa sổ mở ở đỉnh mà chưa sạch tới đáy có `printedNm = 0`. **Một thay đổi hành vi so với bước 1:** `status` giờ là Hỏng khi không mở ở đỉnh, nên cửa sổ resist âm bị màng bắc cầu dày hơn dung sai (1% độ dày) là Hỏng chứ không còn là Biên; cặn ở chân vẫn là Biên khi đỉnh còn mở. Cửa sổ quy trình chỉ tính ô `cleanToFoot`.
    - **`buildGrid` vẽ màng bắc cầu** (`46de080`): thêm `skinNm` tùy chọn (`GridLitho`), vẽ bằng ô RESIST ở các hàng trên cùng của cửa sổ, cạnh cặn vẫn vẽ bằng RESIST ở hàng dưới. Không có skin (hoặc dưới nửa ô) thì lưới trùng bản cũ. M04 bị chặn qua luật vật liệu thường, không có luật riêng cho cặn hay màng.
    - **`sim/m03.ts`** (`1d10392`): phiên làm việc thuần dữ liệu (`M03Session`: 7 bước 3.1–3.7, seed, công thức, sai lệch mask ẩn sinh từ seed, hiệu chỉnh `applied` đang trên wafer và `plan` đang quay số cho lần phơi sáng sau, số lần rework, `committed`). Hình theo bước như prototype (bước → giai đoạn: oxit trần / phủ / ảnh ẩn / đã tráng). `rework` (từ bước 3.2 trở đi, trước khi khắc) tẩy resist về oxit trần và bước 3.1, hiệu chỉnh `plan` thành `applied`; `commit` chỉ ở bước cuối và đóng băng phiên (mọi thay đổi sau đó bị từ chối). `readOverlay`: đọc vernier ở 5 điểm, điểm tệ nhất, dung sai theo CD, vùng đích. `deriveView`, `judge`, `m03Output`, `runM03Request`, `processWindowSpecFor`.
    - **Phán quyết** Đạt / Biên / Hỏng, chưa có điểm số. Các nguyên nhân (`Cause`: mã, mức, và số nm kèm theo: cặn còn lại, overlay tệ nhất) xếp Hỏng trước, nguyên nhân gốc trước hệ quả của nó. Cửa sổ không mở thì có nguyên nhân gốc (`below-resolution`, `underdose`…) rồi `scum` mức Hỏng với `valueNm` = độ dày cặn. Overlay chỉ tính vào phán quyết từ bước cuối. **Lệch nhỏ so với đề bài:** câu tiếng Việt "vì sao" chưa viết ở bước này; sim trả mã và số, câu nằm ở MDX (`src/content/vi/m03/`, bước 3b) vì CLAUDE.md đặt copy học viên ở MDX. Test kiểm Hỏng luôn có nguyên nhân mức Hỏng và nhắc cặn kèm số nm.
    - **Overlay:** sai lệch ẩn sinh từ seed (dx, dy, θ theo thứ tự, mỗi thành phần một lần bốc dấu và một lần bốc độ lớn trong 0,4–1,0 khoảng; `M03_SCENARIO` trong `defaults.ts` là độ khó của bài tập, không phải vật lý: ±150 nm, ±2 µrad). Có thể không cần rework với CD lớn. Đọc ở tâm không thấy xoay; hiệu chỉnh đúng bằng `−hidden` đưa lỗi về 0; chỉ hiệu chỉnh tịnh tiến thì xoay vẫn còn ở rìa (có test).
    - **Đưa vào M04:** `m03Output` (cần phiên đã `commit`) trả mặt cắt đã tráng. Hốc kín dưới màng bắc cầu bị lấp bằng resist ở bước chuyển giao (`sealCavities`, lan theo 4 láng giềng từ hàng trên cùng), vì `arrivalTime` bắt đầu khắc từ mọi ô không khí và sẽ khắc từ trong hốc dù etchant không vào được; không phải luật của M04. `sim/etchFrom.ts`: nửa sau của `runRecipe` cho một mặt cắt có sẵn; **trùng từng bit** với `runRecipe` ở ca A, B, C (test), `recipe.ts` không đổi. Kiểm: cửa sổ sạch khắc thủng tới Si (ướt và RIE); cặn ở chân chặn khắc ướt (`cleared` sai, lẹm Si 0); màng bắc cầu chặn khắc ướt.
    - **Worker tổng quát hóa theo loại yêu cầu** (`1a2add9`): `SimService` giữ một yêu cầu chờ cho mỗi loại (công thức M04, hình M03, cửa sổ quy trình M03) thay vì một cho tất cả. Yêu cầu mới thay yêu cầu chờ cùng loại (trả "superseded"), không bao giờ thay loại khác; tính lần lượt theo thứ tự đến, mỗi lượt một việc, vẫn nhường một lượt vòng lặp trước khi tính. `run`, `bench` và các tùy chọn giữ nguyên; thêm `runM03` và tùy chọn `computeM03`. Kết quả M03 được sao chép sang trang (nhỏ), không chuyển như `field.arrival` của M04. `m03Client.ts`: đánh số theo loại, bỏ kết quả cũ, kiểm kích thước. `spawn.ts`: `createM03WorkerClient` dùng chung phần khởi động worker với `createWorkerClient`; test bằng `Worker` giả chạy trong tiến trình, nối `SimService` thật qua `MessageChannel`. Một yêu cầu M03 cũng mở khóa làm ấm như yêu cầu thật.
    - **`?bench=1` đo cả biểu đồ cửa sổ quy trình 25×25** (`c24fcbb`, `e09e5bc`): `BenchReport.processWindow` (tùy chọn, nên báo cáo cũ vẫn đúng kiểu), 3 lần chạy làm ấm không tính rồi mỗi mẫu một lần; bảng riêng ở trang bench, cạnh luồng chính khi có `thread=main` (gạch ngang nếu luồng chính không gửi số). Vừa 380 px (e2e). **Chờ bạn đo trên S20 FE:** số trên máy này chỉ để tham khảo.
    - **Số đo** (Node, Ryzen 5 PRO 4650G, trung vị / p95 / lớn nhất, chưa đo trên điện thoại): `deriveView` 0,18 / 0,27 / 0,59 ms; ở bước overlay 0,16 / 0,27 / 3,0 ms; resist âm bị bắc cầu 0,14 / 0,21 / 0,50 ms; `m03Output` (có lấp hốc) 1,25 / 1,61 / 2,41 ms; yêu cầu `processWindow` 25×25 4,87 / 5,20 / 5,42 ms. Gói build (Vite): chunk chính 168,34 → 170,70 kB (gzip 55,99 → 56,39 kB; thêm bảng bench và vài hằng số), chunk worker 17,61 → 31,61 kB (gzip -9 ≈ 11,5 kB), chunk `benchMainThread` (chỉ nạp ở `thread=main`) 13,10 → 26,91 kB (gzip 5,09 → 9,80 kB). Tổng JS trang chính và worker gzip khoảng 68 kB, xa ngân sách 300 KB. `e2e/bundle-m03.spec.ts`: trang chính không chứa thông báo lỗi của `special.ts`, `exposure.ts`, `overlay.ts`, `sim/m03.ts`, worker thì có; đã kiểm test đỏ khi trang import `runM03Request`.
    - **Kiểm tra:** `npm test` 1283 test (1139 trước bước này, 144 test mới), `npm run build`, `npm run lint`, `tsc -b` và `npm run e2e` (7 test) xanh. Kiểm đột biến: 25 lỗi ở lớp sim (4 sống sót ở vòng đầu đã đóng bằng test: lấp hốc theo chiều ngang, ngưỡng cặn, overlay chỉ tính từ bước cuối, thứ tự khi hòa), 15 ở worker, 5 ở bảng bench, 5 ở `openAtTop`/`cleanToFoot`, 1 cho e2e gói; tất cả bị bắt. Một lỗi quy trình của tôi: lệnh `tsc -b | head; echo $?` đo mã thoát của `head`, nên một lỗi kiểu (`readonly` trong tham số constructor, cấm bởi `erasableSyntaxOnly`) lọt vào một commit; đã sửa và gộp vào commit đó trước khi push.

## Next
- **Giai đoạn 0 hoàn tất (2026-10-10).** S1.1 (M03 quang khắc) đang làm: bước 1 (physics) đã duyệt và merge; bước 2 (sim, worker, bench) xong và chờ bạn duyệt, xem mục S1.1 ở "Done". Các bước tiếp: 3a (UI kit, MDX/KaTeX, router `/m03`, StepNav động, e2e 380 px, đo gzip JS + CSS + font KaTeX trước/sau), 3b (bước 3.1–3.6, gồm câu tiếng Việt "vì sao" cho các mã nguyên nhân của `judge`), 4 (bước 3.7 overlay), 5 (đọc lại copy, e2e, số bundle, tick tiêu chí). Việc của bạn: mở `/?bench=1` (và `&thread=main`) trên S20 FE để có số điện thoại của biểu đồ cửa sổ quy trình.
- Mẫu lẻ không do GC vẫn còn sau khi sửa stencil (11,3 ms ở worker 1×, 26 ms ở 4× trên luồng chính, mỗi cái 1 lần trong 900 lần chạy, trace không thấy GC nào trùng). Chưa rõ nguyên nhân (nghi lịch của hệ điều hành hoặc nhiễu máy đo); chỉ cần quay lại nếu số đo điện thoại thật cho p95 hay lớn nhất gần 50 ms. (S20 FE với trình duyệt có JIT, S0.5: p95 ≤ 9,6 ms, lớn nhất ≤ 12,8 ms, nên chưa cần.)
- Cách đo: số cold của trang lấy ở `/?debug=1` (tải lại trang, ghi riêng). Chrome DevTools/CDP không làm chậm được worker (xem dưới), nên không có "4× cho worker" trên máy này; số điện thoại lấy ở `/?bench=1` (và `&thread=main`), đã chạy trên bản deploy workers.dev.
- Cloudflare Web Analytics (cookieless) chuyển sang Giai đoạn 4 (ra mắt), xem `docs/PLAN.md`; không bật trước đó.
- Chrome trên máy thử S20 FE chậm ≈ 10× so với trình duyệt Chromium có JIT (xem S0.5): chưa xác định cài đặt hay chính sách gây ra. Nếu có người học dùng cấu hình tương tự, họ chờ 45–90 ms mỗi lần đổi thông số; UI không đứng.
- Chưa biết trên điện thoại: thời gian chuyển kết quả từ worker về trang (post + nhận 312 KB `arrival` và hai mảng 39 KB). Ở desktop 1× vòng khứ hồi của một yêu cầu thật chỉ hơn thời gian tính 0,3–0,5 ms (bảng lần gọi 1–6 bên dưới), nhưng `?bench=1` chỉ đo phép tính trong worker.
- Còn lại của M04 (ngoài S0.2): KOH, Bosch, Endpoint (S1.3), UI và chấm điểm (S1.2).
- Khi port UI từ prototype: prototype tô chữ chỉ số bằng `--ok`/`--warn` (`.m.g b`, `.grade.g b`…); phải đổi sang `--ok-ink`/`--warn-ink`.
- Glyph: `≈` (U+2248) và `₂` (U+2082) không nằm trong subset nào của 3 font đã nạp (subset latin của JetBrains Mono chỉ có `↑ ↓ − ∕` trong dải ký hiệu), nên trình duyệt lấy chúng từ font hệ thống (Consolas/Menlo/ui-monospace). Đã thấy `≈` trên canvas và `₂` trong chú giải DOM hiển thị đúng, đọc được trong Chrome trên Windows; chưa kiểm trên Android/iOS/macOS. Khi bắt đầu có công thức/ký hiệu vật lý trong UI, kiểm tra thêm `λ`, `°`, `×`, `→` (thêm `greek` cho JetBrains Mono nếu cần).

## Values to verify
| Hằng số | Giá trị hiện tại | Mức | Cần đối chiếu ở |
|---|---|---|---|
| Tốc độ BOE 10:1 / 6:1 / HF 49% với SiO₂ nhiệt | 50 / 100 / 2000 nm/phút | C | Jaeger hoặc Plummer, chương khắc |
| Hệ số RIE (`etch.rie.*`, hình dạng mô hình): tốc độ = 20 + 0,25·P; dị hướng = 0,98 − p/250 − (150 − P)/600, kẹp [0,25; 0,97]; chọn lọc resist = max(1,4; 8 − P/45); chọn lọc Si = max(5; 15 − P/40) (P: W, p: mTorr) | như prototype | C | Không có số chuẩn chung; giữ mức C, ghi rõ là minh họa |
| Chọn lọc của khắc ướt với Si và resist (`etch.wet.*Selectivity`) | ∞ (lý tưởng hóa: không bị ăn) | C | Jaeger/Plummer: BOE/HF thực tế có chọn lọc hữu hạn rất lớn với Si; với resist còn phụ thuộc độ bám dính |
| k₁ dùng cho CD_min | 0,6 | C | Plummer, chương quang khắc |
| NA từng nguồn sáng (g/i/KrF/ArF) | 0,45 / 0,6 / 0,8 / 0,93 | C | Chọn giá trị điển hình có nguồn |
| Độ dày resist 500 nm ở 3000 rpm | 500 nm | C | Datasheet một loại resist phổ biến |
| Số mũ trong độ dày ∝ ω^-1/2 (viết thẳng bằng `Math.sqrt`) | −1/2 | B (SCIENCE.md mục 2, M03) | Kiểm lại với đường cong quay của resist cụ thể |
| Bước sóng g-line / i-line / KrF / ArF (`litho.sources.*.wavelengthNm`) | 436 / 365 / 248 / 193 nm | C | Tên đường phổ và laser quen thuộc nhưng chưa trích nguồn; Plummer, chương quang khắc |
| Độ dày oxit khởi đầu của M04 (`geometry.oxideThicknessNm`) | 300 nm | C | Lựa chọn thiết kế của bài tập, không phải phép đo |
| Hệ số hình dạng quang khắc (`litho.*`): liều→bề rộng 150 nm/×; ngưỡng tỉ lệ 0,7 và 1,0; phần in được 0,55 + 0,45; cặn 0,5 (sát giới hạn) và 0,6 trên dải 0,25 (thiếu liều dưới 0,85); thừa liều trên 1,35; nghiêng thành khi tỉ lệ < 1,3, 80 nm/đơn vị | như prototype | C | Không có số sách; chỉ cần đúng xu hướng (SCIENCE.md mục 2, M03) |
| Lề 40 nm quanh cửa sổ khi đo resist còn lại (`geometry.resistMeasureMarginNm`) | 40 nm | C | Định nghĩa chỉ số, không phải đại lượng vật lý |
| Tỉ lệ Si bị tiêu thụ khi oxy hóa | ≈0,44 | — | Jaeger/Plummer, chương oxy hóa |
| k₂ trong DOF = k₂·λ/NA² (`litho.k2`) | 0,5 | C | Plummer, chương quang khắc (nhiều sách ghi DOF = ±k₂·λ/NA²; kiểm lại là bề rộng toàn phần hay nửa) |
| Độ nhòe Gauss tại tiêu điểm tốt nhất σ₀ = hệ số·λ/NA (`litho.exposure.blurAtBestFocus`) | 0,445 | C (hệ số hình dạng) | Chọn để tái hiện ngưỡng 0,7 và 1,0 của prototype ở liều ×1; ≈ 2× Gauss khớp đĩa Airy (≈ 0,21·λ/NA, Zhang et al. 2007; nguồn do người dùng cung cấp, chưa tự đối chiếu). Gọi là "độ nhòe hiệu dụng" (gộp quang học và khuếch tán trong resist), **không** gọi là PSF quang học |
| Hấp thụ của resist α (`litho.exposure.absorptionPerNm`) | 6,4·10⁻⁴ nm⁻¹ (0,64 µm⁻¹) | C | Chọn cùng σ₀. Đối chiếu (người dùng cung cấp, chưa tự kiểm): AZ MiR 701, Dill A = 0,709 µm⁻¹, B = 0,034 µm⁻¹, nên hấp thụ chưa tẩy màu A + B ≈ 0,74 µm⁻¹; mô hình dùng 0,64 µm⁻¹ và không có tẩy màu (bleaching), vì vậy thành loe hơn thực tế |
| Ngưỡng sạch / đúng kích thước (`litho.exposure.scumOkFraction`, `cdToleranceFraction`) | 1% độ dày; ±10% bề rộng | C | Định nghĩa chỉ số của mô hình, không phải đại lượng vật lý |
| Nung mềm (`litho.bake.*`): nhiệt độ chuẩn; thời gian tương đương gấp đôi mỗi bao nhiêu °C; dưới / trên bao nhiêu phút tương đương thì dính mask / giảm độ nhạy; độ nhạy mất mỗi phút vượt | 90 °C; 10 °C; 0,5 / 3 phút; 0,15 mỗi phút | C | Tài liệu của một resist; quy luật chỉ có hướng (SCIENCE.md mục 2, M03: nung thiếu dính mask, nung quá giảm độ nhạy, mức B) |
| Tráng (`litho.develop.*`): thời gian làm sạch hết độ dày; ngưỡng tráng quá; mỏng đi mỗi phút vượt; nở ngang mỗi bên mỗi phút vượt | 1 phút; 1,5 lần; 10% mỗi phút; 30 nm mỗi phút | C | Datasheet resist và dung dịch tráng (TMAH) |
| Overlay (`litho.overlay.*`, `geometry.waferRadiusMm`): dung sai theo CD; hệ số của vùng Biên; bán kính wafer | 0,3·CD; 1,5; 150 mm | C | Dung sai overlay thường được nêu bằng một phần CD, chưa trích nguồn: Plummer hoặc Campbell, chương quang khắc; bán kính do M01 quy định sau |

### Tương phản màu (thiết kế, không phải hằng số vật lý)
Tính theo WCAG 2.x từ giá trị trong `src/ui/styles/tokens.css`; `tests/ui/tokens.test.ts` kiểm tra lại mỗi lần chạy test.

Chữ (cần ≥ 4,5:1, AA):

| Token | trên `--bg` | trên `--panel` | trên `--panel-2` |
|---|---|---|---|
| `--ink` | 11,55 | 13,66 | 12,50 |
| `--muted` | 5,03 | 5,94 | 5,44 |
| `--navy` | 9,31 | 11,01 | 10,08 |
| `--ok-ink` | 5,77 | 6,82 | 6,24 |
| `--warn-ink` | 5,06 | 5,98 | 5,48 |
| `--bad` | 4,75 | 5,61 | 5,14 |

Chữ `--panel` trên nền `--navy` (nút, bước đang chọn): 11,01.

Viền, chấm, icon (cần ≥ 3:1):

| Token | trên `--bg` | trên `--panel` | trên `--panel-2` |
|---|---|---|---|
| `--ok` | 3,67 | 4,34 | 3,97 |
| `--warn` | 3,91 | 4,62 | 4,23 |
| `--bad` | 4,75 | 5,61 | 5,14 |
| `--pr` (vòng focus) | 3,55 | 4,20 | 3,85 |

`--line` (≈ 1,3–1,6:1) chỉ là đường kẻ trang trí, không mang thông tin nên không áp ngưỡng này.

## Hiệu năng tính lại M04
Máy đo: AMD Ryzen 5 PRO 4650G (6 nhân / 12 luồng), 13,9 GB RAM, Windows 10, Node v24.14.1, Chrome 154.0.8037.98 (headless).
Lưới 260×150, 10 nm/ô. Đơn vị ms. "Toàn bộ" = litho → lưới → tốc độ → arrival-time → chỉ số.
Node: trung bình của 2 lần `npm run bench`. Chrome: trung vị 40 lần sau 8 lần chạy nóng, mã bundle bằng Vite (minify).
"CPU 4×" là `Emulation.setCPUThrottlingRate`, cùng cơ chế với tùy chọn "CPU: 4× slowdown" của DevTools: chỉ là ước lượng, **không thay** phép đo trên điện thoại thật
(tiêu chí "warm < 50 ms trên điện thoại" trong `m04-etch.md` chưa tick; cần đo trên điện thoại thật).

**Bản (a): port trung thành, chưa tối ưu**

| Ca | Prototype (Node, chỉ arrival) | Node: arrival / toàn bộ | Chrome 1×: arrival / toàn bộ | Chrome 4×: arrival / toàn bộ |
|---|---|---|---|---|
| A ướt BOE 6:1, cửa sổ 800 nm | 5,2 | 3,8 / 4,1 | 3,7 / 3,6 | 19,2 / 16,9 |
| B RIE 200 W, 30 mTorr, 800 nm | 18,3 | 11,5 / 11,8 | 11,3 / 11,5 | 52,8 / 53,1 |
| C RIE 80 W, 180 mTorr, 400 nm | 18,1 | 11,7 / 11,9 | 11,5 / 11,7 | 57,8 / 55,4 |

Ở CPU 4×, ca B và C vượt 50 ms, nên cần bước tối ưu (b).

**Bản (b): `maxTimeMin` = mức tối đa của thanh trượt (A: 8 phút, B và C: 14 phút), ô không khí không qua heap, heap vừa đủ**

| Ca | Node: arrival / toàn bộ | Chrome 1×: arrival / toàn bộ | Chrome 4×: arrival / toàn bộ | Chrome 4×, tệ nhất trong 40 lần |
|---|---|---|---|---|
| A ướt BOE 6:1, cửa sổ 800 nm | 3,4 / 3,6 | 3,7 / 3,5 | 15,7 / 16,4 | 23,4 / 18,2 |
| B RIE 200 W, 30 mTorr, 800 nm | 3,9 / 4,0 | 3,7 / 3,9 | 21,0 / 18,3 | 38,0 / 20,8 |
| C RIE 80 W, 180 mTorr, 400 nm | 3,4 / 3,5 | 3,2 / 3,4 | 14,8 / 15,6 | 16,5 / 24,1 |

Đo lại sau commit review (thêm kiểm tra rates và mã vật liệu): không đổi trong sai số. Node: A / B / C = 3,3 / 3,8 / 3,3 ms (arrival, có giới hạn); Chrome 4× (arrival, có giới hạn) 15,7 / 20,5 / 15,3 ms, tệ nhất trong 40 lần 18,7 / 29,4 / 18,8 ms; toàn bộ tệ nhất 24,1 / 35,5 / 17,7 ms. Bảng trên giữ nguyên.

Không truyền `maxTimeMin` (đường không giới hạn) thì bản (b) tương đương bản (a): Node 3,5 / 11,8 / 11,9 ms, Chrome 4× 18,1 / 53,7 / 53,9 ms cho A / B / C.
Cả ba ca đều dưới 50 ms ở CPU 4× khi có giới hạn; ca RIE nhanh gấp 2,5–3 lần so với bản (a). Tiêu chí "warm < 50 ms trên điện thoại" vẫn chưa tick cho tới khi đo trên máy thật.

### Cold và warm trên bản build (S0.3, đo lại 2026-10-09)
Tiêu chí M04 đã đổi: **warm** recompute < 50 ms trên điện thoại tầm trung; **cold** ghi riêng, không tính vào tiêu chí. Trong bảng này, *cold* = lần gọi `runRecipe` đầu tiên sau khi tải trang (người học gặp trước hết), *warm* = lần gọi thứ 9 trở đi trong cùng trang (mức ổn định; cùng quy ước 8 lần chạy nóng ở các bảng trên).
Máy đo như trên (Ryzen 5 PRO 4650G, Windows 10, Chrome 154.0.8037.98 headless điều khiển qua CDP). Bản production `npm run build` (`index-NdkceU__.js`, 162,1 KB, 54,0 KB gzip) chạy qua `vite preview`; không phải server dev nên React không gọi đôi (StrictMode chỉ gọi đôi ở bản dev). Mỗi lần đo cold dùng một browser context mới (không cache HTTP, không code cache V8), tức là lần vào trang đầu tiên. "4×" là `Emulation.setCPUThrottlingRate`, chỉ là ước lượng, **không thay** phép đo trên điện thoại thật.

**Cold**: trang thật, `/?debug=1`, ca B (`DEFAULT_RECIPE`, `maxTimeMin` = 14), 15 lần tải.

| CPU | `runRecipe` trung vị (nhỏ nhất – lớn nhất) | `arrivalTime` trung vị |
|---|---|---|
| 1× | 38,7 (29,4 – 53,8) | 35,3 |
| 4× (ước lượng) | 84,7 (69,2 – 159,0) | 69,2 |

Bảy lần tải đầu sau khi khởi động Chrome chậm hơn (41–54 ms), tám lần sau 29–39 ms; chưa rõ nguyên nhân nên không kết luận. Không tái hiện được 63–70 ms của hai lần iframe đầu ở lần đo trước (lớn nhất ở đây 53,8 ms).

**Warm**: trang đo tạm (ngoài repo) build bằng cùng Vite, import đúng `runRecipe` từ `src/sim/recipe.ts`, gọi 48 lần mỗi trang, 3 trang mỗi ca; lấy lần gọi 9–48 (120 mẫu mỗi ô). Lý do: trang thật chỉ gọi `runRecipe` một lần, chưa có chỗ gọi lại.

| Ca | 1×: trung vị / p95 / lớn nhất | 4× (ước lượng): trung vị / p95 / lớn nhất |
|---|---|---|
| A ướt BOE 6:1, cửa sổ 800 nm | 3,6 / 5,4 / 6,4 | 16,7 / 23,9 / 36,7 |
| B RIE 200 W, 30 mTorr, 800 nm | 4,5 / 6,1 / 25,4 | 19,1 / 22,2 / 33,8 |
| C RIE 80 W, 180 mTorr, 400 nm | 3,5 / 4,8 / 5,5 | 17,1 / 40,1 / 80,0 |

Số warm khớp bảng (b) ở trên (Chrome 4×, toàn bộ: 16,4 / 18,3 / 15,6). Có một mẫu 80,0 ms (ca C, 4×, lần gọi thứ 23) và một mẫu 60,9 ms (lần thứ 26) trong 360 mẫu warm ở 4×; chưa xác định nguyên nhân (có thể là GC hoặc nhiễu của máy đo).

**Đường ấm dần** (trung vị của lần gọi thứ 1 → 6 qua 3 trang, ms):

| Ca, CPU | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| B, 1× | 39,7 | 28,1 | 9,0 | 6,7 | 6,4 | 6,6 |
| B, 4× | 75,9 | 42,9 | 23,2 | 21,7 | 23,3 | 21,9 |
| C, 4× | 90,8 | 58,0 | 22,6 | 24,0 | 24,5 | 18,4 |

Lần gọi thứ 2 (người học đổi thông số lần đầu) còn chưa ấm: 28 ms ở 1×, 42–58 ms ở 4×; từ lần thứ 3–4 mới gần mức warm. Tiêu chí "warm" chỉ nói về mức ổn định, nên 1–2 lần đầu nằm ngoài; ghi lại để quyết định ở S0.4 (worker, có thể chạy thử một lần lúc rảnh) nếu cần.

Worker (S0.4) đưa phép tính ra khỏi luồng UI nhưng không làm nó nhanh hơn. `/?debug=1` hiện chỉ cho số cold; số warm trên điện thoại thật lấy ở `/?bench=1` (S0.4).

### Worker, làm ấm và GC (S0.4, đo 2026-10-09)
Máy và trình duyệt như trên (Chrome 154.0.8037.98, headless, điều khiển bằng Playwright). Harness tạm ngoài repo: một bản build Vite import đúng `SimService` và `runRecipe` của repo (không sửa gì), chỉ bọc `compute` bằng `performance.mark` để căn thời gian với trace Chrome. Mỗi ô bảng = 4 lần tải × 30 lần chạy = 120 mẫu, sau khi làm ấm xong; ô ghi **trung vị / p95 (hạng gần nhất) / lớn nhất** của `runRecipe`, ms. Bản build production của harness, mỗi lần tải một browser context mới.

**Giới hạn CPU 4× của Chrome không áp lên worker.** `Emulation.setCPUThrottlingRate` chỉ làm chậm luồng chính của trang: trong worker, "4×" vẫn cho trung vị 3,4–3,8 ms, y hệt 1×; gửi lệnh thẳng tới target của worker thì Chrome trả `Operation is only supported for pages, not workers`. Vì vậy cột 4× dưới đây là **cùng `SimService` chạy trên luồng chính** (nối tiếp các bảng cũ và khớp chúng: trung vị 14,5–16,8 ms so với 16,7 / 19,1 / 17,1 ở bảng "warm"), còn worker chỉ đo được ở 1×. Số trên điện thoại thật phải lấy bằng `/?bench=1`.

| Cấu hình | A (BOE 6:1, 800 nm) | B (RIE 200 W, 800 nm) | C (RIE 80 W, 400 nm) |
|---|---|---|---|
| Worker, 1× | 3,3 / 3,6 / 3,8 | 3,8 / 4,2 / 20,3 | 3,3 / 3,7 / 16,7 |
| Luồng chính, 1× | 3,3 / 3,7 / 4,1 | 3,8 / 4,0 / 4,2 | 3,3 / 3,6 / 17,5 |
| Luồng chính, 4× | 14,9 / 16,1 / 26,2 | 16,8 / 18,5 / 28,5 | 14,5 / 15,8 / 26,3 |

`arrivalTime` chiếm gần hết thời gian (worker 1×, trung vị: A 3,2 trong 3,3; B 3,6 trong 3,8; C 3,1 trong 3,3). Ở cả ba cấu hình có những mẫu hiếm lâu hơn hẳn: 16–20 ms ở 1× (gấp ~5 lần trung vị), 26–28 ms ở 4× (gấp ~1,8 lần); trong trace 900 lần chạy chỉ có 3 (worker 1×) và 4 (luồng chính 4×) mẫu lâu hơn 1,5× trung vị. Đó là các giá trị "lớn nhất" cần giải thích; p95 trên 120 mẫu gần như không thấy chúng.

**Giả thuyết GC (`arrivalTime` cấp ~5,2 MB heap mỗi lần, Major GC trùng mẫu chậm): không được xác nhận.** Trace Chrome với category `devtools.timeline`, `v8`, `blink.user_timing`, `disabled-by-default-v8.gc`; 3 lần tải × 100 lần mỗi ca = 900 lần chạy mỗi cấu hình; "mẫu chậm" = lâu hơn 1,5× trung vị của ca. Căn từng lần chạy (cặp `performance.mark`) với sự kiện GC trên cùng luồng:

| | Worker 1× | Luồng chính 4× |
|---|---|---|
| Sự kiện Major GC trong trace | 16 (15 "finalize incremental marking via task", 1 "via stack guard"; ≈ 1 ms mỗi lần), **không cái nào nằm trong một lần chạy** | 0 |
| Mẫu chậm trùng Major GC | 0 / 3 | 0 / 4 |
| Mẫu chậm trùng scavenge (Minor GC) | 2 / 3 | 3 / 4 |
| Mẫu thường trùng scavenge | 0 / 897 | 129 / 896 |

Hai mẫu vọt của worker (21,1 ms và 17,7 ms) mỗi mẫu chứa 21–23 lần scavenge liên tiếp, cách nhau ~0,6 ms, kích thước heap trước/sau gần như y hệt nhau (1,83 MB → 0,78 MB): tức là bộ nhớ trẻ của heap JS đầy lại sau mỗi ~1 MB, một tốc độ cấp phát cỡ GB/s, không phải bộ đệm 5,2 MB nằm ngoài heap. Ở luồng chính 4× một mẫu chậm (25 ms) không trùng GC nào.

Hai thực nghiệm vứt đi (sửa tạm `src/physics/etch.ts`, đo rồi `git checkout`, không commit), cùng harness và cùng giao thức:

| Cấu hình | A | B | C |
|---|---|---|---|
| X1 (đúng giả thuyết: bộ đệm heap tái dùng ở cấp module), luồng chính 4× | 15,3 / 18,5 / 29,8 | 17,2 / 19,2 / 31,7 | 15,1 / 17,1 / 18,1 |
| X1, worker 1× | 3,4 / 3,6 / 4,0 | 3,8 / 3,9 / 4,1 | 3,3 / 3,6 / 17,0 |
| X2 (vòng stencil theo chỉ số trên `Int8Array`, không cấp phát đối tượng tạm), luồng chính 4× | 13,6 / 15,4 / 19,4 | 15,4 / 17,0 / 18,9 | 13,5 / 16,0 / 19,2 |
| X2, worker 1× | 3,1 / 4,0 / 5,3 | 3,5 / 3,9 / 4,7 | 3,0 / 3,3 / 3,6 |

- X1 không loại được mẫu vọt: trace 900 lần chạy ở worker vẫn có 3 mẫu 10–12 ms chứa 15–22 lần scavenge, ở 4× p95 và lớn nhất không tốt hơn bản gốc (A 18,5 / 29,8 so với 16,1 / 26,2). Vì vậy **không thêm `scratch`** (đúng điều kiện bạn đặt ra: chỉ làm nếu trace xác nhận GC).
- X2 làm mẫu vọt biến mất: trong trace 900 lần chạy ở worker 1×, **0 lần chạy trùng scavenge** (bản gốc: 2 mẫu có 21–23 scavenge), mẫu lớn nhất ≤ 5,4 ms; trung vị giảm 6–9% (3,3 → 3,1; 3,8 → 3,5; 3,3 → 3,0). Ở 4× mẫu lớn nhất còn 19 ms (so với 26–28 ms), nhưng còn 127 / 898 lần chạy trùng một scavenge ngắn, nên 4× chưa sạch hoàn toàn. Giải thích hợp lý nhất: `for (const [dx, dy] of STENCIL)` cấp phát đối tượng tạm mỗi lượt khi mã chưa được tối ưu hoàn toàn (khởi động, hoặc sau khi V8 hủy tối ưu); X2 chưa chứng minh cơ chế đó ở mức V8, chỉ chứng minh rằng bỏ nó thì cơn scavenge biến mất. Mẫu vọt thưa nên chỉ cột "lớn nhất" và trace thấy chúng. Con số "≤ 5,4 ms" là của một lần đo; bản đã áp dụng đo lại bên dưới cho kết quả ít đẹp hơn.

**Đã áp dụng X2 (`08678c7`); số trước/sau trong cùng một phiên** bằng `scripts/perf` đã commit (Chrome 154.0.8037.98, lệnh ở `scripts/perf/README.md`). Bench: 4 lần tải × 30 lần = 120 mẫu mỗi ô, ô là trung vị / p95 / lớn nhất của `runRecipe`, ms.

| Cấu hình | A | B | C |
|---|---|---|---|
| Worker 1×, trước | 3,4 / 3,9 / 5,3 | 3,8 / 4,2 / 4,7 | 3,3 / 3,7 / 4,5 |
| Worker 1×, sau | 3,3 / 4,2 / 7,4 | 3,6 / 4,8 / 6,6 | 3,1 / 3,5 / 3,8 |
| Luồng chính 4×, trước | 14,9 / 16,5 / 26,2 | 17,0 / 19,3 / 40,7 | 14,6 / 16,7 / 26,2 |
| Luồng chính 4×, sau | 14,3 / 16,4 / 20,9 | 16,2 / 19,6 / 23,3 | 13,9 / 15,0 / 15,3 |

Trace, 3 lần tải × 100 lần mỗi ca = 900 lần chạy mỗi hàng ("chậm" = lâu hơn 1,5× trung vị của ca):

| Hàng | Minor GC (scavenge) | Major GC | Mẫu chậm | Lần chạy trùng một scavenge | Lần chạy lớn nhất |
|---|---|---|---|---|---|
| Worker 1×, trước | 343 | 22 | 7 | 3 | 18,6 ms (22 scavenge liên tiếp) |
| Worker 1×, sau | 178 | 0 | 3 | 0 | 11,3 ms (không có GC) |
| Luồng chính 4×, trước | 203 | 0 | 3 | 131 | 28,5 ms (5 scavenge) |
| Luồng chính 4×, sau | 138 | 0 | 2 | 128 | 26,0 ms (không có GC) |

Đọc thẳng: (1) trung vị giảm 3–6% ở worker và 4–5% ở 4×; (2) cơn scavenge dài (12–22 lần trong một lần chạy) và Major GC biến mất khỏi worker, và ở 4× không mẫu chậm nào còn trùng GC; (3) **p95 và lớn nhất của bench ở worker không giảm trong lần đo này** (A và B còn nhỉnh hơn: 7,4 và 6,6 ms so với 5,3 và 4,7 ms), vì cả hai lần đo đều rất sạch (trước đó không bắt được mẫu vọt nào trong 120 mẫu) và mẫu lẻ còn lại không do GC; ở 4× lớn nhất giảm rõ (A 26,2 → 20,9, B 40,7 → 23,3, C 26,2 → 15,3) còn p95 gần như giữ; (4) vẫn còn 128/900 lần chạy ở 4× trùng một scavenge ngắn (cả trước lẫn sau), chưa rõ nguyên nhân. Đây là một phiên trên một máy; không có khoảng tin cậy. So sánh trước/sau cần chạy cả hai trong cùng phiên, như đã làm.

**Làm ấm.** Trung vị khứ hồi của lần gọi 1–6 (8 lần tải mỗi hàng; lần 1 = công thức mặc định B lúc tải trang, rồi nghỉ 3 giây, rồi B, C, B, C, B cách nhau 300 ms):

| Cấu hình | #1 | #2 | #3 | #4 | #5 | #6 |
|---|---|---|---|---|---|---|
| Worker 1×, làm ấm bật (bản chốt) | 29,9 | 4,3 | 3,6 | 4,3 | 3,8 | 4,2 |
| Worker 1×, làm ấm bật (bản đầu, lỗi) | 54,5 | 4,2 | 3,7 | 4,3 | 3,7 | 4,4 |
| Worker 1×, làm ấm tắt | 31,9 | 31,5 | 5,3 | 4,7 | 4,1 | 4,5 |
| Luồng chính 4×, làm ấm bật (bản chốt) | 70,3 | 20,4 | 16,1 | 19,0 | 17,0 | 18,4 |
| Luồng chính 4×, làm ấm tắt | 71,8 | 41,1 | 21,2 | 21,8 | 18,9 | 19,8 |

Làm ấm không làm lần gọi đầu nhanh hơn (cold ≈ 30 ms ở worker 1×, ≈ 70 ms ở 4×) nhưng đưa lần gọi thứ 2, thường là lần người học đổi thông số đầu tiên, về mức warm: 4,3 so với 31,5 ms ở worker 1×, 20 so với 41 ms ở 4×. Bản đầu (làm ấm chạy ngay) làm lần gọi đầu chậm thêm ~25 ms: xem mục S0.4 ở "Done". Bảng đo trên máy desktop; trên điện thoại một lần làm ấm chạy 9 lần có thể kéo dài vài trăm ms, và một yêu cầu thật đến giữa lúc đó phải chờ hết lần đang chạy.

### arrivalTime: bảng chi phí (S0.5, đo 2026-10-09)
Máy và Chrome như các mục trên (Chrome 154.0.8037.98, headless), harness `scripts/perf` (lệnh ở README của nó), 4 lần tải × 30 lần = 120 mẫu mỗi ô; ô là trung vị / p95 / lớn nhất của `runRecipe`, ms. Hai đợt trong cùng một phiên, thứ tự khác nhau để thấy hiệu ứng thứ tự và độ trôi: đợt 1 = gốc, tách `Material`, bảng, gốc đo lại; đợt 2 = bảng, tách `Material`, gốc. "Gốc" = `de280c4` (mã `arrivalTime` y như `4bb8fa2`), "tách" = `693aa1d`, "bảng" = `56fc2c9`. Luồng chính 4× là cùng `SimService` trên luồng chính (Chrome không làm chậm được worker, xem mục S0.4).

| Worker 1× | A | B | C |
|---|---|---|---|
| gốc, đợt 1 | 3,1 / 4,5 / 5,8 | 3,4 / 3,7 / 4,0 | 3,0 / 3,2 / 3,7 |
| gốc, đo lại cuối đợt 1 | 3,1 / 4,1 / 5,7 | 3,5 / 3,7 / 4,0 | 3,0 / 3,2 / 3,5 |
| gốc, đợt 2 | 3,1 / 3,8 / 5,6 | 3,5 / 3,8 / 4,4 | 3,0 / 3,3 / 5,2 |
| tách `Material`, đợt 1 | 3,1 / 4,2 / 5,4 | 3,5 / 5,1 / 5,3 | 3,0 / 3,2 / 3,8 |
| tách `Material`, đợt 2 | 3,1 / 4,2 / 5,5 | 3,4 / 3,7 / 3,9 | 3,0 / 3,1 / 3,4 |
| **bảng**, đợt 1 | **2,6** / 3,0 / 3,1 | **2,8** / 3,1 / 3,4 | **2,5** / 2,8 / 3,3 |
| **bảng**, đợt 2 | **2,6** / 2,9 / 3,9 | **2,9** / 3,1 / 3,9 | **2,5** / 2,7 / 3,2 |

| Luồng chính 4× | A | B | C |
|---|---|---|---|
| gốc, đợt 1 | 13,5 / 15,1 / 19,6 | 15,6 / 18,8 / 24,2 | 13,5 / 15,8 / 19,7 |
| gốc, đo lại cuối đợt 1 | 13,6 / 14,9 / 18,5 | 15,7 / 18,2 / 22,5 | 13,4 / 14,7 / 15,9 |
| gốc, đợt 2 | 13,8 / 16,2 / 19,6 | 15,8 / 20,4 / 23,9 | 14,0 / 21,5 / 24,5 |
| tách `Material`, đợt 1 | 14,3 / 18,1 / 19,5 | 16,0 / 20,6 / 24,6 | 13,9 / 18,5 / 21,6 |
| tách `Material`, đợt 2 | 13,7 / 16,3 / 20,4 | 15,5 / 17,0 / 18,3 | 13,5 / 15,6 / 17,9 |
| **bảng**, đợt 1 | **12,0** / 15,4 / 16,1 | **13,1** / 17,1 / 21,2 | **11,4** / 14,1 / 15,1 |
| **bảng**, đợt 2 | **11,2** / 12,3 / 13,3 | **12,7** / 14,6 / 18,9 | **11,3** / 13,1 / 15,8 |

`arrivalTime` riêng (trung vị, worker 1×): gốc 3,0 / 3,3 / 2,9 (đợt 1), 2,9 / 3,3 / 2,8 (đợt 2); bảng 2,5 / 2,7 / 2,4 ở cả hai đợt.

Đọc thẳng:
- **Tách `Material` không đổi hiệu năng.** Worker 1× y nhau ở cả hai đợt. Ở luồng chính 4× đợt 1 thấy chậm hơn gốc 0,4–0,8 ms (và p95 cao hơn), đợt 2 thì ngang gốc (13,7 so với 13,8; 15,5 so với 15,8; 13,5 so với 14,0): hiệu số đổi dấu theo thứ tự nên đó là nhiễu của đo 4× (cỡ ±0,5 ms; bản "bảng" cũng cho 12,0 và 11,2 ở A giữa hai đợt), không phải hiệu ứng của commit. Worker 1× ổn định hơn nhiều (±0,1 ms).
- **Bảng chi phí nhanh hơn rõ**: worker 1× −16, −18, −17% (A, B, C) ở trung vị tổng, và cùng chiều ở cả hai đợt; luồng chính 4× −11 đến −19%. p95 và lớn nhất cũng thấp hơn (một phiên, một máy, không có khoảng tin cậy; mẫu vọt thưa nên so cột lớn nhất cần thận trọng).
- Tiêu chí M04 "warm < 50 ms trên điện thoại" **vẫn chưa tick**: chưa có số điện thoại sau bước 1.

## Science review
(chưa có)
