# M07 — Capstone: chế tạo một MOSFET

## Mục tiêu
Người học đi trọn chuỗi: wafer p → oxit cổng → poly-Si cổng → quang khắc + khắc cổng → cấy nguồn/máng (tự căn chỉnh theo cổng)
→ ủ → oxit cách ly → mở tiếp xúc → kim loại → đóng gói. Lỗi ở bước trước ảnh hưởng bước sau.

## Yêu cầu kỹ thuật
- Dùng lại engine của M02–M06, không viết mô hình mới.
- "Traveler" lưu toàn bộ công thức đã chọn (localStorage, có try/catch) để xem lại và so sánh.
- Kết quả cuối: kiểm tra định tính (cổng có cách điện, nguồn/máng có nối được kim loại, kênh có bị chập).
  Không tính đặc tuyến I-V trừ khi có mô hình nguồn rõ ràng.

## Tiêu chí xong
- [ ] Hoàn thành được trọn chuỗi với công thức mặc định.
- [ ] Ít nhất 5 "lỗi kinh điển" được phát hiện và giải thích (ví dụ: mở tiếp xúc chưa thủng, lệch mask, kim loại không phủ bậc).
