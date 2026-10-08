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
- S0.2 Port mô hình khắc từ prototype (nhánh `s0.2-etch-port`, chưa merge vào `main`)
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

## Next
- S0.2 (còn lại trong phiên): tối ưu `arrivalTime` (tùy chọn `maxTimeMin` = giá trị lớn nhất của thanh trượt thời gian, heap vừa đủ) ở commit riêng, đo lại, cập nhật bảng bên dưới.
- Đo thời gian tính lại trên điện thoại thật sau khi deploy ở S0.3, rồi mới tick "< 50 ms trên điện thoại" trong `m04-etch.md`.
- Còn lại của M04 (ngoài S0.2): KOH, Bosch, Endpoint (S1.3), UI và chấm điểm (S1.2).
- Khi port UI từ prototype: prototype tô chữ chỉ số bằng `--ok`/`--warn` (`.m.g b`, `.grade.g b`…); phải đổi sang `--ok-ink`/`--warn-ink`.
- Khi bắt đầu có công thức/ký hiệu vật lý trong UI: kiểm tra glyph `λ`, `₂`, `°`, `×` có hiển thị đúng trong 3 font (hiện chỉ nạp subset latin, latin-ext, vietnamese; thêm `greek` cho JetBrains Mono nếu cần).
- S0.3 renderer + README/Cloudflare Pages; S0.4 Worker + Playwright (`npm run e2e`) + GitHub Actions.

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
(mục "< 50 ms trên điện thoại" trong `m04-etch.md` chưa tick; đo sau khi deploy ở S0.3).

**Bản (a): port trung thành, chưa tối ưu**

| Ca | Prototype (Node, chỉ arrival) | Node: arrival / toàn bộ | Chrome 1×: arrival / toàn bộ | Chrome 4×: arrival / toàn bộ |
|---|---|---|---|---|
| A ướt BOE 6:1, cửa sổ 800 nm | 5,2 | 3,8 / 4,1 | 3,7 / 3,6 | 19,2 / 16,9 |
| B RIE 200 W, 30 mTorr, 800 nm | 18,3 | 11,5 / 11,8 | 11,3 / 11,5 | 52,8 / 53,1 |
| C RIE 80 W, 180 mTorr, 400 nm | 18,1 | 11,7 / 11,9 | 11,5 / 11,7 | 57,8 / 55,4 |

Ở CPU 4×, ca B và C vượt 50 ms, nên cần bước tối ưu (b).

## Science review
(chưa có)
