# Fab Lab — Kế hoạch tổng thể

## 1. Sản phẩm là gì
Một website học chế tạo chip bằng cách **tự tay làm**. Mỗi module là một công đoạn thật trong fab.
Người học chỉnh thông số (nhiệt độ, thời gian, bước sóng, công suất, áp suất…) và thấy mặt cắt wafer
thay đổi theo đúng cơ chế vật lý. Cuối mỗi module có chấm điểm "yield" và giải thích vì sao đạt hay hỏng.

**Người dùng mục tiêu:** sinh viên điện tử, kỹ thuật máy tính, vật liệu; người đi làm muốn hiểu ngành bán dẫn.
**Khác biệt so với TCAD (Synopsys, Silvaco, nanoHUB):** tiếng Việt, không cần cài đặt, học qua thao tác,
đúng về định tính và minh bạch về giới hạn của mô hình.

## 2. Phạm vi các module

| # | Module | Người học làm gì | Mô hình cốt lõi |
|---|---|---|---|
| M01 | Wafer | Kéo phôi Czochralski, cắt lát, đánh bóng; chọn loại pha tạp | Định hướng tinh thể, điện trở suất theo nồng độ |
| M02 | Oxy hóa | Chọn khô/ướt, nhiệt độ, thời gian; xem màu giao thoa của lớp oxit | Deal–Grove |
| M03 | Quang khắc | Phủ, nung mềm, phơi sáng (λ, NA, liều, tiêu cự), tráng; resist dương/âm | Rayleigh (CD, DOF), độ dày ∝ ω^-1/2 |
| M04 | Khắc | Khắc ướt (BOE, KOH), khắc khô (RIE), DRIE Bosch | Mặt khắc dị hướng theo vật liệu (đã có prototype) |
| M05 | Pha tạp & màng | Cấy ion + ủ; CVD/PVD/ALD; CMP | Gauss (Rp, ΔRp), khuếch tán erfc/Gauss, độ phủ bậc, Preston |
| M06 | Đóng gói & kiểm tra | Probe wafer, cắt die, gắn die, wire bond hoặc flip-chip, đúc vỏ, test cuối | Mô hình yield Poisson, so sánh kiểu đóng gói |
| M08 | Xử lý sự cố | Đọc defect map, khoanh vùng lô, tìm nguyên nhân gốc (5-Why, 4M), chọn khắc phục và phòng ngừa | Mẫu phân bố lỗi (random/systematic), chuỗi lan truyền lỗi |
| M07 | Capstone | Chế tạo trọn một MOSFET đơn giản, nối kết quả các module | Chuỗi quy trình, lỗi tích lũy |

## 3. Lộ trình theo giai đoạn
Ước lượng cho người làm bán thời gian (khoảng 8–10 giờ/tuần). Mỗi giai đoạn có tiêu chí "xong" rõ ràng.

### Giai đoạn 0 — Nền móng (tuần 1)
- Khởi tạo Vite + TS + React + Vitest + ESLint/Prettier, cấu trúc thư mục như CLAUDE.md.
- Design tokens, fonts, layout khung "Traveler + Viewer" từ prototype.
- Port mô hình khắc của `reference/prototype-m04-etch.html` sang `src/physics/etch.ts` + `src/sim/grid.ts`, kèm test.
- Chạy physics/sim trong Web Worker (Comlink); UI không bị giật khi kéo thanh trượt.
- CI GitHub Actions (lint, test, build, e2e); Playwright smoke test đầu tiên.
- Deploy bản rỗng lên Cloudflare Workers (static assets, build bằng Workers Builds), bật Cloudflare Web Analytics (không cookie).
**Xong khi:** `npm test` và `npm run build` xanh; trang khung chạy trên điện thoại; test khắc tái tạo
được 3 ca chuẩn (xem `docs/modules/m04-etch.md`).

**Trạng thái: hoàn tất 2026-10-10** (S0.1–S0.5; chi tiết và số đo ở `docs/PROGRESS.md`). `npm test`,
`npm run build`, `npm run lint` và `npm run e2e` xanh; khung chạy trên điện thoại (Samsung S20 FE, đo
ở S0.5); 3 ca chuẩn pass. Hai việc trong danh sách ở trên là cấu hình trên dashboard Cloudflare nên
repo không chứng minh được: deploy thật bằng Workers Builds và bật Web Analytics (xem mục Next của
`PROGRESS.md`).

