# Fab Lab — Các phiên làm việc với Claude Code

## Chuẩn bị (một lần)
1. Tạo thư mục dự án, chép toàn bộ bộ file này vào (CLAUDE.md, `.claude/`, `docs/`, `reference/`), rồi `git init`.
2. Model và effort đã đặt trong `.claude/settings.json`: Sonnet 5.5, effort `xhigh`.
   Nếu phiên mở ra không đúng, chạy: `claude --model sonnet --effort xhigh` (chỉ áp dụng cho phiên đó),
   hoặc trong phiên gõ `/model` rồi `/effort xhigh`.
3. Mức `xhigh` tốn token hơn `medium`/`high`. Nên dùng cho phiên viết mô hình vật lý.
   Với phiên chỉ chỉnh giao diện/copy, có thể hạ `/effort high` để tiết kiệm.

## Quy tắc mỗi phiên
- Một phiên = một mục dưới đây. Mở phiên mới (`/clear`) khi sang mục khác.
- Dán đúng prompt của mục đó. Để Claude lập plan trước, bạn duyệt rồi mới cho làm.
- Kết thúc phiên: `npm test && npm run build` xanh, PROGRESS.md đã cập nhật, đã commit.

---

### S0.1 — Khởi tạo dự án
```
Đọc CLAUDE.md, docs/PLAN.md mục "Giai đoạn 0" và docs/DESIGN.md.
Khởi tạo dự án Vite + TypeScript strict + React 18 + Vitest + ESLint/Prettier theo đúng cấu trúc thư mục trong CLAUDE.md.
Tạo design tokens và fonts theo DESIGN.md, layout khung Viewer + Traveler rỗng, responsive tới 380px.
Tạo docs/PROGRESS.md với các mục: Done, Next, Values to verify.
Chưa viết mô hình vật lý. Lập plan trước, chờ tôi duyệt.
```

### S0.2 — Port mô hình khắc từ prototype
```
Đọc CLAUDE.md, docs/SCIENCE.md, docs/modules/m04-etch.md và reference/prototype-m04-etch.html.
Port phần lưới, litho đơn giản và arrival-time Dijkstra sang src/sim/grid.ts, src/physics/litho.ts, src/physics/etch.ts
dưới dạng hàm thuần có kiểu. Mọi hằng số vào src/physics/constants.ts với tier 'C' (illustrative).
Viết test: 3 ca hồi quy trong m04-etch.md và các test quy luật ở SCIENCE.md mục 5.
Không làm UI. Đo thời gian tính lại và ghi vào PROGRESS.md.
```

### S0.3 — Renderer mặt cắt + deploy
```
Đọc CLAUDE.md, docs/DESIGN.md. Viết src/render/canvas2d/crossSection.ts vẽ grid (pixel sắc nét, không làm mịn),
chú giải vật liệu, thước đo 500 nm, đường kích thước đỉnh/đáy. Gắn vào Viewer với dữ liệu mặc định từ S0.2.
Thêm cấu hình Cloudflare Workers static assets (wrangler.jsonc) và hướng dẫn deploy ngắn trong README.md.
```

### S0.4 — Web Worker + CI + e2e
```
Đọc CLAUDE.md. Đưa src/sim và src/physics chạy trong src/workers/sim.worker.ts qua Comlink.
UI gửi thông số, nhận grid kết quả; giữ kết quả cũ trên màn hình khi đang tính lại.
Thêm Playwright với 1 smoke test (load trang, chạy công thức mặc định M04, kiểm tra hiện điểm).
Thêm GitHub Actions chạy lint, test, build, e2e. Ghi thời gian tính lại đo được vào PROGRESS.md.
```

### S1.1 — M03 quang khắc
```
Đọc CLAUDE.md, docs/SCIENCE.md mục M03, docs/modules/m03-lithography.md.
Làm physics trước (aerial image + ngưỡng hòa tan + DOF) kèm test quy luật, sau đó các bước UI 3.1–3.6.
Gồm cả bước 3.7 Overlay. Đầu ra phải là grid đưa thẳng vào M04. Copy tiếng Việt viết vào src/content/vi/m03/.
```

### S1.2 — M04 khắc ướt + RIE (UI)
```
Đọc CLAUDE.md, docs/modules/m04-etch.md. Xây bước 4.1, 4.3, 4.5 (Endpoint), 4.6 dùng engine từ S0.2: điều khiển, animation khắc,
chỉ số, chấm điểm và câu giải thích nguyên nhân. Bám sát hành vi của reference/prototype-m04-etch.html.
```

### S1.3 — M04 KOH + DRIE Bosch
```
Đọc CLAUDE.md, docs/SCIENCE.md mục M04, docs/modules/m04-etch.md bước 4.2 và 4.4.
Viết mô hình KOH phụ thuộc hướng (test vách 54,74° ± 3°) và Bosch mô phỏng theo chu kỳ (test số scallop = số chu kỳ).
Physics và test trước, UI sau.
```

### S1.4 — Rà soát khoa học MVP
```
Đọc docs/SCIENCE.md. Rà toàn bộ src/content/vi/m03/, m04/ và src/physics/constants.ts.
Liệt kê (không sửa) mọi câu có thể sai hoặc phóng đại, mọi hằng số chưa có nguồn, kèm đề xuất sửa.
Ghi kết quả vào docs/PROGRESS.md mục "Science review".
```
Sau phiên này, **bạn** đối chiếu danh sách với giáo trình và đưa số liệu đã kiểm tra vào phiên tiếp theo.

### S2.x — M02, M05 · S3.x — M01, M06 · S4.x — M07 và ra mắt
Dùng cùng khuôn prompt:
```
Đọc CLAUDE.md, docs/SCIENCE.md mục <Mxx>, docs/modules/<file>.md.
Physics + test trước (hằng số mức A phải kèm nguồn tôi cung cấp dưới đây; nếu thiếu thì để mức C và ghi vào PROGRESS.md),
sau đó sim, render, UI, copy tiếng Việt. Kết thúc bằng checklist "Tiêu chí xong" của module.
Số liệu đã kiểm tra: <dán bảng số liệu bạn tra từ sách>
```

### S3b — M08 Xử lý sự cố
```
Đọc CLAUDE.md, docs/modules/m08-incident.md, content-source/README.md.
Lấy chuỗi lan truyền lỗi và tình huống trong content-source/semi-intro-data.json làm nguyên liệu, viết lại bằng lời mới.
Physics/sim trước: generator defect map có seed cho từng mẫu phân bố, kèm test phân loại. Sau đó UI kịch bản.
```

### S4.2 — Backend góp ý
```
Đọc CLAUDE.md, docs/PLAN.md Giai đoạn 4. Tạo Cloudflare Worker + D1: POST /feedback (module, bước, nội dung, công thức JSON),
validate đầu vào, giới hạn tần suất theo IP, không lưu dữ liệu cá nhân. Nút "Báo lỗi khoa học" trong mỗi bước.
```

## Mẹo
- Khi Claude đề xuất đổi phương trình hay số liệu: yêu cầu nó trích mục SCIENCE.md liên quan trước khi sửa.
- Nếu một phiên đi lệch phạm vi: dừng, `/clear`, dán lại prompt kèm câu "chỉ sửa các file sau: …".
- Giữ prototype trong `reference/` làm chuẩn so sánh hành vi, không xóa.
