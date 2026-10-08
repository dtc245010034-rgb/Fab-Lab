# Fab Lab — Tiến độ

## Done
- Prototype M04 (single-file HTML) — reference/prototype-m04-etch.html
- S0.1 Khởi tạo dự án (nhánh `s0.1-scaffold`)
  - Vite 8 + TypeScript strict + React 18 + Vitest 5 + ESLint 9 (flat) + Prettier; cấu trúc thư mục theo CLAUDE.md.
  - ESLint chặn phụ thuộc ngược `ui → sim → physics` (`no-restricted-imports`) và chặn import `content-source/`.
  - Design tokens đúng `docs/DESIGN.md` (+ `--screen:#0f1320`, 3 biến font); có test khóa tên/giá trị token và cấm màu rời ngoài `tokens.css`.
  - Fonts tự host qua `@fontsource` (Saira Condensed 700/800, Be Vietnam Pro 400/500/600, JetBrains Mono 400/600), không gọi Google Fonts.
  - Khung `Viewer` + `Traveler` (6 bước, rỗng), responsive: lưới 2 cột ≥ 960 px, xếp dọc dưới 960 px (Viewer trước).
  - Kiểm tra: `npm test` (22 test), `npm run build`, `npm run lint` xanh; JS 46,7 KB gzip; ở viewport 380 px không cuộn ngang, nút bước 55×46 px.

## Next
- S0.2 Port mô hình khắc từ prototype (`src/sim/grid.ts`, `src/physics/litho.ts`, `src/physics/etch.ts`, `src/physics/constants.ts`) kèm 3 ca hồi quy.
- Khi bắt đầu có công thức/ký hiệu vật lý trong UI: kiểm tra glyph `λ`, `₂`, `°`, `×` có hiển thị đúng trong 3 font (hiện chỉ nạp subset latin, latin-ext, vietnamese; thêm `greek` cho JetBrains Mono nếu cần).
- S0.3 renderer + README/Cloudflare Pages; S0.4 Worker + Playwright (`npm run e2e`) + GitHub Actions.

## Values to verify
| Hằng số | Giá trị hiện tại | Mức | Cần đối chiếu ở |
|---|---|---|---|
| Tốc độ BOE 10:1 / 6:1 / HF 49% với SiO₂ nhiệt | 50 / 100 / 2000 nm/phút | C | Jaeger hoặc Plummer, chương khắc |
| Tốc độ, dị hướng, độ chọn lọc RIE theo công suất/áp suất | công thức tuyến tính trong prototype | C | Không có số chuẩn chung; giữ mức C, ghi rõ là minh họa |
| k₁ dùng cho CD_min | 0,6 | C | Plummer, chương quang khắc |
| NA từng nguồn sáng (g/i/KrF/ArF) | 0,45 / 0,6 / 0,8 / 0,93 | C | Chọn giá trị điển hình có nguồn |
| Độ dày resist 500 nm ở 3000 rpm | 500 nm | C | Datasheet một loại resist phổ biến |
| Tỉ lệ Si bị tiêu thụ khi oxy hóa | ≈0,44 | — | Jaeger/Plummer, chương oxy hóa |

### Giá trị thiết kế cần quyết (không phải hằng số vật lý)
Tương phản WCAG của token trạng thái trên nền vàng (tính từ giá trị trong `docs/DESIGN.md`; AA chữ thường cần ≥ 4,5):

| Token | trên `--bg` | trên `--panel` | trên `--panel-2` | AA chữ thường |
|---|---|---|---|---|
| `--muted` | 5,03 | 5,94 | 5,44 | đạt |
| `--ok` | 3,67 | 4,34 | 3,97 | không |
| `--warn` | 2,83 | 3,35 | 3,07 | không |
| `--bad` | 4,75 | 5,61 | 5,14 | đạt |

Hiện giữ nguyên giá trị token. Quy ước tạm: `--ok`/`--warn` chỉ dùng cho viền, chấm, icon, chữ lớn; chữ nhỏ của trạng thái dùng `--ink` kèm nhãn chữ. Cần quyết định có chỉnh sắc `--ok`/`--warn` (hoặc thêm biến riêng cho chữ) trước khi làm `MetricTile`/`Note`/`Grade`. Prototype đang tô chữ chỉ số bằng `--ok`/`--warn` nên sẽ không đạt AA nếu port nguyên.

## Science review
(chưa có)
