# Fab Lab — Trạng thái

Đọc file này đầu mỗi phiên. KHÔNG đọc `docs/history/` trừ khi cần tra (chi tiết cũ, số đo, quyết định từng bước).
Giới hạn của file: ≤ 150 dòng, mỗi dòng ≤ 300 ký tự (`tests/deploy/status.test.ts` kiểm).
Hằng số cần đối chiếu và rà khoa học: `docs/PROGRESS.md`. Kế hoạch từng phiên: `docs/SESSIONS.md`.
Lưu trữ: `docs/history/PROGRESS-s0-s1.1.md` (Done, Hiệu năng, "Next" cũ nguyên văn).

## Trạng thái hiện tại (2026-10-23)
- Giai đoạn 0 xong (2026-10-10). S1.1 (M03 quang khắc): bước 1, 2, 3a, 3b-1, 3b-2, 3b-3, 3b-4 đã duyệt và merge.
- `main` = `fd5b0da` trước housekeeping. Nhánh `chore/housekeeping` đang chờ duyệt (chưa merge).
- Còn lại của S1.1, theo thứ tự mới: housekeeping, rồi 5b, rồi 4, rồi 5.
- M03 đã có trang `/m03` bước 3.1–3.6 nối với worker, phán quyết Đạt/Biên/Hỏng ở 3.6; bước 3.7 (Overlay) chưa có UI.
- Trang `/` vẫn là M04 (khắc) với khung Traveler 6 bước; các slot chưa có nội dung hiện "Chưa có nội dung." (việc của 5b và S1.2).
- Lệnh kiểm: `npm test`, `npm run build`, `npm run lint`; `npm run e2e` trước khi merge vào main. Hook git: xem "Hook" dưới.

## Thứ tự các bước còn lại và effort
| Bước | Nội dung | Model | Effort |
|---|---|---|---|
| housekeeping | Tách PROGRESS, hook git, bảng nhật ký, sửa SESSIONS | sonnet | medium |
| 5b | Đường vào `/m03` từ `/` và bỏ "Chưa có nội dung." ở `/`, kèm tiêu chí (c) (xem dưới) | sonnet | medium |
| 4 | UI bước 3.7 Overlay | sonnet | high |
| 5 | Rà copy theo SCIENCE.md, bỏ font Be Vietnam Pro 600 khỏi `/m03`, e2e, bundle, tick spec | sonnet | high (rà khoa học: xhigh) |
Prompt từng bước ở `docs/SESSIONS.md`. Mỗi bước một context riêng; sau khi duyệt và merge, người dùng chạy `/clear`.

## Bước 5b: nghiệm thu sản phẩm (chèn trước bước 4)
- (a) `/` có đường vào `/m03` (danh sách module hoặc nav), người lạ không phải gõ URL.
- (b) Không trang nào hiện "Chưa có nội dung." (hiện M04 ở `/` có ở cả 6 bước vì `Lab.tsx` gọi `<Traveler />` không slot).
- Nội dung thật của M04 là việc của S1.2; ở 5b chỉ cần trạng thái trung thực ("đang xây") thay cho khung rỗng.
- Phương án phải cân nhắc trong plan 5b: `/` = trang chọn module, M04 chuyển sang `/m04`.
- Điều kiện của phương án đó: `/?bench=1` (và `&thread=main`, `/?debug=1`) vẫn chạy, hoặc đổi có ghi rõ ở README, STATUS và e2e.
- Nhớ `routeFor` ở `src/ui/route.ts` hiện đưa mọi đường lạ ra M04; trang 404 để Giai đoạn 4.
- (c) Người dùng tự mở site trên điện thoại như người mới, ghi 5 nhận xét vào mục "Nhận xét của người dùng" cuối file này.

