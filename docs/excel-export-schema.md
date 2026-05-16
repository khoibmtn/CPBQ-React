# Cấu trúc file Excel xuất dữ liệu thanh toán BHYT

> **Ứng dụng**: CPBQ Dashboard — Quản lý số liệu  
> **Nguồn dữ liệu**: BigQuery `cpbq_data.thanh_toan_bhyt` + VIEW `v_thanh_toan`  
> **Cập nhật lần cuối**: 15/05/2026

---

## 1. Hai chế độ xuất Excel

### 📄 Xuất Raw (`BHYT_Raw_YYYY-YYYY_ngày.xlsx`)

- **Mục đích**: Xuất đúng cấu trúc schema BigQuery, phục vụ import lại dữ liệu
- **Tên cột**: Giữ nguyên tên gốc tiếng Anh (`ma_bn`, `ho_ten`, `t_tongchi`...)
- **Ngày tháng**: Chuyển ngược về dạng số nguyên (`ngay_sinh` → `19770902`) và datetime compact (`ngay_vao` → `'202601011430`)
- **Cột xuất**: 42 cột schema gốc (không bao gồm các cột ánh xạ)

### 📊 Xuất Đầy đủ (`BHYT_DayDu_YYYY-YYYY_ngày.xlsx`)

- **Mục đích**: Báo cáo đọc được, có tên tiếng Việt đầy đủ
- **Tên cột**: Tiếng Việt (`Mã BN`, `Họ tên`, `Tổng chi`...)
- **Ngày tháng**: Giữ dạng ISO đọc được (`1977-09-02`, `2026-01-01T14:30:00`)
- **Cột xuất**: 48 cột (42 schema + 6 cột ánh xạ từ bảng danh mục)

---

## 2. Bảng chi tiết các trường dữ liệu

### 2.1. Thông tin bệnh nhân

| # | Tên gốc (Raw) | Tên tiếng Việt (Đầy đủ) | Kiểu dữ liệu | Mô tả |
|---|---------------|--------------------------|---------------|-------|
| 1 | `stt` | STT | Số nguyên | Số thứ tự dòng trong file import gốc |
| 2 | `ma_bn` | Mã BN | Chuỗi | Mã bệnh nhân (10 chữ số, ví dụ: `2600054489`) |
| 3 | `ho_ten` | Họ tên | Chuỗi | Họ và tên đầy đủ bệnh nhân |
| 4 | `ngay_sinh` | Ngày sinh | Ngày¹ | Ngày sinh bệnh nhân |
| 5 | `gioi_tinh` | Giới tính | Số | `1` = Nam, `2` = Nữ |
| 6 | `dia_chi` | Địa chỉ | Chuỗi | Địa chỉ thường trú |

> ¹ **Raw**: dạng số nguyên `19770902` (YYYYMMDD). **Đầy đủ**: dạng ISO `1977-09-02`.

### 2.2. Thông tin thẻ BHYT

| # | Tên gốc (Raw) | Tên tiếng Việt (Đầy đủ) | Kiểu dữ liệu | Mô tả |
|---|---------------|--------------------------|---------------|-------|
| 7 | `ma_the` | Mã thẻ | Chuỗi | Mã thẻ BHYT (ví dụ: `GD4313121151917`) |
| 8 | `ma_dkbd` | Mã ĐKBD | Chuỗi/Số | Mã cơ sở đăng ký khám chữa bệnh ban đầu |
| 9 | `gt_the_tu` | GT thẻ từ | Ngày¹ | Ngày bắt đầu giá trị thẻ BHYT |
| 10 | `gt_the_den` | GT thẻ đến | Ngày¹ | Ngày hết hạn giá trị thẻ BHYT |

### 2.3. Thông tin bệnh và chẩn đoán

| # | Tên gốc (Raw) | Tên tiếng Việt (Đầy đủ) | Kiểu dữ liệu | Mô tả |
|---|---------------|--------------------------|---------------|-------|
| 11 | `ma_benh` | Mã bệnh | Chuỗi | Mã ICD-10 chẩn đoán (có thể chứa nhiều mã phân cách bởi `;`) |
| 12 | `ma_benh_chinh` ⭐ | Mã bệnh chính | Chuỗi | **[Ánh xạ]** Mã ICD-10 chính — được trích xuất từ `ma_benh` (lấy mã đầu tiên trước dấu `;`). Ví dụ: `ma_benh` = `J18.9;J44.1` → `ma_benh_chinh` = `J18.9` |
| 13 | `ma_benhkhac` | Mã bệnh khác | Chuỗi | Mã bệnh kèm theo (ICD-10 phụ) |

