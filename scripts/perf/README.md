# scripts/perf — đo thời gian tính trên Chrome desktop

Đo `runRecipe` của đúng `SimService` đang chạy trong sản phẩm (không sửa gì), chỉ bọc `compute`
bằng `performance.mark` để căn thời gian với trace Chrome. Không thuộc `npm run build` hay
`npm test`; kết quả nằm trong `scripts/perf/out/` (git bỏ qua). Số trên **điện thoại thật** lấy ở
`/?bench=1`, không ở đây.

## Chạy

Cần Chrome cài sẵn (mặc định) hoặc `npx playwright install chromium` rồi thêm `--browser=chromium`.

```bash
npx vite build --config scripts/perf/vite.config.mjs      # dựng trang đo vào scripts/perf/out/dist
node scripts/perf/run.mjs sau-worker1 --where=worker --rate=1 --loads=4
node scripts/perf/run.mjs sau-main4   --where=main   --rate=4 --loads=4
node scripts/perf/summarize.mjs scripts/perf/out/results-sau-worker1.json
```

Mỗi lần tải mở một browser context mới (như lần vào trang đầu tiên), chờ làm ấm xong rồi chạy mỗi
ca A/B/C 30 lần (`--runs`). `summarize` gộp các lần tải: 4 × 30 = 120 mẫu mỗi ô, in
trung vị / p95 / lớn nhất (cùng hàm `summarize` với `?bench=1`).

**Giả lập 4× chỉ có ở luồng chính.** Chrome không làm chậm được worker
(`Operation is only supported for pages, not workers`), nên `--rate=4` chỉ có nghĩa với
`--where=main` (cùng `SimService`, chạy ngay trên luồng chính của trang đo). Worker đo ở `--rate=1`.

Chế độ `--mode=learner` đo 6 lần gọi đầu như người học (công thức mặc định lúc tải, nghỉ
`--idle` ms, rồi `--order=BCBCB` cách nhau 300 ms); `--warm=0` tắt làm ấm để so sánh.

## Đọc trace GC

```bash
node scripts/perf/run.mjs gc-worker1 --where=worker --rate=1 --loads=3 --runs=100 --trace
node scripts/perf/analyze-trace.mjs 100 scripts/perf/out/trace-gc-worker1-{1,2,3}.json
node scripts/perf/inspect-gc.mjs scripts/perf/out/trace-gc-worker1-1.json
```

- Mỗi lần chạy có cặp mốc `run-start-N` / `run-end-N` (N đếm từ 1, gồm 9 lần làm ấm; N ≤ 9 bị bỏ).
  Script lấy luồng của các mốc đó rồi đối chiếu với sự kiện GC cùng luồng.
- "Chậm" = lâu hơn 1,5 × trung vị của ca. `analyze-trace` in, cho mẫu chậm và mẫu thường, bao nhiêu
  lần chạy trùng một Major GC (mark-compact), một `Marking`, một scavenge (`MinorGC`).
- `MinorGC` là scavenge của bộ nhớ trẻ; `MajorGC` kiểu "finalize incremental marking via task" cỡ
  1 ms nằm **giữa** hai lần chạy là vô hại. Dấu hiệu xấu là một lần chạy chứa cả chuỗi scavenge
  liên tiếp (`inspect-gc` in chuỗi đó cho vài lần chạy chậm nhất).
- Trace làm số đo chậm đi chút; dùng trace để tìm nguyên nhân, dùng lần chạy không trace để lấy số.

## So trước/sau một thay đổi

Checkout từng bản, dựng lại trang, chạy cùng cấu hình **trong cùng một phiên** (số đo giữa các
ngày hoặc khi máy đang bận lệch nhau vài phần trăm). Mẫu vọt rất thưa (vài mẫu trong 900 lần
chạy) nên so cột "lớn nhất" và trace, đừng chỉ so p95. Kết quả và kết luận đã có ở
`docs/PROGRESS.md`, mục "Worker, làm ấm và GC".
