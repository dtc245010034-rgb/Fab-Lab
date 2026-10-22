# Fab Lab — Thiết kế

## Ý tưởng
Phòng sạch dưới **đèn vàng** (yellow room). Đây là chi tiết thật: khu quang khắc dùng đèn vàng
vì cản quang nhạy với ánh sáng xanh/UV. Giao diện như một "phiếu công đoạn" (traveler) cạnh một màn hình mặt cắt.
Prototype tham chiếu: `reference/prototype-m04-etch.html`.

## Tokens (giữ nguyên tên)
```css
--bg:#efdb98; --panel:#f8eec6; --panel-2:#f3e4ad; --ink:#1c2230; --muted:#5f5a45; --line:#d4bf75;
--navy:#22305a;                         /* hành động */
--si:#5b6b80; --ox:#b6a3dc; --pr:#c8432a; /* vật liệu */
--ok:#2f7d4c; --warn:#9a5c00; --bad:#b3261e;   /* trạng thái: viền, chấm, icon */
--ok-ink:#1f5c37; --warn-ink:#844c00;           /* trạng thái: chữ (bad dùng --bad) */
--screen:#0f1320;                               /* nền màn hình mặt cắt */
```
Màu vật liệu bổ sung khi cần: kim loại Al/Cu, nitride Si₃N₄, poly-Si. Thêm vào token, không dùng màu rời.
Màn hình mặt cắt luôn nền tối `--screen` (`#0f1320`) để vật liệu nổi bật.
`--screen` cũng là màu của không khí và phần đã khắc, nên **không** dùng làm nền phần canvas nằm ngoài lưới: hai bên lưới dùng `--navy`,
kèm đường ngắt zigzag màu `--panel` ở hai mép (quy ước bản vẽ: wafer còn tiếp ngoài khung nhìn). Token này là `SURROUND_TOKEN` trong `src/render/canvas2d/palette.ts`.

### Quy tắc màu trạng thái
- **Chữ** biểu thị trạng thái chỉ dùng `--ok-ink`, `--warn-ink` hoặc `--bad`. Không đặt `--ok` / `--warn` làm màu chữ.
- **Viền, chấm, icon, thanh nhấn** dùng `--ok`, `--warn`, `--bad`.
- Trạng thái luôn kèm **chữ hoặc icon** ("Đạt", "Cảnh báo", "Lỗi"), không bao giờ chỉ bằng màu.
- Tương phản tối thiểu trên `--bg`, `--panel`, `--panel-2`: chữ ≥ 4,5:1 (AA); viền/chấm/icon ≥ 3:1.
  Số đo hiện tại ghi ở `docs/PROGRESS.md`; `tests/ui/tokens.test.ts` kiểm tra tự động.

## Chữ
- Tiêu đề: Saira Condensed 700–800, viết hoa.
- Nội dung: Be Vietnam Pro 400–600 (hỗ trợ tiếng Việt đầy đủ).
- Số liệu, đơn vị: JetBrains Mono, `tabular-nums`. Phương trình dài (đa dòng, phân số, căn) dựng bằng KaTeX lúc build, trong `EquationChip`; font KaTeX chỉ tải ở trang module có phương trình. Ký hiệu đơn giản trong chữ mono (λ σ θ μ ° × ±) lấy từ JetBrains Mono (subset `greek` đã có sẵn trong `400.css`/`600.css`); `→ ₁ ₂ ≈ ∝ √` không nằm trong subset nào và lấy từ font hệ thống.

## Bố cục
- Desktop: Viewer (trái, co giãn) + Traveler (phải, 380 px). Dưới 960 px: xếp dọc, Viewer trước.
- Traveler: thanh **6–7 bước theo module** ở trên (cột CSS theo số bước, `--steps`) → tiêu đề bước → cơ chế → phương trình → điều khiển → ghi chú → nút. Mỗi nút một mã nhỏ ("3.3") và **một nhãn một từ, tối đa 5 ký tự** ("Nung"): bảy nút chia 348 px ở 380 px, mỗi nút ≈ 49 px, và e2e kiểm nhãn không xuống dòng, không bị cắt, nút rộng ≥ 44 px. Tên đầy đủ ("Nung mềm") nằm ở `aria-label` và ở tiêu đề bước, và chứa nhãn (WCAG "label in name").
- Mỗi module có một đường dẫn: `/` là M04, `/m03` là M03 (`location.pathname`, nạp bằng `import()` nên `/` không tải gì của M03).
- Viewer: tiêu đề mặt cắt, canvas, chú giải vật liệu, hàng chỉ số (metric tiles).

