# M08 — Xử lý sự cố

## Mục tiêu học
1. Phân biệt lỗi ngẫu nhiên (random) và lỗi hệ thống (systematic) qua defect map và dữ liệu test.
2. Làm đúng thứ tự: khoanh vùng (containment) → kiểm tra dữ liệu → nguyên nhân gốc → khắc phục → phòng ngừa → quyết định release/scrap.
3. Hiểu vì sao phát hiện lỗi sớm rẻ hơn nhiều so với phát hiện ở Final Test hay ở khách hàng.

## Dạng bài
Mỗi kịch bản là một "ca trực": người học nhận triệu chứng (fail rate, defect map, retest theo tester, log máy),
chọn hành động theo từng bước; mỗi lựa chọn có hệ quả (chi phí, số lô bị ảnh hưởng, thời gian).

## Kịch bản (nguyên liệu từ content-source, viết lại)
| # | Triệu chứng | Kiểu lỗi | Điểm học chính |
|---|---|---|---|
| 1 | Lỗi tập trung vòng rìa trên nhiều wafer | Systematic, thiết bị/xử lý mép | Đọc defect map |
| 2 | Fail tăng ở rìa wafer sau bảo trì máy khắc khô | Systematic, sau PM | Chạy wafer kiểm định trước khi sản xuất |
| 3 | Yield giảm dần, đếm hạt bụi tăng | Random, môi trường | Phân biệt xu hướng và đột biến |
| 4 | Retest tăng chỉ ở một tester | Hệ thống test, không phải chip | So sánh giữa các tester |
| 5 | Fail thermal tăng, X-ray thấy void dưới die | Back-end, die attach | 5-Why tới thiếu kiểm soát quy trình |
| 6 | Fail sau rung, bond lift ở mối nối đầu | Back-end, wire bond | Pull/shear test theo lô |
| 7 | Bong lớp sau HAST | Back-end, kiểm soát ẩm | MSL, baking |

## Mô hình
- Generator defect map có seed: random (Poisson đều), vòng rìa, cụm giữa, đường thẳng (vết xước), lặp theo vị trí die.
- Mỗi kịch bản là dữ liệu (JSON) + một máy trạng thái nhỏ trong src/sim/incident.ts; không cần vật lý định lượng (mức B).
- Chi phí minh họa (mức C) chỉ để so sánh tương đối, ghi rõ trên UI.

## Tiêu chí xong
- [ ] Test: generator cho đúng kiểu phân bố; bộ phân loại đơn giản nhận lại đúng kiểu với seed cố định.
- [ ] Ít nhất 5 kịch bản chơi trọn được, mỗi kịch bản có lời giải thích cuối.
- [ ] Không còn nhắc "đề cương", "slide", số bài giảng.