### Giai đoạn 1 — MVP: M03 + M04 (tuần 2–4)
- M03 quang khắc đầy đủ, thêm tiêu cự/DOF, resist âm và **căn chỉnh Overlay** giữa hai lớp.
- M04 khắc: ướt BOE, ướt KOH trên Si(100) (vách 54,74°), RIE, DRIE Bosch, **Endpoint Detection** (tín hiệu OES).
- Chấm điểm + phần "vì sao" sau mỗi lần chạy.
- Đối chiếu toàn bộ hằng số với giáo trình (xem SCIENCE.md mục 4).
**Xong khi:** 3 người chưa học bán dẫn chơi thử, giải thích lại được khác biệt ướt/khô bằng lời của họ.

### Giai đoạn 2 — M02 + M05 (tuần 5–8)
- M02 Deal–Grove, bảng màu giao thoa oxit.
- M05 cấy ion, ủ khuếch tán, lắng đọng, CMP.
**Xong khi:** test tham chiếu Deal–Grove và profile cấy ion khớp số liệu giáo trình trong sai số ghi ở SCIENCE.md.

### Giai đoạn 3 — M01 + M06 (tuần 9–11)
- Cảnh 3D (Three.js) kéo phôi, cắt wafer; dây chuyền đóng gói.
- Yield theo mật độ khuyết tật và diện tích die.

### Giai đoạn 3b — M08 Xử lý sự cố (tuần 11–12)
- Dùng chuỗi lan truyền lỗi và các tình huống trong `content-source/` làm kịch bản (viết lại, không chép).
- Trò chơi đọc defect map + quy trình Containment → Data check → Root cause → Corrective/Preventive.

### Giai đoạn 4 — M07 Capstone + ra mắt (tuần 13–15)
- Chuỗi quy trình chế tạo MOSFET, lưu "traveler" (phiếu công đoạn) để xem lại.
- Tên miền, SEO cơ bản, trang giới thiệu, nguồn tham khảo.
- Bản tiếng Anh (tùy chọn).
- Backend nhỏ đầu tiên: form góp ý / báo lỗi khoa học (Cloudflare Workers + D1).
- (Tùy chọn, sau ra mắt) Gia sư AI qua Worker proxy giữ API key, có giới hạn tần suất,
  chỉ trả lời dựa trên SCIENCE.md và kết quả mô phỏng của người học.

## 4. Cách dùng Claude Code
- Model và effort đặt trong `.claude/settings.json` (Sonnet 5.5, effort `xhigh`).
  CLAUDE.md **không** đặt được model hay effort.
- Mỗi phiên = một mục trong `docs/SESSIONS.md`. Copy prompt của phiên đó vào Claude Code.
- Sau mỗi phiên, cập nhật `docs/PROGRESS.md` và commit.
- Phần vật lý: **bạn tự duyệt** trước khi merge. Đây là phần AI dễ sai nhất mà nhìn qua lại khó phát hiện.

## 5. Rủi ro chính và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Sai cơ chế, sai số liệu | Quy tắc "không số bịa" trong CLAUDE.md, test tham chiếu, đối chiếu giáo trình, nhãn "minh họa" |
| Phạm vi phình to | Làm MVP M03+M04 trước, chỉ mở module mới khi module cũ đạt tiêu chí |
| Chậm trên điện thoại | Ngân sách hiệu năng trong CLAUDE.md, chỉ tính lại khi đổi thông số |
| AI sửa lan sang module khác | Một module mỗi phiên, quy tắc "không refactor ngoài phạm vi" |
| Bản quyền nội dung | Tự viết lại, trích nguồn, không chép hình hay đoạn văn từ sách |

## 6. Triển khai
Cloudflare Workers static assets (`wrangler.jsonc`, thư mục `dist/`; Workers Builds nối GitHub chạy `npm ci && npm test && npm run build` rồi `npx wrangler deploy`), gắn tên miền riêng.
Không có backend tới Giai đoạn 4 nên không cần Tunnel. Tiến độ người học lưu bằng localStorage (try/catch),
kèm nút xuất/nhập file "traveler" JSON để không mất tiến độ khi xóa dữ liệu trình duyệt.