## Thành phần
- `StepNav`, `ParamSlider` (nhãn + giá trị có đơn vị), `Segmented`, `MetricTile` (ok/warn/bad),
  `Note` (ok/warn/bad), `Grade` (phán quyết của bước: nhãn "Phán quyết:", một từ lớn và một câu giải thích), `EquationChip`, `ModelLimits`; `AerialChart` và `ProcessWindowChart` là hai biểu đồ SVG của bước 3.4.
- Trạng thái ok/warn/bad có từ đi kèm dùng chung ở `src/ui/status.ts`: **Đạt / Cảnh báo / Lỗi**. `MetricTile` và `Note` viết từ này thành một dòng nhỏ, in hoa, cùng màu chữ `-ink` của trạng thái. `MetricTile` nhận được một chữ riêng (`word`) thay cho từ chung, và kiểu `MetricSpec` **bắt buộc** ô có trạng thái phải có chữ (TypeScript từ chối nếu thiếu): ô số của M03 dùng chữ mô tả cờ ("Trong DOF", "Nung thiếu", "Tráng quá"), không bao giờ "Đạt", để không lẫn với phán quyết.
- `Grade` của M03 là **một từ phán quyết, chưa phải điểm**: Đạt / Biên / Hỏng (`ok` / `warn` / `bad`, màu chữ theo quy tắc trạng thái ở trên: `--ok-ink`, `--warn-ink`, `--bad`; từ viết bằng Saira 800 cỡ 26 px), chỉ ở bước 3.6, cộng một câu "vì sao" (ca Đạt cũng có), và dòng "Còn lại:" (nhãn ngắn của các nguyên nhân khác, mỗi cái một khung viền) khi có. Hình của nó khác `Note`: thanh bên rộng 8 px (của `Note` là 4 px), nhãn "Phán quyết:" và từ lớn, không có thẻ Đạt/Cảnh báo/Lỗi. **Điểm số bằng số của M03 không có**: spec không có công thức, và chấm điểm chờ M04 (S1.2); khi có, `Grade` sẽ nhận thêm điểm, không đổi hình.
- `Lưu ý` (danh sách dưới `Grade`, cờ quy trình mà phán quyết không nêu): tiêu đề `h4.ctl-title` và một danh sách có viền trái 3 px màu `--line`, mỗi mục mở bằng "Bản in vẫn đúng, nhưng". Tách khỏi `Grade` bằng hình (không khung, không màu trạng thái) vì nó không đổi Đạt/Biên/Hỏng.
- `ModelLimits`: `<details>` "Giới hạn của mô hình", **đóng sẵn**, khung viền mảnh cùng nền `--panel-2`; mở ra là danh sách các điều mô hình không làm. Một tiêu đề trong slot (`h4.ctl-title`) dính với thứ nó đặt tên ở bên dưới (margin dưới 0, khoảng cách của slot 4 px), không dính với thứ ở bên trên; e2e kiểm khoảng cách.
- Biểu đồ của 3.4 (ảnh trên không và cửa sổ quy trình): SVG co theo bề rộng slot, rộng tối thiểu 250 px ở 380 px; trạng thái bằng họa tiết gạch chéo, hình dấu và chữ, không chỉ màu; mỗi đường có nét riêng và một dòng chú giải; điểm đánh dấu của cài đặt hiện tại kèm chữ "trong/ngoài vùng đạt".
- **Trọng lượng chữ của kit M03:** nhãn thanh trượt và `Note` dùng Be Vietnam Pro **400** (weight 500 chưa trang nào tải). `<strong>` trong nội dung MDX (câu "Nếu làm sai:", đầu dòng của ModelLimits) vẽ ở 700, trình duyệt lấy mặt **600** (hai file, 33,5 KiB gzip), nên `/m03` tải cả 600 ngay từ bước 3.1.
- `EquationChip`: khung của phương trình duy nhất của bước; phương trình dài cuộn ngang bên trong chip (trang không cuộn ngang ở 380 px), nên chip nhận tiêu điểm bàn phím.
- Stylesheet của bộ này là `src/ui/styles/kit.css`, do trang module nạp, không phải `main.tsx`.
- Trạng thái luôn thể hiện bằng cả màu và chữ/icon (không chỉ màu); xem "Quy tắc màu trạng thái".

## Chuyển động
- Một khoảnh khắc chính mỗi bước: animation khắc, ánh sáng UV, ion rơi. Tránh hiệu ứng rải rác.
- Tôn trọng `prefers-reduced-motion`: bỏ animation, hiện ngay trạng thái cuối.

## Khả năng truy cập
- Mọi slider có label, giá trị đọc được; focus thấy rõ; tương phản chữ đạt AA trên nền vàng.
- Canvas có `aria-label` mô tả trạng thái hiện tại (ví dụ: "Cửa sổ đã thủng tới Si, đáy 820 nm").
