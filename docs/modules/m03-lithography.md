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
| 3.3 | Nung mềm | Nhiệt độ/thời gian (mức B: quá ít → còn nhiều dung môi, bản in hỏng; quá nhiều → tính chất resist đổi, mô hình gộp thành liều hiệu dụng giảm) |
| 3.4 | Phơi sáng | Nguồn (g-line 436, i-line 365, KrF 248, ArF 193 nm), NA, liều, lệch tiêu cự, loại resist |
| 3.5 | Tráng | Thời gian tráng |
| 3.6 | Nung cứng + kiểm tra | Đo CD, góc vách resist |
| 3.7 | Căn chỉnh lớp thứ hai (Overlay) | Dịch x/y và xoay của mask so với dấu căn chỉnh (alignment mark) của lớp trước; đo overlay, quyết định rework hay cho qua |

## Mô hình
- DOF = k₂·λ/NA²; k₂ là tham số quy trình. **k₂ chỉ đọc; chỉnh được: dự kiến** (chế độ nâng cao, cần thêm `k2` vào `ExposureInput`, ngoài S1.1 bước 3b; quyết định 2026-10-22).
- k₁ **không** chỉnh được (quyết định 2026-10-21): giới hạn phân giải lấy từ mô hình ngưỡng (bề rộng nhỏ nhất in sạch ở liều ×1, tiêu điểm tốt nhất), không phải từ k₁ nhập vào. UI chỉ hiện chỉ đọc "k₁ hiệu dụng = CD_min(mô hình)·NA/λ"; số này đổi theo độ dày resist (−0,3% so với k₁ = 0,6 ở 3000 rpm, +16,6% ở 1500 rpm, −10,4% ở 6000 rpm). `k₁ = 0,6` chỉ còn là hằng số của `printLitho` (M04) và là mục tiêu hiệu chỉnh của mô hình mới.
- Ảnh trên không (aerial image): xấp xỉ Gauss một chiều theo bề rộng mask, độ nhòe tăng theo λ/NA và theo |lệch tiêu cự|/DOF.
- Ngưỡng hòa tan: resist dương tan ở nơi liều × cường độ > ngưỡng → suy ra bề rộng in được và góc vách.
- Phải tái tạo được hành vi prototype: dưới 0,7·CD_min không mở cửa sổ; 0,7–1·CD_min mở hẹp, có cặn.

- Overlay: lệch tịnh tiến + xoay áp lên toàn bộ pattern lớp 2; sai số tại cấu trúc cách tâm r là ≈ dx + r·θ.
  Vượt ngưỡng cho phép thì cửa sổ tiếp xúc lệch khỏi vùng bên dưới (dùng lại ở M07).
- Rework: tẩy resist và làm lại trước khi khắc là được; sau khi khắc thì không sửa được nữa. Đây là bài học chính của bước 3.7.

## Chỉ số
Giới hạn phân giải, DOF, CD in được, góc vách resist, cặn đáy, cảnh báo ngoài cửa sổ quy trình.

## Phán quyết (S1.1, đã duyệt 2026-10-21)
- Đạt / Biên / Hỏng, chưa có điểm số. Phán quyết hỏi "bản in có đúng cái đã yêu cầu không", như biểu đồ cửa sổ quy trình: **Đạt khi và chỉ khi biểu đồ đạt** (và overlay Đạt, khi đã đọc). Test kiểm hai chiều trên 10 000 mẫu của biểu đồ, không còn mẫu lệch.
- **`status` vật lý khác phán quyết.** `status` hỏi "có in sạch không" (ngưỡng 0,7 và 1,0·CD_min của prototype); phán quyết hỏi "có đúng kích thước không". Ví dụ 1,3·CD_min ở liều ×1: `status` là OK (in sạch), phán quyết là Biên (hẹp 15%).
- **Hỏng:** một luật cho mọi lớp chặn đường xuống đế (cặn ở chân, màng bắc cầu ở đỉnh, hoặc không có cửa sổ) dày hơn 1% độ dày resist, bất kể đỉnh có mở hay không. Khắc ướt oxit có độ chọn lọc ∞ với resist nên một hàng cặn chặn hoàn toàn. Với RIE lớp mỏng chỉ làm trễ phép khắc, và fab thật tẩy cặn bằng descum O₂; hai điều này nằm ngoài mô hình. Cũng Hỏng khi resist nung chưa đủ: đó là **luật gọn** của mô hình. Resist thật còn nhiều dung môi thì resist dương bị tráng mòn cả ở vùng không chiếu, resist âm khó liên kết ngang, và cả hai bám đế kém; mô hình không vẽ các hiệu ứng này mà coi bản in là Hỏng từ bước nung mềm.
- **Biên:** `cd-off-size`, khi cửa sổ sạch tới đáy nhưng bề rộng ở chân lệch khỏi thiết kế quá ±10%. Giữ độ lệch có dấu (nm và %) và chiều chỉnh liều. Chưa có ngưỡng Hỏng cho kích thước: fab thật coi lệch lớn là Hỏng, mô hình chưa phân cấp.
- Lệch tiêu cự, nung quá và tráng sai **giải thích** một lỗi chứ không phải lỗi của bản in: chỉ được nêu khi bản in đã có lỗi. Bản in đúng thì không có nguyên nhân nào, dù tiêu cự lệch quá ±DOF/2 (nên biểu đồ và phán quyết không mâu thuẫn).
- Mỗi nguyên nhân giữ số đi kèm (cặn, màng, overlay tệ nhất, độ lệch bề rộng). Overlay chỉ tính từ bước 3.7.

