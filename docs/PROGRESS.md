# Fab Lab — Giá trị cần đối chiếu và rà khoa học

Trạng thái và bước tiếp: `docs/STATUS.md`. Lịch sử và số đo hiệu năng (mục "Hiệu năng tính lại M04", gồm "Worker, làm ấm và GC"): `docs/history/PROGRESS-s0-s1.1.md`.

## Values to verify
| Hằng số | Giá trị hiện tại | Mức | Cần đối chiếu ở |
|---|---|---|---|
| Tốc độ BOE 10:1 / 6:1 / HF 49% với SiO₂ nhiệt | 50 / 100 / 2000 nm/phút | C | Jaeger hoặc Plummer, chương khắc |
| Hệ số RIE (`etch.rie.*`, hình dạng mô hình): tốc độ = 20 + 0,25·P; dị hướng = 0,98 − p/250 − (150 − P)/600, kẹp [0,25; 0,97]; chọn lọc resist = max(1,4; 8 − P/45); chọn lọc Si = max(5; 15 − P/40) (P: W, p: mTorr) | như prototype | C | Không có số chuẩn chung; giữ mức C, ghi rõ là minh họa |
| Chọn lọc của khắc ướt với Si và resist (`etch.wet.*Selectivity`) | ∞ (lý tưởng hóa: không bị ăn) | C | Jaeger/Plummer: BOE/HF thực tế có chọn lọc hữu hạn rất lớn với Si; với resist còn phụ thuộc độ bám dính |
| k₁ dùng cho CD_min | 0,6 | C | Plummer, chương quang khắc |
| NA từng nguồn sáng (g/i/KrF/ArF) | 0,45 / 0,6 / 0,8 / 0,93 | C | Chọn giá trị điển hình có nguồn |
| Độ dày resist 500 nm ở 3000 rpm | 500 nm | C | Datasheet một loại resist phổ biến |
| Số mũ trong độ dày ∝ ω^-1/2 (viết thẳng bằng `Math.sqrt`) | −1/2 | B (SCIENCE.md mục 2, M03) | Kiểm lại với đường cong quay của resist cụ thể |
| Bước sóng g-line / i-line / KrF / ArF (`litho.sources.*.wavelengthNm`) | 436 / 365 / 248 / 193 nm | C | Tên đường phổ và laser quen thuộc nhưng chưa trích nguồn; Plummer, chương quang khắc |
| Độ dày oxit khởi đầu của M04 (`geometry.oxideThicknessNm`) | 300 nm | C | Lựa chọn thiết kế của bài tập, không phải phép đo |
| Hệ số hình dạng quang khắc (`litho.*`): liều→bề rộng 150 nm/×; ngưỡng tỉ lệ 0,7 và 1,0; phần in được 0,55 + 0,45; cặn 0,5 (sát giới hạn) và 0,6 trên dải 0,25 (thiếu liều dưới 0,85); thừa liều trên 1,35; nghiêng thành khi tỉ lệ < 1,3, 80 nm/đơn vị | như prototype | C | Không có số sách; chỉ cần đúng xu hướng (SCIENCE.md mục 2, M03) |
| Lề 40 nm quanh cửa sổ khi đo resist còn lại (`geometry.resistMeasureMarginNm`) | 40 nm | C | Định nghĩa chỉ số, không phải đại lượng vật lý |
| Tỉ lệ Si bị tiêu thụ khi oxy hóa | ≈0,44 | — | Jaeger/Plummer, chương oxy hóa |
| k₂ trong DOF = k₂·λ/NA² (`litho.k2`) | 0,5 | C | Plummer, chương quang khắc (nhiều sách ghi DOF = ±k₂·λ/NA²; kiểm lại là bề rộng toàn phần hay nửa) |
| Độ nhòe Gauss tại tiêu điểm tốt nhất σ₀ = hệ số·λ/NA (`litho.exposure.blurAtBestFocus`) | 0,445 | C (hệ số hình dạng) | Chọn để tái hiện ngưỡng 0,7 và 1,0 của prototype ở liều ×1; ≈ 2× Gauss khớp đĩa Airy (≈ 0,21·λ/NA, Zhang et al. 2007; nguồn do người dùng cung cấp, chưa tự đối chiếu). Gọi là "độ nhòe hiệu dụng" (gộp quang học và khuếch tán trong resist), **không** gọi là PSF quang học |
| Hấp thụ của resist α (`litho.exposure.absorptionPerNm`) | 6,4·10⁻⁴ nm⁻¹ (0,64 µm⁻¹) | C | Chọn cùng σ₀. Đối chiếu (người dùng cung cấp, chưa tự kiểm): AZ MiR 701, Dill A = 0,709 µm⁻¹, B = 0,034 µm⁻¹, nên hấp thụ chưa tẩy màu A + B ≈ 0,74 µm⁻¹; mô hình dùng 0,64 µm⁻¹ và không có tẩy màu (bleaching), vì vậy thành loe hơn thực tế |
| Ngưỡng sạch / đúng kích thước (`litho.exposure.scumOkFraction`, `cdToleranceFraction`) | 1% độ dày; ±10% bề rộng | C | Định nghĩa chỉ số của mô hình, không phải đại lượng vật lý Phán quyết `cd-off-size` chỉ ở mức Biên: **không có ngưỡng Hỏng cho kích thước**; fab thật coi lệch lớn là Hỏng, mô hình chưa phân cấp, cần một ngưỡng có nguồn trước khi thêm |
| Nung mềm (`litho.bake.*`): nhiệt độ chuẩn; thời gian tương đương gấp đôi mỗi bao nhiêu °C; dưới / trên bao nhiêu phút tương đương thì coi là còn nhiều dung môi (Hỏng) / nung quá (mô hình gộp thành liều hiệu dụng giảm); liều hiệu dụng mất mỗi phút vượt | 90 °C; 10 °C; 0,5 / 3 phút; 0,15 mỗi phút | C | Quy luật chỉ có hướng (SCIENCE.md mục 2, M03, mức B). Nguồn: MicroChemicals, *Softbake of Photoresists* (ghi chú ứng dụng, không phải giáo trình; đã đọc khi lập plan 3b-3). **Nung thiếu ⇒ Hỏng là luật gọn của mô hình**: resist thật còn dung môi thì resist dương mòn ở vùng không chiếu, resist âm khó liên kết ngang, cả hai bám đế kém; mô hình không vẽ dark erosion, liên kết ngang hay bám đế. "Dính mask" chỉ đúng khi chiếu tiếp xúc (mô hình chiếu qua thấu kính, không có) |
| Đối chiếu số của nung mềm với MicroChemicals (nguồn do người dùng nêu, Claude đã đọc khi lập plan 3b-3; chưa đối chiếu giáo trình) | "100 °C × 1 phút cho mỗi µm" ⇒ lớp 0,5 µm cần 0,5 phút ở 100 °C = 1 phút ở 90 °C, đúng công thức chuẩn của ta; "thời gian giảm một nửa cho mỗi +10 °C trong khoảng 80–110 °C" khớp `doublingC` = 10 | B | Khớp hướng và bậc độ lớn; chưa đủ để nâng hằng số lên mức A |
| Nung quá cần liều cao hơn (hệ số `sensitivityLossPerMin` = 0,15 mỗi phút và cách gộp thành liều hiệu dụng) | chưa có nguồn | C | **Cần đối chiếu Mack (*Fundamental Principles of Optical Lithography*) hoặc Campbell**: nguồn MicroChemicals chỉ nêu hiệu ứng thật (PAC phân hủy một phần ở resist dương, resist âm tự liên kết ngang vì nhiệt), không nêu "cần liều cao hơn" |
| Tráng (`litho.develop.*`): thời gian làm sạch hết độ dày; ngưỡng tráng quá; mỏng đi mỗi phút vượt; nở ngang mỗi bên mỗi phút vượt | 1 phút; 1,5 lần; 10% mỗi phút; 30 nm mỗi phút | C | Datasheet resist và dung dịch tráng (TMAH) |
| Overlay (`litho.overlay.*`, `geometry.waferRadiusMm`): dung sai theo CD; hệ số của vùng Biên; bán kính wafer | 0,3·CD; 1,5; 150 mm | C | Dung sai overlay thường được nêu bằng một phần CD, chưa trích nguồn: Plummer hoặc Campbell, chương quang khắc; bán kính do M01 quy định sau |

