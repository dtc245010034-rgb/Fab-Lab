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
  - `src/physics/etch.ts`: `wetEtchRates`, `rieRates`, `arrivalTime` (Dijkstra 16 hướng). Mã vật liệu `Material` và kiểu `MaterialGrid` đặt ở đây
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

## Next
- Mẫu lẻ không do GC vẫn còn sau khi sửa stencil (11,3 ms ở worker 1×, 26 ms ở 4× trên luồng chính, mỗi cái 1 lần trong 900 lần chạy, trace không thấy GC nào trùng). Chưa rõ nguyên nhân (nghi lịch của hệ điều hành hoặc nhiễu máy đo); chỉ cần quay lại nếu số đo điện thoại thật cho p95 hay lớn nhất gần 50 ms.
- Deploy thật: nối Workers Builds trên dashboard Cloudflare theo README (tên Worker `fab-lab`). Sau đó mở `/?bench=1` trên điện thoại thật (đợi bảng hiện, bấm "Chạy lại" vài lần) và ghi trung vị / p95 / lớn nhất của `runRecipe` ở mục Hiệu năng; số cold lấy ở `/?debug=1` (tải lại trang, ghi riêng). Tiêu chí "warm < 50 ms trên điện thoại" trong `m04-etch.md` chỉ tick khi có số warm đo trên máy thật. Chrome DevTools/CDP không làm chậm được worker (xem dưới), nên không có "4× cho worker" trên máy này.
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

## Science review
(chưa có)
