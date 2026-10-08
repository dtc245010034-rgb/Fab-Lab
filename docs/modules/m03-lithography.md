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
- CD_min = k₁·λ/NA; DOF = k₂·λ/NA² (k₁, k₂ là tham số quy trình, hiển thị cho người học chỉnh ở chế độ nâng cao).
- Ảnh trên không (aerial image): xấp xỉ Gauss một chiều theo bề rộng mask, độ nhòe tăng theo λ/NA và theo |lệch tiêu cự|/DOF.
- Ngưỡng hòa tan: resist dương tan ở nơi liều × cường độ > ngưỡng → suy ra bề rộng in được và góc vách.
- Phải tái tạo được hành vi prototype: dưới 0,7·CD_min không mở cửa sổ; 0,7–1·CD_min mở hẹp, có cặn.

- Overlay: lệch tịnh tiến + xoay áp lên toàn bộ pattern lớp 2; sai số tại cấu trúc cách tâm r là ≈ dx + r·θ.
  Vượt ngưỡng cho phép thì cửa sổ tiếp xúc lệch khỏi vùng bên dưới (dùng lại ở M07).
- Rework: tẩy resist và làm lại trước khi khắc là được; sau khi khắc thì không sửa được nữa. Đây là bài học chính của bước 3.7.

## Chỉ số
Giới hạn phân giải, DOF, CD in được, góc vách resist, cặn đáy, cảnh báo ngoài cửa sổ quy trình.

## Tiêu chí xong
- [ ] Test quy luật: CD in được tăng theo liều (resist dương), giảm khi lệch tiêu cự lớn, không mở khi dưới ngưỡng phân giải.
- [ ] Biểu đồ nhỏ "cửa sổ quy trình" (liều × tiêu cự), vùng đạt tô màu.
- [ ] Đầu ra là grid đưa thẳng vào M04.
- [ ] Bước 3.7: test overlay tại rìa wafer lớn hơn ở tâm khi có xoay; rework xóa sạch resist lớp 2.