## Quy tắc cho copy (đã duyệt 2026-10-21, áp dụng khi viết `src/content/vi/m03/`)
- Gọi σ là **"độ nhòe hiệu dụng"** (gộp quang học và khuếch tán trong resist). Không gọi là PSF quang học. Có thể nói σ₀ lớn khoảng 2 lần Gauss khớp đĩa Airy (≈ 0,21·λ/NA).
- Mô hình khe đơn **không có giới hạn phân giải cứng**: liều cao hơn mở được cửa sổ nhỏ hơn. Giới hạn thật đến từ nhiễu xạ của dãy vạch theo pitch, nằm ngoài mô hình.
- Resist âm cần cửa sổ lớn hơn dương: viết "**trong mô hình này, do cách chuẩn hóa liều**". Không viết chung "resist âm phân giải kém hơn".
- k₁ hiện chỉ đọc là "k₁ hiệu dụng"; k₂ chỉ đọc; chỉnh được: dự kiến. Copy không nói k₂ "chỉnh được".
- Mọi số là "giá trị minh họa" (mức C); không trình bày như số đo thật.
- Khối **"Giới hạn của mô hình"** (hiện ở bước tương ứng, một chỗ gom đủ): một độ nhòe cho cả độ dày resist (không đổi lấy nét theo độ sâu), không có sóng đứng, resist đáp ứng như bậc thang ở một ngưỡng (độ tương phản vô hạn), không tẩy màu (bleaching) nên thành loe hơn thực tế, một chiều, thành xấp xỉ bằng đường thẳng.
- Phân biệt "trong mô hình này" với "trong fab thật" (SCIENCE.md mục 3).
- Nung mềm (nguồn: MicroChemicals, *Softbake of Photoresists*; mức B, xu hướng, không phải số liệu giáo trình): câu "resist dính vào mask" **luôn kèm "khi chiếu tiếp xúc (contact)"** trong cùng một mệnh đề, vì chỉ khi mask chạm resist mới có chuyện đó; mô hình chiếu qua thấu kính nên không có hiệu ứng này. Nung thiếu: nêu dung môi còn lại và hậu quả thật (resist dương mòn ở vùng không chiếu, resist âm khó liên kết ngang, bám đế kém), rồi nói mô hình coi bản in là Hỏng. Nung quá: **nêu hiệu ứng thật trước** (chất cảm quang PAC của resist dương phân hủy một phần, resist âm tự liên kết ngang vì nhiệt, tốc độ tan khi tráng đổi), **rồi mới** nói "mô hình gộp thành liều hiệu dụng giảm". Không viết "giảm độ nhạy" như một sự thật riêng.
- Câu "vì sao" của từng nguyên nhân của phán quyết: `src/content/vi/m03/reasons.ts`, `Record<CauseCode, (cause: Cause) => string>` để TypeScript bắt thiếu mã. Hàm nhận cả `Cause` (không chỉ số nm) vì `cd-off-size` cần dấu, phần trăm và `doseAdvice`. MDX chỉ cho bài giảng dài.
- Với `cd-off-size`, câu phải gợi ý chiều chỉnh liều theo `doseAdvice` do sim tính, không tự suy trong copy: resist dương, cửa sổ hẹp thì tăng liều, rộng thì giảm; resist âm ngược lại (cửa sổ là vạch không được chiếu sáng, thêm ánh sáng làm nó hẹp).

## Tiêu chí xong
- [x] Test quy luật: CD in được tăng theo liều (resist dương), giảm khi lệch tiêu cự lớn, không mở khi dưới ngưỡng phân giải. (S1.1 bước 1, `tests/physics/exposure.test.ts`. "Không mở khi dưới ngưỡng" được kiểm trong dải liều ×0,8–×1,2: mô hình khe đơn không có giới hạn phân giải cứng, liều cao hơn mở được cửa sổ nhỏ hơn. Thu hẹp khi |Δz| tăng được kiểm ở cả hai phía.)
- [x] Biểu đồ nhỏ "cửa sổ quy trình" (liều × tiêu cự), vùng đạt tô màu. (S1.1 bước 3b-1: `ProcessWindowChart` ở bước 3.4, vùng đạt tô bằng họa tiết gạch chéo kèm điểm đánh dấu và chữ; `tests/render/chartGeometry.test.ts`, `tests/ui/m03Charts.test.tsx`, và `e2e/m03-steps.spec.ts` kiểm vừa 380 px và điểm đánh dấu đổi theo liều. Vùng đạt là đúng nơi `passesProcessWindow` đúng.)
- [x] Đầu ra là grid đưa thẳng vào M04. (S1.1 bước 2: `m03Output` → `runEtchOnSection`, `tests/sim/m03.test.ts` và `tests/sim/etchFrom.test.ts`. Cặn và màng bắc cầu chặn khắc qua luật vật liệu thường của M04.)
- [x] Bước 3.7, phần logic: test overlay tại rìa wafer lớn hơn ở tâm khi có xoay (`tests/physics/overlay.test.ts`); rework xóa sạch resist lớp 2 (`tests/sim/m03.test.ts`). Giao diện bước 3.7 còn lại ở bước 4 của S1.1.