## Bước 4: UI bước 3.7 Overlay (chưa làm)
- Dấu căn chỉnh, đọc sai lệch ẩn, chỉnh dx/dy/xoay, rework hay cho qua; vùng đích vẽ làm chú thích (không thêm Material).
- Chưa có nút "Sang khắc" (S1.2 nối). Spec: `docs/modules/m03-lithography.md`; physics overlay đã có (bước 1), cần sim/trang nối.
- Page-safe: trang không import mô hình. `sim/m03.ts`, `physics/exposure.ts`, `aerial.ts`, `special.ts` chỉ ở worker (test `tests/sim/pageSafe.test.ts`).
- Trang lấy từ `sim/m03Session.ts`, `sim/windowSpec.ts`, `sim/m03Controls.ts`, `physics/focus.ts`, `constants.ts`, `litho.ts`; từ `sim/m03` chỉ import kiểu.
- Ô số của M03 không dùng chữ "Đạt/Biên/Hỏng" (dành cho phán quyết ở 3.6): dùng chữ mô tả cờ ("Trong DOF", "Nung đủ"…). Có test.
- "Lưu ý" (cờ quy trình không nằm trong nguyên nhân) tách khỏi nguyên nhân của phán quyết; test: Lưu ý ∩ nguyên nhân = ∅.
- Mỗi bước có đúng một câu mở bằng **Nếu làm sai:** và không còn slot "Chưa có nội dung." ở M03 (test + e2e 380 px); giữ khi thêm 3.7.
- Quy tắc copy ở `docs/modules/m03-lithography.md`: k₂ chỉ đọc, mọi số là "giá trị minh họa", không gọi σ là PSF.

## Bước 5: rà soát và dọn (chưa làm)
- Đọc lại toàn bộ copy M03 đối chiếu `docs/SCIENCE.md` (MDX tối giản của 3.1–3.4 chưa qua rà khoa học).
- **Bỏ font Be Vietnam Pro 600 khỏi `/m03`** (quyết định (b), 2026-10-23): các `<strong>` của copy 3b-3 đang kéo thêm 33,46 KiB gzip font.
- Cách làm: nhãn đậm dùng JetBrains Mono 600 của kit (đã tải sẵn), ưu tiên một lớp CSS cho `strong` trong nội dung MDX, không đổi chữ.
- Đối chiếu: font `/m03` ở 3.1 từ 197,88 về 164,42 KiB; ở 3.4 và 3.6 từ 258,34 về 224,88 KiB; tổng `/m03` ở 3.1 hiện 303,36 KiB.
- Kiểm: không phần tử `/m03` nào dùng Be Vietnam Pro weight ≥ 600 (`getComputedStyle`); `e2e/bundle-m03.spec.ts` thêm kiểm không tải `be-vietnam-pro-*-600-*`.
- Chụp lại 380 px mọi bước đổi (3.1–3.6 đều có "Nếu làm sai:", 3.4 ModelLimits, 3.5 "Cách thấy cặn do thiếu liều.") và XEM ảnh.
- Sửa dòng "Trọng lượng chữ" ở `docs/DESIGN.md` (hiện nói `<strong>` vẽ ở 700 và tải mặt 600).
- Rà khoa học, nung quá với resist âm: thực tế tự liên kết ngang nên cửa sổ khó mở hơn, mô hình gộp thành liều giảm nên cửa sổ rộng ra (ngược chiều).
- Chọn: (a) viết rõ trong `reasons.ts`, `cautions.ts`, `softbake.mdx` rằng với resist âm phép gộp đi ngược hiệu ứng thật; hoặc (b) sửa luật (cần nguồn Mack/Campbell).
- Nếu chọn (b), đổi test và `m03Claims.test.ts` cùng lúc, không nới test cho khớp. Chi tiết: history, mục "Next (bản cũ)".
- Nếu Workers Builds trượt ở `beforeAll` của `tests/ui/m03Page.test.tsx`: đặt timeout riêng cho hook (ví dụ 30 s), không nâng timeout chung.
- Cuối bước: e2e, đo bundle, tick tiêu chí còn lại trong spec M03, cập nhật STATUS.

