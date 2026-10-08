# Fab Lab — Nguyên tắc khoa học

File này là "luật" cho mọi mô hình vật lý và mọi câu giải thích trong sản phẩm.
Claude Code phải đọc file này trước khi sửa `src/physics/` hoặc `src/content/`.

## 1. Ba mức độ tin cậy của một con số
Mỗi hằng số trong `src/physics/constants.ts` thuộc đúng một mức:

| Mức | Nghĩa | Ví dụ | Hiển thị cho người học |
|---|---|---|---|
| **A — có nguồn** | Lấy từ giáo trình, ghi sách + bảng/trang | Hệ số Deal–Grove, Rp/ΔRp cấy ion | Hiện bình thường, có nút "nguồn" |
| **B — quy luật** | Không cần số chính xác, chỉ cần đúng xu hướng | t ∝ ω^-1/2, dị hướng giảm khi áp suất tăng | Hiện bình thường, ghi "xu hướng" |
| **C — minh họa** | Số chọn cho dễ nhìn, đúng bậc độ lớn | Tốc độ RIE trong prototype | Luôn kèm nhãn "giá trị minh họa" |

Kiểu dữ liệu đề xuất:
```ts
type Sourced = { value: number; unit: string; tier: 'A'; source: string };   // "Plummer 2000, Bảng 6-2"
type Law = { value: number; unit: string; tier: 'B'; note: string };
type Illustrative = { value: number; unit: string; tier: 'C'; illustrative: true };
```

## 2. Mô hình theo module
Phương trình dưới đây là kiến thức chuẩn trong giáo trình. **Hằng số cụ thể phải lấy từ sách** (mục 4),
không lấy từ bộ nhớ của AI.

### M02 Oxy hóa nhiệt — Deal–Grove
- x² + A·x = B·(t + τ). B/A là hằng số tốc độ tuyến tính, B là hằng số tốc độ parabol.
- B và B/A tuân theo Arrhenius: k = k₀·exp(−Eₐ/kT). Oxy hóa ướt có B lớn hơn khô rất nhiều.
- Giới hạn: không mô tả đúng vùng oxit rất mỏng (dưới vài chục nm, oxy hóa khô) → ghi chú trong UI.
- Màu giao thoa: phụ thuộc độ dày và chiết suất SiO₂ (≈1,46). Bảng màu lấy từ tài liệu có nguồn.

### M03 Quang khắc
- Độ phân giải: CD_min = k₁·λ/NA. Độ sâu tiêu cự: DOF = k₂·λ/NA².
- Resist dương: vùng chiếu sáng tan khi tráng. Resist âm: vùng chiếu sáng ở lại.
- Độ dày phủ quay: t ≈ k·ω^-1/2 (thực nghiệm, mức B).
- Liều thấp → cặn đáy (scum); liều cao → cửa sổ nở rộng (mức B).

### M04 Khắc
- Định nghĩa: độ dị hướng A = 1 − (tốc độ ngang / tốc độ dọc); độ chọn lọc S = tốc độ vật liệu cần khắc / tốc độ vật liệu khác.
- Khắc ướt SiO₂ bằng HF/BOE: đẳng hướng, undercut ≈ độ sâu khắc. Rất chọn lọc với Si.
- Khắc ướt Si bằng KOH: phụ thuộc mặt tinh thể; mặt {111} khắc chậm hơn rất nhiều so với {100},
  trên Si(100) tạo vách nghiêng 54,74°.
- RIE: ion gia tốc qua lớp vỏ plasma (sheath) cho thành phần dọc, gốc trung hòa cho thành phần hóa học.
  Áp suất cao → va chạm nhiều → kém dị hướng. Công suất cao → ion năng lượng cao → nhanh, thẳng hơn, kém chọn lọc với resist.
- DRIE Bosch: luân phiên chu kỳ khắc SF₆ và phủ thụ động C₄F₈ → vách thẳng sâu, có gợn "scallop".
- Mô hình số: lan mặt khắc trên lưới bằng đường đi ngắn nhất (Dijkstra) với chi phí theo vật liệu và hướng.
  Đây là mô hình hình học đơn giản hóa, **không** mô phỏng vận chuyển ion hay hóa học bề mặt → ghi rõ trong UI.

### M05 Pha tạp và màng
- Cấy ion: N(x) = Q / (√(2π)·ΔRp) · exp(−(x − Rp)² / (2·ΔRp²)). Rp, ΔRp theo ion và năng lượng → lấy từ bảng.
- Khuếch tán, nguồn không đổi: C = Cs·erfc(x / 2√(Dt)). Nguồn giới hạn: C = Q/√(πDt)·exp(−x²/4Dt).
- D = D₀·exp(−Eₐ/kT).
- Lắng đọng: PVD (phún xạ) độ phủ bậc kém; CVD tốt hơn; ALD gần như phủ đều tuyệt đối (mức B).
- CMP: phương trình Preston, tốc độ mài = Kp·P·V.

### M06 Đóng gói và yield
- Yield Poisson: Y = exp(−D₀·A) với D₀ là mật độ khuyết tật, A là diện tích die. Có thể giới thiệu thêm mô hình Murphy.
- Wire bond và flip-chip: so sánh về số chân I/O, độ tự cảm, tản nhiệt (mức B).
- Test hai lần (probe trên wafer và sau đóng gói): giải thích bằng chi phí, không đưa số liệu thị trường nếu không có nguồn.

## 3. Quy tắc viết giải thích
- Mỗi bước: cơ chế trong 2–4 câu, tối đa một phương trình, một "hậu quả nếu làm sai".
- Không phóng đại ("nhanh nhất thế giới", "duy nhất"). Không nêu số liệu ngành (giá, thị phần, node) nếu không có nguồn.
- Phân biệt rõ "trong mô hình này" và "trong fab thật".

## 4. Nguồn tham khảo dùng để đối chiếu
- R. C. Jaeger, *Introduction to Microelectronic Fabrication*, 2nd ed.
- J. D. Plummer, M. D. Deal, P. B. Griffin, *Silicon VLSI Technology: Fundamentals, Practice and Modeling*.
- S. A. Campbell, *Fabrication Engineering at the Micro- and Nanoscale*.
- S. M. Sze, M. K. Lee, *Semiconductor Devices: Physics and Technology*.

Khi đưa một hằng số lên mức A, ghi đúng tên sách, lần xuất bản, bảng hoặc trang.
Nếu không có sách trong tay, giữ ở mức C và thêm vào "Values to verify" trong PROGRESS.md.

## 5. Kiểm thử bắt buộc
- Mỗi hàm vật lý có ít nhất: một test giá trị tham chiếu (nếu mức A), một test quy luật (đơn điệu, giới hạn, đối xứng).
- Ví dụ test quy luật cho khắc: tăng áp suất RIE thì undercut không giảm; khắc ướt có undercut gần bằng độ sâu (±1 ô lưới);
  thời gian = 0 thì không có gì bị khắc; mặt cắt đối xứng qua tâm cửa sổ.
