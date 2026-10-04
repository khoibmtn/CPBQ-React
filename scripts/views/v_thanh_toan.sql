-- Definition of BigQuery VIEW: v_thanh_toan
-- Dataset: cpbq-487004.cpbq_data.v_thanh_toan
-- Updated: 2026-10-04 (Hỗ trợ linh hoạt nhận diện Thận nhân tạo theo short_name thay vì hardcode K35)

CREATE OR REPLACE VIEW `cpbq-487004.cpbq_data.v_thanh_toan` AS
SELECT
  t.*,
  lk.ml2,
  lk.ml4,
  cs.ten_cskcb,
  CASE
    -- Ngoại trú
    WHEN lk.ml2 = 'Ngoại trú' THEN
      CASE
        -- Ngoại trú + Điều trị ngoại trú
        WHEN lk.ml4 = 'Điều trị ngoại trú' THEN
          CASE
            WHEN COALESCE(kp.short_name, kp2.short_name) = 'Thận nhân tạo' OR t.ma_khoa = 'K35'
              THEN COALESCE(kp.short_name, kp2.short_name, t.ma_khoa)
            ELSE 'Điều trị ngoại trú'
          END
        -- Ngoại trú + Khám bệnh → lookup khoa (3 mức, giống Nội trú)
        ELSE COALESCE(kp.short_name, kp2.short_name, t.ma_khoa)
      END
    -- Nội trú → lookup khoa (3 mức ưu tiên)
    ELSE COALESCE(kp.short_name, kp2.short_name, t.ma_khoa)
  END AS khoa,
  LEFT(t.ma_benh, 3) AS ma_benh_chinh

FROM `cpbq-487004.cpbq_data.thanh_toan_bhyt` t

-- JOIN 1: Lookup loại KCB (ml2, ml4)
LEFT JOIN `cpbq-487004.cpbq_data.lookup_loaikcb` lk
  ON t.ma_loaikcb = lk.ma_loaikcb
  AND lk.valid_from <= (t.nam_qt * 10000 + t.thang_qt * 100 + 1) AND (lk.valid_to IS NULL OR lk.valid_to >= (t.nam_qt * 10000 + t.thang_qt * 100 + 1))

-- JOIN 2: Lookup cơ sở KCB (ten_cskcb)
LEFT JOIN `cpbq-487004.cpbq_data.lookup_cskcb` cs
  ON t.ma_cskcb = CAST(cs.ma_cskcb AS STRING)
  AND cs.valid_from <= (t.nam_qt * 10000 + t.thang_qt * 100 + 1) AND (cs.valid_to IS NULL OR cs.valid_to >= (t.nam_qt * 10000 + t.thang_qt * 100 + 1))

-- JOIN 3: Lookup khoa - Mức 1: khớp theo thời gian hiệu lực
LEFT JOIN `cpbq-487004.cpbq_data.lookup_khoa` kp
  ON t.ma_cskcb = CAST(kp.ma_cskcb AS STRING)
  AND t.ma_khoa = kp.makhoa_xml
  AND kp.valid_from <= (t.nam_qt * 10000 + t.thang_qt * 100 + 1) AND (kp.valid_to IS NULL OR kp.valid_to >= (t.nam_qt * 10000 + t.thang_qt * 100 + 1))

-- JOIN 4: Lookup khoa - Mức 2: tên mặc định (không có thời gian hiệu lực)
LEFT JOIN `cpbq-487004.cpbq_data.lookup_khoa` kp2
  ON t.ma_cskcb = CAST(kp2.ma_cskcb AS STRING)
  AND t.ma_khoa = kp2.makhoa_xml
  AND kp2.valid_from IS NULL AND kp2.valid_to IS NULL;