## Quyết định còn hiệu lực
- k₂ chỉnh được ("chế độ nâng cao"): dự kiến, chưa làm (2026-10-22); hiện k₂ = 0,5 chỉ đọc. Làm thật cần `k2` trong `ExposureInput` và trục cửa sổ quy trình.
- Weight 500 của Be Vietnam Pro đã bỏ khỏi kit (3b-1): nhãn thanh trượt và `Note` dùng 400.
- `Grade` ("Phán quyết:") là component riêng, chỉ ở 3.6, ca Đạt cũng có một câu "vì sao"; khác `Note` (Đạt/Cảnh báo/Lỗi).
- Cờ quy trình khi bản in đúng (`out-of-focus`, `overbaked`, `underdeveloped`, `overdeveloped`) không đổi Đạt/Biên/Hỏng; hiện ở tầng "Lưu ý".
- Trang 404 để Giai đoạn 4: hiện mọi đường lạ ra M04 (`routeFor`, `src/ui/route.ts`).
- `overrides` ép `katex` 0.19.0 vượt dải của `rehype-katex` 7 và `remark-math`: chạy lại build và e2e khi nâng hai gói đó; bỏ `overrides` khi chúng nhận 0.19.
- Độ dày resist còn lại sau tráng quá chưa nằm trong tiêu chí Đạt: xem lại ở S1.2 khi M04 có chấm điểm (nguy cơ thủng mask khi RIE).
- Cloudflare Web Analytics (cookieless) để Giai đoạn 4, chưa bật. Không backend, không tài khoản trước Giai đoạn 4.
- Số đo hiệu năng M04 (cold, warm, worker, GC) và cách đo: history, mục "Hiệu năng tính lại M04". Chrome không làm chậm được worker ở DevTools.
- Glyph `≈ ₂ → ∝ √` lấy từ font hệ thống (đã kiểm ở 380 px trên Chromium/Windows); prototype tô chữ chỉ số bằng `--ok-ink`/`--warn-ink`, không phải `--ok`/`--warn`.

## Hook git (housekeeping)
- `simple-git-hooks` (cài qua `npm install`, script `prepare`). `pre-commit` = `npx tsc -b && npm run lint`; `pre-push` = `npm test`. Không chạy e2e trong hook.
- Không dùng `--no-verify`. Hook đỏ thì sửa hoặc dừng báo.
- Nếu `npm ci` của CI lỗi vì hook, đặt `SKIP_INSTALL_SIMPLE_GIT_HOOKS=1` cho bước cài đặt của CI.

## Việc của người dùng
- Duyệt nhánh `chore/housekeeping` (chưa merge), xem Workers Builds và check GitHub của commit cuối.
- Mở `/?bench=1` (và `&thread=main`) trên S20 FE để có số điện thoại của biểu đồ cửa sổ quy trình.
- Xem `/m03` bước 3.1–3.6 trên điện thoại (bước 3.6 nhất là phán quyết, Lưu ý, ModelLimits).
- Điền bảng nhật ký phiên dưới đây (model, effort, context lúc dừng từ `/context`).
- Đối chiếu các hằng số ở `docs/PROGRESS.md` ("Values to verify") với giáo trình trước khi ra mắt.

## Nhật ký phiên
Cột "context lúc dừng": người dùng điền từ `/context`. "—" = không có dữ liệu.
| Bước | Model | Effort | Context lúc dừng | Commit cuối |
|---|---|---|---|---|
| S1.1 bước 1 (physics) | — | — | — | `f762ca0` |
| S1.1 bước 2 (sim, worker) | — | — | — | `2e56407` |
| S1.1 bước 3a (UI kit, MDX, router) | — | — | — | `40138ca` |
| S1.1 bước 3b-1 (3.1–3.4 nối worker) | — | — | — | `2baf1c5` |
| S1.1 bước 3b-2 (Grade, ModelLimits, 3.5–3.6) | — | — | — | `69d3bc4` |
| S1.1 bước 3b-3 (sửa khoa học nung mềm, MDX đầy đủ) | — | — | — | `0551e65` |
| S1.1 bước 3b-4 (e2e 380 px, DESIGN, đột biến) | — | — | — | `fd5b0da` |
| S1.1 housekeeping | sonnet | medium | | |
| S1.1 bước 5b | | | | |
| S1.1 bước 4 | | | | |
| S1.1 bước 5 | | | | |

## Nhận xét của người dùng (5b, tiêu chí c)
Mở site trên điện thoại như người mới, ghi 5 nhận xét:
1.
2.
3.
4.
5.
