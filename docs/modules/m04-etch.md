# M04 — Khắc (Etch)

## Mục tiêu học
Sau module này người học giải thích được:
1. Vì sao khắc ướt đẳng hướng và tạo undercut, còn RIE khắc gần thẳng đứng.
2. Đánh đổi trong RIE: công suất ↔ độ chọn lọc với resist; áp suất ↔ độ dị hướng.
3. Vì sao KOH tạo vách 54,74° trên Si(100).
4. DRIE Bosch đạt rãnh sâu, vách thẳng bằng cách nào, và "scallop" là gì.

## Đầu vào
Mặt cắt sau M03 (hoặc mặc định: Si + SiO₂ 300 nm + resist đã mở cửa sổ).

## Các bước
| Bước | Nội dung | Thông số người học chỉnh |
|---|---|---|
| 4.1 | Khắc ướt SiO₂ | Dung dịch (BOE 10:1, BOE 6:1, HF 49%), thời gian |
| 4.2 | Khắc ướt Si bằng KOH | Thời gian; cần mặt nạ SiO₂ hoặc nitride |
| 4.3 | RIE SiO₂ | Công suất RF, áp suất, thời gian |
| 4.4 | DRIE Bosch (Si sâu) | Số chu kỳ, tỉ lệ thời gian khắc/phủ |
| 4.5 | Endpoint Detection | Theo dõi tín hiệu phát xạ quang (OES) theo thời gian, bấm dừng khi tín hiệu đổi; hoặc bật dừng tự động + % khắc dư |
| 4.6 | Bóc resist + chấm điểm | — |

## Mô hình (port từ prototype)
- Lưới 2D, mỗi ô 10 nm (cho phép đổi). Vật liệu: AIR, SI, OX, PR (thêm NITRIDE cho KOH).
- `arrivalTime(grid, rates)`: Dijkstra 16 hướng từ mọi ô AIR. Chi phí bước (dx, dy) vào ô vật liệu m:
  `cell · sqrt((dx/lat_m)² + (dy/vert_m)²)`, với `vert_m` = tốc độ dọc khi đi xuống, = tốc độ ngang khi đi lên.
  `rate_m = rate / selectivity_m`. Ô bị khắc khi `arrival ≤ t`.
- KOH: tốc độ phụ thuộc hướng mạng. Cách đơn giản: chi phí theo góc bước, cực đại quanh hướng {111} (54,74° so với mặt).
  Kiểm tra bằng test: vách đạt 54,74° ± 3°.
- Bosch: mô phỏng rời rạc từng chu kỳ (khắc đẳng hướng ngắn → phủ thụ động thành → ion phá lớp phủ ở đáy).
  Không dùng Dijkstra một lần cho Bosch.
- Endpoint: tín hiệu OES của sản phẩm phản ứng tỉ lệ với diện tích oxit đang bị khắc trong cửa sổ;
  tụt xuống khi đáy chạm Si. Nếu độ dày oxit không đều trên wafer (tham số), tín hiệu tụt dần thay vì đột ngột,
  nên cần khắc dư. Hình dạng đường cong ở mức B.
- Mọi tốc độ hiện ở mức C (minh họa) cho tới khi đối chiếu giáo trình.

## Chỉ số hiển thị
Thủng tới Si (có/chưa), đáy/thiết kế (nm), đỉnh (nm), undercut (nm), góc vách (°), lẹm Si (nm), resist còn lại (nm).

## Chấm điểm (giữ như prototype, chỉnh hệ số khi playtest)
- Hỏng ngay: không có cửa sổ; resist bị ăn hết; chưa thủng oxit.
- Trừ điểm: |sai số đáy| ×120; undercut > 60 nm: (u−60)/10; lẹm Si > 20 nm: (d−20)/2; góc < 80°: (80−góc)×0,3; có cặn đáy: 8.
- ≥85 Đạt, 60–84 Biên, <60 Hỏng. Luôn kèm một câu nói rõ nguyên nhân chính.

## Ca hồi quy (dùng làm test khi port, hằng số giữ như prototype)
Điều kiện litho chung cho cả 3 ca: resist quay 3000 rpm (500 nm), nguồn i-line, liều ×1, lưới mặc định 260×150 ô, 10 nm/ô.
Chỉ khác cửa sổ thiết kế như ghi trong bảng.

| Ca | Công thức | Kỳ vọng (±20 nm, ±2°) |
|---|---|---|
| A | Ướt BOE 6:1 (100 nm/phút), 3,3 phút, cửa sổ 800 nm | thủng; đáy ≈1040; đỉnh ≈1440; undercut ≈320; góc ≈56° |
| B | RIE 200 W, 30 mTorr, 4,6 phút, cửa sổ 800 nm | thủng; đỉnh ≈820; đáy ≈800; góc ≈88° |
| C | RIE 80 W, 180 mTorr, 9 phút, cửa sổ 400 nm | thủng; undercut ≈260; góc ≈68° |

## Tiêu chí xong
- [x] 3 ca hồi quy pass; test quy luật trong SCIENCE.md mục 5 pass.
- [ ] Tính lại < 50 ms ở lưới 260×150 trên điện thoại tầm trung. (Đã đo: Chrome với CPU 4× chậm, trung vị 15–21 ms, tối đa 38 ms; xem `PROGRESS.md`. Lần chạy lạnh đầu tiên sau khi tải trang đo được ≈ 30 ms trên Chrome desktop, vượt xa số đo nóng. Chờ đo điện thoại thật bằng `/?debug=1` sau khi deploy.)
- [ ] KOH cho vách 54,74° ± 3°; Bosch hiện scallop, số gợn = số chu kỳ.
- [ ] Endpoint: dừng đúng lúc cho điểm cao hơn dừng theo thời gian cố định khi độ dày oxit không đều.
- [ ] Mọi câu giải thích đã đọc lại đối chiếu với SCIENCE.md.