### 2.4. Thông tin điều trị

| # | Tên gốc (Raw) | Tên tiếng Việt (Đầy đủ) | Kiểu dữ liệu | Mô tả |
|---|---------------|--------------------------|---------------|-------|
| 14 | `ma_lydo_vvien` | Lý do VV | Số | Mã lý do vào viện (`1` = Đúng tuyến, `2` = Cấp cứu, `3` = Trái tuyến) |
| 15 | `ma_noi_chuyen` | Nơi chuyển | Chuỗi | Mã cơ sở chuyển bệnh nhân đến |
| 16 | `ngay_vao` | Ngày vào | Ngày giờ² | Ngày giờ vào viện/khám |
| 17 | `ngay_ra` | Ngày ra | Ngày giờ² | Ngày giờ ra viện/kết thúc KCB |
| 18 | `so_ngay_dtri` | Số ngày ĐT | Số | Tổng số ngày điều trị |
| 19 | `ket_qua_dtri` | Kết quả ĐT | Số | Kết quả điều trị (`1` = Khỏi, `2` = Đỡ, `3` = Không thay đổi, `4` = Nặng hơn, `5` = Tử vong) |
| 20 | `tinh_trang_rv` | Tình trạng RV | Số | Tình trạng ra viện (`1` = Ra viện, `2` = Chuyển viện, `3` = Trốn viện, `4` = Xin ra viện) |

> ² **Raw**: dạng compact `'202601011430` (tick + YYYYMMDDHHmm). **Đầy đủ**: dạng ISO `2026-01-01T14:30:00`.

### 2.5. Chi phí (đơn vị: VNĐ)

| # | Tên gốc (Raw) | Tên tiếng Việt (Đầy đủ) | Mô tả |
|---|---------------|--------------------------|-------|
| 21 | `t_tongchi` | Tổng chi | **Tổng chi phí KCB** (= tổng tất cả mục chi phí bên dưới) |
| 22 | `t_xn` | Xét nghiệm | Chi phí xét nghiệm |
| 23 | `t_cdha` | CĐHA | Chi phí chẩn đoán hình ảnh (X-quang, CT, MRI...) |
| 24 | `t_thuoc` | Thuốc | Chi phí thuốc điều trị |
| 25 | `t_mau` | Máu | Chi phí máu và chế phẩm máu |
| 26 | `t_pttt` | PTTT | Chi phí phẫu thuật, thủ thuật |
| 27 | `t_vtyt` | VTYT | Chi phí vật tư y tế |
| 28 | `t_dvkt_tyle` | DVKT tỷ lệ | Chi phí dịch vụ kỹ thuật tính theo tỷ lệ |
| 29 | `t_thuoc_tyle` | Thuốc tỷ lệ | Chi phí thuốc tính theo tỷ lệ |
| 30 | `t_vtyt_tyle` | VTYT tỷ lệ | Chi phí vật tư y tế tính theo tỷ lệ |
| 31 | `t_kham` | Khám | Chi phí khám bệnh |
| 32 | `t_giuong` | Giường | Chi phí giường bệnh |
| 33 | `t_vchuyen` | Vận chuyển | Chi phí vận chuyển |
| 34 | `t_bntt` | BN thanh toán | Số tiền **bệnh nhân** tự thanh toán |
| 35 | `t_bhtt` | BH thanh toán | Số tiền **bảo hiểm** thanh toán |
| 36 | `t_ngoaids` | Ngoài DS | Chi phí ngoài danh sách BHYT chi trả |

### 2.6. Phân loại KCB và đơn vị

