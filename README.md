# Fab Lab

Khóa học web tương tác về chế tạo chip bán dẫn: người học tự chỉnh thông số từng công đoạn
(wafer → oxy hóa → quang khắc → khắc → pha tạp/màng → đóng gói) và xem mặt cắt wafer thay đổi.
Giao diện tiếng Việt. Quy tắc làm việc và kiến trúc: [`CLAUDE.md`](CLAUDE.md).

## Chạy trên máy

```bash
npm install
npm run dev      # máy chủ Vite
npm test         # Vitest, phải xanh trước mỗi commit
npm run build    # kiểm kiểu + build vào dist/
npm run lint     # ESLint + Prettier
```

Thêm `?debug=1` vào địa chỉ (ví dụ `http://localhost:5173/?debug=1`) để Viewer hiện thời gian
`runRecipe` và riêng `arrivalTime` (ms). Lần chạy đầu sau khi tải trang là lần "lạnh", chậm hơn
các lần sau; dùng con số này khi đo trên điện thoại.

## Triển khai (Cloudflare Workers static assets)

Trang là các tệp tĩnh trong `dist/`, phục vụ bằng Workers static assets (không phải Pages):
`wrangler.jsonc` khai báo `assets.directory = ./dist` và
`not_found_handling = single-page-application`. Không có Worker script, không có backend.

### Cách chính: Workers Builds (nối GitHub)

1. Trên dashboard Cloudflare: **Workers & Pages → Create → Import a repository**, chọn repo GitHub
   của dự án.
2. Tên Worker trên dashboard phải là `fab-lab`, đúng với `name` trong `wrangler.jsonc`
   (Workers Builds báo lỗi nếu hai tên khác nhau).
3. Cấu hình build:

   | Mục               | Giá trị                               |
   | ----------------- | ------------------------------------- |
   | Production branch | `main`                                |
   | Build command     | `npm ci && npm test && npm run build` |
   | Deploy command    | `npx wrangler deploy`                 |
   | Root directory    | (để trống)                            |

   Nhánh khác `main` cũng được build; lệnh deploy của các nhánh đó trên dashboard là
   `npx wrangler preview`. Lệnh này từ chối chạy nếu `wrangler.jsonc` không có khối
   `"previews": {}` (đã có sẵn, để trống là đủ), nên đừng xóa khối đó.

4. Mỗi lần push vào `main`, Cloudflare chạy build command rồi deploy command; test đỏ thì
   không deploy. Workers Builds dùng đúng phiên bản wrangler ghi trong `package.json`
   (`4.148.0`, ghim chính xác, không dùng `^`).
5. Token do Workers Builds tự cấp và giữ phía Cloudflare. Không dán token vào mã, `wrangler.jsonc`
   hay README.

**GitHub Actions ở S0.4 không deploy.** Chúng chỉ chạy lint, test, build và e2e; việc deploy
thuộc về Workers Builds, nên Actions không cần và không giữ token Cloudflare.

### Phương án phụ: dòng lệnh

Dùng để thử nhanh từ máy cá nhân:

```bash
npx wrangler login     # mở trình duyệt để đăng nhập, không cần token trong repo
npm run deploy         # = npm run build && wrangler deploy
```

Kiểm tra cấu hình mà không cần đăng nhập và không đẩy gì lên Cloudflare:

```bash
npx wrangler deploy --dry-run
```

`.wrangler/` và `.dev.vars*` nằm trong `.gitignore`; đừng commit token hay biến cục bộ.

## Cấu trúc và quy ước

Xem [`CLAUDE.md`](CLAUDE.md) (kiến trúc, quy tắc), [`docs/DESIGN.md`](docs/DESIGN.md) (giao diện),
[`docs/SCIENCE.md`](docs/SCIENCE.md) (quy tắc khoa học), [`docs/PROGRESS.md`](docs/PROGRESS.md) (tiến độ).
