# content-source/

Dữ liệu thô để viết nội dung, **không** import trực tiếp vào `src/`.

## semi-intro-data.json
Tách từ bộ ôn thi "Nhập môn Vi mạch Bán dẫn" (ghi chú cá nhân từ bài giảng b1–b8).
41 khối lý thuyết, 7+6 chuỗi lan truyền lỗi Front-end/Back-end, 21 cặp dễ nhầm, 73 thuật ngữ, 98 câu trắc nghiệm, 7 tình huống sự cố.

Quy tắc khi dùng (bổ sung cho CLAUDE.md):
- Bỏ hoặc viết lại mọi mục `courseSpecific: true` (nhắc "đề cương", "slide", số bài giảng).
- Viết lại bằng lời của dự án, không chép nguyên văn bài giảng.
- Số liệu thị trường (thị phần, giá máy, chi phí fab, yield theo node) là số thay đổi theo thời gian: chỉ đưa vào UI khi có nguồn + ngày.
- Các điểm cần sửa trước khi dùng:
  1. "Wet etch = đẳng hướng": đúng với HF/BOE, sai với KOH/TMAH trên Si (khắc ướt dị hướng theo mặt tinh thể). Fab Lab M04 có KOH nên phải nói rõ.
  2. "Giới hạn quantum tunneling ở ~2nm": "2nm" là tên node thương mại, không phải kích thước vật lý của cổng.
  3. Định luật Moore: bài báo 1965 nói gấp đôi mỗi năm, Moore sửa thành ~2 năm vào 1975; "18 tháng" không phải con số của Moore.
  4. Thứ tự Front-end tuyến tính 7 bước là bản rút gọn để thi; trong Fab Lab mô tả theo chu kỳ lặp từng lớp, CMP xuất hiện nhiều lần.
