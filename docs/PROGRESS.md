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

## Next
- S0.2 Port mô hình khắc từ prototype (`src/sim/grid.ts`, `src/physics/litho.ts`, `src/physics/etch.ts`, `src/physics/constants.ts`) kèm 3 ca hồi quy.
- Khi port UI từ prototype: prototype tô chữ chỉ số bằng `--ok`/`--warn` (`.m.g b`, `.grade.g b`…); phải đổi sang `--ok-ink`/`--warn-ink`.
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

## Science review
(chưa có)