### Tương phản màu (thiết kế, không phải hằng số vật lý)
Tính theo WCAG 2.x từ giá trị trong `src/ui/styles/tokens.css`; `tests/ui/tokens.test.ts` kiểm tra lại mỗi lần chạy test.

Chữ (cần ≥ 4,5:1, AA):

| Token | trên `--bg` | trên `--panel` | trên `--panel-2` |
|---|---|---|---|
| `--ink` | 11,55 | 13,66 | 12,50 |
| `--muted` | 5,03 | 5,94 | 5,44 |
| `--navy` | 9,31 | 11,01 | 10,08 |
| `--ok-ink` | 5,77 | 6,82 | 6,24 |
| `--warn-ink` | 5,06 | 5,98 | 5,48 |
| `--bad` | 4,75 | 5,61 | 5,14 |

Chữ `--panel` trên nền `--navy` (nút, bước đang chọn): 11,01.

Viền, chấm, icon (cần ≥ 3:1):

| Token | trên `--bg` | trên `--panel` | trên `--panel-2` |
|---|---|---|---|
| `--ok` | 3,67 | 4,34 | 3,97 |
| `--warn` | 3,91 | 4,62 | 4,23 |
| `--bad` | 4,75 | 5,61 | 5,14 |
| `--pr` (vòng focus) | 3,55 | 4,20 | 3,85 |

`--line` (≈ 1,3–1,6:1) chỉ là đường kẻ trang trí, không mang thông tin nên không áp ngưỡng này.

## Science review
(chưa có)
