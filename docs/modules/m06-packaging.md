# M06 — Kiểm tra và đóng gói

## Mục tiêu học
1. Vì sao test chip ngay trên wafer trước khi cắt.
2. Yield phụ thuộc mật độ khuyết tật và diện tích die thế nào.
3. Wire bonding và flip-chip khác nhau ra sao.
4. Các bước biến một die trần thành con chip có chân.

## Các bước
| Bước | Nội dung | Thông số |
|---|---|---|
| 6.1 | Probe wafer (bản đồ die đạt/hỏng) | Mật độ khuyết tật D₀, kích thước die |
| 6.2 | Mài mỏng mặt sau, cắt die | Kiểu cắt (lưỡi cưa / laser) – mức B |
| 6.3 | Gắn die lên khung/đế | — |
| 6.4 | Kết nối | Wire bond (vàng/đồng) hoặc flip-chip (bump) |
| 6.5 | Đúc vỏ, mạ chân, đánh dấu | — |
| 6.6 | Test cuối, burn-in | — |

## Mô hình
- Wafer map: khuyết tật rải ngẫu nhiên có seed; yield thực nghiệm so với Y = exp(−D₀·A).
- Số die trên wafer theo đường kính và kích thước die (công thức gần đúng có nguồn).
- So sánh đóng gói ở mức B (số I/O, đường tín hiệu, tản nhiệt), không đưa số liệu thị trường.

## Tiêu chí xong
- [ ] Test: yield mô phỏng hội tụ về exp(−D₀·A) khi số die lớn (sai số thống kê chấp nhận được).
- [ ] Cảnh 3D wire bond và flip-chip, xoay xem được.