| # | Tên gốc (Raw) | Tên tiếng Việt (Đầy đủ) | Kiểu dữ liệu | Mô tả |
|---|---------------|--------------------------|---------------|-------|
| 37 | `ma_khoa` | Mã khoa | Chuỗi | Mã khoa điều trị (xem [bảng ánh xạ khoa](#32-bảng-ánh-xạ-khoa-lookup_khoa)) |
| 38 | `khoa` ⭐ | Khoa | Chuỗi | **[Ánh xạ]** Tên đầy đủ khoa — tra từ `lookup_khoa` theo `ma_khoa` + `ma_cskcb` |
| 39 | `nam_qt` | Năm QT | Số | Năm quyết toán (ví dụ: `2024`, `2025`, `2026`) |
| 40 | `thang_qt` | Tháng QT | Số | Tháng quyết toán (`1`–`12`) |
| 41 | `ma_khuvuc` | Mã khu vực | Chuỗi | Mã khu vực hành chính |
| 42 | `ma_loaikcb` | Loại KCB | Số | Mã loại khám chữa bệnh (xem [bảng ánh xạ loại KCB](#31-bảng-ánh-xạ-loại-kcb-lookup_loaikcb)) |
| 43 | `ml2` ⭐ | Nội/Ngoại trú | Chuỗi | **[Ánh xạ]** Phân loại 2 cấp — tra từ `lookup_loaikcb` theo `ma_loaikcb` |
| 44 | `ml4` ⭐ | Loại KCB | Chuỗi | **[Ánh xạ]** Phân loại 4 cấp chi tiết — tra từ `lookup_loaikcb` theo `ma_loaikcb` |
| 45 | `ma_cskcb` | Mã CSKCB | Chuỗi | Mã cơ sở khám chữa bệnh (xem [bảng ánh xạ CSKCB](#33-bảng-ánh-xạ-cskcb-lookup_cskcb)) |
| 46 | `ten_cskcb` ⭐ | Tên CSKCB | Chuỗi | **[Ánh xạ]** Tên cơ sở KCB — tra từ `lookup_cskcb` theo `ma_cskcb` |

### 2.7. Thanh toán bổ sung

| # | Tên gốc (Raw) | Tên tiếng Việt (Đầy đủ) | Kiểu dữ liệu | Mô tả |
|---|---------------|--------------------------|---------------|-------|
| 47 | `noi_ttoan` | Nơi thanh toán | Chuỗi | Nơi thanh toán chi phí BHYT |
| 48 | `giam_dinh` | Giám định | Chuỗi | Trạng thái giám định bảo hiểm |
| 49 | `t_xuattoan` | Xuất toán | Số (VNĐ) | Số tiền bị xuất toán (BHXH từ chối thanh toán) |
| 50 | `t_nguonkhac` | Nguồn khác | Số (VNĐ) | Chi phí từ nguồn khác (ngoài BHYT) |
| 51 | `t_datuyen` | Đa tuyến | Số (VNĐ) | Chi phí khám chữa bệnh đa tuyến |
| 52 | `t_vuottran` | Vượt trần | Số (VNĐ) | Chi phí vượt trần BHYT |

---

## 3. Chi tiết ánh xạ từ bảng danh mục

Các cột đánh dấu ⭐ ở trên là dữ liệu được **ánh xạ tự động** từ bảng danh mục (lookup tables) trong BigQuery, thông qua VIEW `v_thanh_toan`. Dữ liệu gốc chỉ lưu **mã số**, VIEW thực hiện LEFT JOIN để tra ra **tên đầy đủ**.

### 3.1. Bảng ánh xạ Loại KCB (`lookup_loaikcb`)

**Quy tắc**: `ma_loaikcb` → `ml2` (Nội/Ngoại trú) + `ml4` (Loại KCB chi tiết)

| `ma_loaikcb` | `ml2` (Nội/Ngoại trú) | `ml4` (Chi tiết) | Ghi chú |
|:---:|---|---|---|
| **1** | Ngoại trú | Khám bệnh | Khám bệnh thông thường |
| **2** | Ngoại trú | Điều trị ngoại trú | Điều trị ngoại trú |
| **3** | **Nội trú** | **Nội trú** | Điều trị nội trú |
| **4** | **Nội trú** | **Nội trú ban ngày** | Điều trị nội trú ban ngày |
| **5** | Ngoại trú | Điều trị ngoại trú | |
| **6** | Ngoại trú | Điều trị ngoại trú | |
| **7** | Ngoại trú | Khám bệnh | |
| **8** | Ngoại trú | Điều trị ngoại trú | |
| **9** | **Nội trú** | **Nội trú** | |

> **Tóm tắt**: `ma_loaikcb` = `3`, `4`, `9` → **Nội trú**. Còn lại → **Ngoại trú**.

### 3.2. Bảng ánh xạ Khoa (`lookup_khoa`)

**Quy tắc**: `ma_khoa` + `ma_cskcb` → `khoa` (tên khoa đầy đủ)

Lưu ý: Cùng `ma_khoa` có thể cho tên khác nhau tùy theo cơ sở KCB (`ma_cskcb`) và khoảng thời gian hiệu lực (`valid_from` – `valid_to`).

#### Cơ sở 1 — Trung tâm (`ma_cskcb = 31006`)

| `ma_khoa` | Tên đầy đủ (`full_name`) | Tên viết tắt | Hiệu lực |
|-----------|--------------------------|--------------|----------|
| `K01` | Khoa Khám Bệnh | Khám bệnh (TT) | Từ 2000 |
| `K024849` | Khoa Cấp cứu - HSTC - CĐ | CC-HSTC-CĐ | Từ 2000 |
| `K03` | Khoa Nội Tổng hợp | Nội TH | Từ 2000 |
| `K0450` | Khoa Nội Tim mạch - Hô hấp | TMHH | Từ 2000 |
| `K11` | Khoa Bệnh nhiệt đới | BNĐ | Từ 2000 |
| `K12` | Khoa Lao | Lao | Từ 2000 |
| `K1631` | Khoa Y học cổ truyền - PHCN | YHCT-PHCN | Từ 2000 |
| `K18` | Khoa Nhi | Nhi | Từ 2000 |
| `K19` | Khoa Ngoại tổng hợp | Ngoại TH | 2000 → 31/12/2025 |
| `K19` | Khoa Ngoại | Ngoại | Từ 01/01/2026 |
| `K24` | Khoa Chấn thương chỉnh hình | CTCH | 2000 → 31/12/2025 |
| `K26` | Khoa Gây Mê Hồi Sức | GMHS | Từ 2000 |
| `K27` | Khoa Phụ sản | Sản | Từ 2000 |
| `K28` | Khoa Tai - Mũi - Họng | TMH | 2000 → 31/12/2025 |
| `K282930` | Khoa LCK | LCK | Từ 01/01/2026 |
| `K29` | Khoa Răng - Hàm - Mặt | RHM | 2000 → 31/12/2025 |
| `K30` | Khoa Mắt | Mắt | 2000 → 31/12/2025 |
| `K35` | Khoa Thận nhân tạo | Thận nhân tạo | Từ 2000 |
| `K43` | Khoa KSNK | KSNK | Từ 2000 |
| `K99` | Khoa AHF | AHF | Từ 2000 |
| `PVMD` | Phân viện Minh Đức | PV Minh Đức | Từ 2000 |
| `CSQT` | Cơ sở điều trị Quảng Thanh | CS Quảng Thanh | Từ 2000 |

#### Cơ sở 2 — Minh Đức (`ma_cskcb = 31334`)

| `ma_khoa` | Tên đầy đủ | Tên viết tắt |
|-----------|-----------|--------------|
| `K01` | Khoa Khám Bệnh | Khám bệnh (MĐ) |

#### Cơ sở 3 — Quảng Thanh (`ma_cskcb = 31335`)

| `ma_khoa` | Tên đầy đủ | Tên viết tắt |
|-----------|-----------|--------------|
| `K01` | Khoa Khám Bệnh | Khám bệnh (QT) |
| `K03` | Khoa Nội Tổng hợp | Nội TH (QT) |

> **Lưu ý**: Một số khoa có thời hạn hiệu lực (`valid_from` → `valid_to`). Khi hết hạn, khoa có thể được thay thế bởi khoa mới (ví dụ: K28 TMH, K29 RHM, K30 Mắt → sáp nhập thành K282930 LCK từ 01/01/2026).

### 3.3. Bảng ánh xạ CSKCB (`lookup_cskcb`)

**Quy tắc**: `ma_cskcb` → `ten_cskcb` (tên cơ sở KCB)

| `ma_cskcb` | `ten_cskcb` | Ghi chú |
|:---:|---|---|
| **31006** | Trung tâm (CS1) | Cơ sở chính |
| **31334** | Minh Đức | Phân viện Minh Đức |
| **31335** | Quảng Thanh | Cơ sở điều trị Quảng Thanh |

### 3.4. Ánh xạ Mã bệnh chính (`ma_benh_chinh`)

**Quy tắc**: `ma_benh` → `ma_benh_chinh`

Trường `ma_benh` trong dữ liệu gốc có thể chứa **nhiều mã ICD-10** phân cách bởi dấu `;`. VIEW tự động trích xuất **mã đầu tiên** làm `ma_benh_chinh`:

| `ma_benh` (gốc) | `ma_benh_chinh` (ánh xạ) | Giải thích |
|---|---|---|
| `J18.9` | `J18.9` | Chỉ có 1 mã → lấy luôn |
| `J18.9;J44.1` | `J18.9` | Nhiều mã → lấy mã đầu tiên |
| `K35;K81.0;E11` | `K35` | Lấy trước dấu `;` đầu tiên |

---

## 4. Sơ đồ quan hệ dữ liệu

```
┌─────────────────────────────────────────────────────┐
│              thanh_toan_bhyt (bảng gốc)              │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │ ma_loaikcb   │  │ ma_khoa       │  │ ma_cskcb  │ │
│  │ (1,2,3,4...) │  │ (K01,K11...)  │  │ (31006..) │ │
│  └──────┬───────┘  └───────┬───────┘  └─────┬─────┘ │
│         │                  │                │       │
│  ┌──────┴─────┐            │                │       │
│  │ ma_benh    │            │                │       │
│  │ (J18.9;..) │            │                │       │
│  └──────┬─────┘            │                │       │
└─────────┼──────────────────┼────────────────┼───────┘
          │                  │                │
     LEFT JOIN          LEFT JOIN        LEFT JOIN
          │                  │                │
          ▼                  ▼                ▼
  ┌───────────────┐  ┌──────────────┐  ┌────────────┐
  │lookup_loaikcb │  │ lookup_khoa  │  │lookup_cskcb│
  │               │  │              │  │            │
  │ → ml2         │  │ → full_name  │  │ → ten_cskcb│
  │ → ml4         │  │   (khoa)     │  │            │
  └───────────────┘  └──────────────┘  └────────────┘

  ma_benh → SPLIT(";")[0] → ma_benh_chinh
```

---

## 5. Ví dụ dòng dữ liệu

### Raw export:
```
stt | ma_bn      | ho_ten          | ngay_sinh | ma_loaikcb | ma_khoa | ma_cskcb | ma_benh
9067| 2600054489 | ĐOÀN THỊ NGỌC  | 19790501  | 3          | K11     | 31006    | J18.9;J44.1
```

### Đầy đủ export (cùng dòng):
```
STT | Mã BN      | Họ tên          | Ngày sinh  | Loại KCB | Nội/Ngoại trú | Loại KCB | Mã khoa | Khoa                  | Mã CSKCB | Tên CSKCB       | Mã bệnh    | Mã bệnh chính
9067| 2600054489 | ĐOÀN THỊ NGỌC  | 1979-05-01 | 3        | Nội trú       | Nội trú  | K11     | Khoa Bệnh nhiệt đới  | 31006    | Trung tâm (CS1) | J18.9;J44.1| J18.9
```

---

## 6. Ghi chú kỹ thuật

- **VIEW `v_thanh_toan`**: BigQuery VIEW thực hiện tất cả các LEFT JOIN ở trên tự động. Khi ứng dụng query `SELECT * FROM v_thanh_toan`, kết quả đã bao gồm cả cột gốc lẫn cột ánh xạ.
- **Hiệu lực thời gian**: Các bảng `lookup_khoa` và `lookup_cskcb` có trường `valid_from` / `valid_to` để hỗ trợ tra cứu theo thời điểm (ví dụ: K19 đổi tên từ "Ngoại tổng hợp" → "Ngoại" từ 01/01/2026).
- **Dung lượng**: Dataset ~55,000 dòng/năm. File Excel xuất ra ~5-10 MB tùy chế độ.
- **Mã hóa**: UTF-8 với đầy đủ ký tự tiếng Việt có dấu.
