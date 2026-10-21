# M03 — Quang khắc (Lithography)

## Mục tiêu học
1. Vì sao bước sóng ngắn hơn và NA lớn hơn thì in được chi tiết nhỏ hơn, và cái giá là độ sâu tiêu cự giảm.
2. Liều chiếu và tiêu cự ảnh hưởng hình dạng resist thế nào.
3. Khác nhau giữa resist dương và âm.

## Các bước
| Bước | Nội dung | Thông số |
|---|---|---|
| 3.1 | Làm sạch, phủ chất bám dính (HMDS) | — (giải thích ngắn) |
| 3.2 | Phủ quay | Tốc độ quay → độ dày |
| 3.3 | Nung mềm | Nhiệt độ/thời gian (mức B: quá ít → resist dính mask, quá nhiều → giảm độ nhạy) |
| 3.4 | Phơi sáng | Nguồn (g-line 436, i-line 365, KrF 248, ArF 193 nm), NA, liều, lệch tiêu cự, loại resist |
| 3.5 | Tráng | Thời gian tráng |
| 3.6 | Nung cứng + kiểm tra | Đo CD, góc vách resist |
| 3.7 | Căn chỉnh lớp thứ hai (Overlay) | Dịch x/y và xoay của mask so với dấu căn chỉnh (alignment mark) của lớp trước; đo overlay, quyết định rework hay cho qua |

## Mô hình
- DOF = k₂·λ/NA²; k₂ là tham số quy trình, người học chỉnh được ở chế độ nâng cao.
- k₁ **không** chỉnh được (quyết định 2026-10-21): giới hạn phân giải lấy từ mô hình ngưỡng (bề rộng nhỏ nhất in sạch ở liều ×1, tiêu điểm tốt nhất), không phải từ k₁ nhập vào. UI chỉ hiện chỉ đọc "k₁ hiệu dụng = CD_min(mô hình)·NA/λ"; số này đổi theo độ dày resist (−0,3% so với k₁ = 0,6 ở 3000 rpm, +16,6% ở 1500 rpm, −10,4% ở 6000 rpm). `k₁ = 0,6` chỉ còn là hằng số của `printLitho` (M04) và là mục tiêu hiệu chỉnh của mô hình mới.
- Ảnh trên không (aerial image): xấp xỉ Gauss một chiều theo bề rộng mask, độ nhòe tăng theo λ/NA và theo |lệch tiêu cự|/DOF.
- Ngưỡng hòa tan: resist dương tan ở nơi liều × cường độ > ngưỡng → suy ra bề rộng in được và góc vách.
- Phải tái tạo được hành vi prototype: dưới 0,7·CD_min không mở cửa sổ; 0,7–1·CD_min mở hẹp, có cặn.

- Overlay: lệch tịnh tiến + xoay áp lên toàn bộ pattern lớp 2; sai số tại cấu trúc cách tâm r là ≈ dx + r·θ.
  Vượt ngưỡng cho phép thì cửa sổ tiếp xúc lệch khỏi vùng bên dưới (dùng lại ở M07).
- Rework: tẩy resist và làm lại trước khi khắc là được; sau khi khắc thì không sửa được nữa. Đây là bài học chính của bước 3.7.

## Chỉ số
Giới hạn phân giải, DOF, CD in được, góc vách resist, cặn đáy, cảnh báo ngoài cửa sổ quy trình.

## Tiêu chí xong
- [x] Test quy luật: CD in được tăng theo liều (resist dương), giảm khi lệch tiêu cự lớn, không mở khi dưới ngưỡng phân giải. (S1.1 bước 1, `tests/physics/exposure.test.ts`. "Không mở khi dưới ngưỡng" được kiểm trong dải liều ×0,8–×1,2: mô hình khe đơn không có giới hạn phân giải cứng, liều cao hơn mở được cửa sổ nhỏ hơn. Thu hẹp khi |Δz| tăng được kiểm ở cả hai phía.)
- [ ] Biểu đồ nhỏ "cửa sổ quy trình" (liều × tiêu cự), vùng đạt tô màu.
- [ ] Đầu ra là grid đưa thẳng vào M04.
- [ ] Bước 3.7: test overlay tại rìa wafer lớn hơn ở tâm khi có xoay; rework xóa sạch resist lớp 2. (Nửa đầu đã có ở `tests/physics/overlay.test.ts`, S1.1 bước 1; rework thuộc state machine ở bước 2.)
