/**
 * schema.ts – Data schema constants for BHYT payment data
 * ========================================================
 * Ported from Streamlit overview.py constants.
 */

/** Composite key columns for row-level deduplication */
export const ROW_KEY_COLS = [
    "ma_cskcb", "ma_bn", "ma_loaikcb", "ngay_vao", "ngay_ra",
] as const;

/** 14 required columns — rows missing these are invalid */
export const REQUIRED_COLS = [
    "ma_bn", "ho_ten", "ngay_sinh", "gioi_tinh", "ma_dkbd", "ma_benh",
    "ngay_vao", "ngay_ra", "t_tongchi", "t_bhtt", "ma_khoa",
    "nam_qt", "thang_qt", "ma_cskcb",
] as const;

/** Full schema columns (excluding metadata) */
export const SCHEMA_COLS = [
    "stt", "ma_bn", "ho_ten", "ngay_sinh", "gioi_tinh", "dia_chi",
    "ma_the", "ma_dkbd", "gt_the_tu", "gt_the_den", "ma_benh", "ma_benhkhac",
    "ma_lydo_vvien", "ma_noi_chuyen", "ngay_vao", "ngay_ra", "so_ngay_dtri",
    "ket_qua_dtri", "tinh_trang_rv", "t_tongchi", "t_xn", "t_cdha", "t_thuoc",
    "t_mau", "t_pttt", "t_vtyt", "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle",
    "t_kham", "t_giuong", "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids",
    "ma_khoa", "nam_qt", "thang_qt", "ma_khuvuc", "ma_loaikcb", "ma_cskcb",
    "noi_ttoan", "giam_dinh", "t_xuattoan", "t_nguonkhac", "t_datuyen", "t_vuottran",
] as const;

/** Columns to exclude from user-facing data views */
export const MANAGE_EXCLUDE_COLS = new Set(["source_file"]);

/** Default columns for searching */
export const DEFAULT_SEARCH_COLS = [
    "ho_ten", "ma_bn", "ma_the", "ma_benh", "ma_benhkhac",
    "dia_chi", "khoa", "ten_cskcb", "ma_khoa", "ma_cskcb",
] as const;
