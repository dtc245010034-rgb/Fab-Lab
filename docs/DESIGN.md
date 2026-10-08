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
- Số liệu, đơn vị, phương trình: JetBrains Mono, `tabular-nums`.

## Bố cục
- Desktop: Viewer (trái, co giãn) + Traveler (phải, 380 px). Dưới 960 px: xếp dọc, Viewer trước.
- Traveler: thanh 6 bước ở trên → tiêu đề bước → cơ chế → phương trình → điều khiển → ghi chú → nút.
- Viewer: tiêu đề mặt cắt, canvas, chú giải vật liệu, hàng chỉ số (metric tiles).

## Thành phần
- `StepNav`, `ParamSlider` (nhãn + giá trị có đơn vị), `Segmented`, `MetricTile` (ok/warn/bad),
  `Note` (ok/warn/bad), `Grade` (điểm lớn + một câu giải thích), `EquationChip`.
- Trạng thái luôn thể hiện bằng cả màu và chữ/icon (không chỉ màu); xem "Quy tắc màu trạng thái".

## Chuyển động
- Một khoảnh khắc chính mỗi bước: animation khắc, ánh sáng UV, ion rơi. Tránh hiệu ứng rải rác.
- Tôn trọng `prefers-reduced-motion`: bỏ animation, hiện ngay trạng thái cuối.

## Khả năng truy cập
- Mọi slider có label, giá trị đọc được; focus thấy rõ; tương phản chữ đạt AA trên nền vàng.
- Canvas có `aria-label` mô tả trạng thái hiện tại (ví dụ: "Cửa sổ đã thủng tới Si, đáy 820 nm").
