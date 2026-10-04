"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    X,
    Save,
    RotateCcw,
    Loader2,
    Lock,
    User,
    Stethoscope,
    Coins,
    SlidersHorizontal,
    CheckCircle2,
    Calendar,
    CreditCard,
    Building2,
    AlertCircle,
    Info,
} from "lucide-react";
import { SCHEMA_COLS, MAPPED_COLS, METADATA_COLS } from "@/lib/schema";

type Row = Record<string, unknown>;

interface EditRecordModalProps {
    open: boolean;
    row: Row | null;
    onClose: () => void;
    onSave: (originalRow: Row, updatedFields: Row) => Promise<void>;
    loading?: boolean;
}

type TabKey = "patient" | "treatment" | "costs" | "system";

/* ── Standard Column Labels (Vietnamese) ── */
const COL_LABELS: Record<string, string> = {
    stt: "STT",
    ma_bn: "Mã bệnh nhân",
    ho_ten: "Họ và tên",
    ngay_sinh: "Ngày sinh",
    gioi_tinh: "Giới tính",
    dia_chi: "Địa chỉ thường trú",
    ma_the: "Mã thẻ BHYT",
    ma_dkbd: "Mã ĐK KCB ban đầu",
    gt_the_tu: "Giá trị thẻ từ",
    gt_the_den: "Giá trị thẻ đến",
    ma_benh: "Mã bệnh chính (ICD-10)",
    ma_benhkhac: "Mã bệnh kèm theo (ICD-10)",
    ma_lydo_vvien: "Lý do vào viện",
    ma_noi_chuyen: "Nơi chuyển đến",
    ngay_vao: "Ngày giờ vào viện",
    ngay_ra: "Ngày giờ ra viện",
    so_ngay_dtri: "Số ngày điều trị",
    ket_qua_dtri: "Kết quả điều trị",
    tinh_trang_rv: "Tình trạng ra viện",
    t_tongchi: "Tổng chi phí",
    t_xn: "Xét nghiệm",
    t_cdha: "Chẩn đoán hình ảnh",
    t_thuoc: "Tiền thuốc",
    t_mau: "Máu & chế phẩm",
    t_pttt: "Phẫu thuật, thủ thuật",
    t_vtyt: "Vật tư y tế",
    t_dvkt_tyle: "DVKT tỷ lệ",
    t_thuoc_tyle: "Thuốc tỷ lệ",
    t_vtyt_tyle: "VTYT tỷ lệ",
    t_kham: "Tiền khám",
    t_giuong: "Tiền giường",
    t_vchuyen: "Vận chuyển",
    t_bntt: "Bệnh nhân thanh toán",
    t_bhtt: "Bảo hiểm thanh toán",
    t_ngoaids: "Ngoài danh sách",
    ma_khoa: "Mã khoa điều trị",
    nam_qt: "Năm quyết toán",
    thang_qt: "Tháng quyết toán",
    ma_khuvuc: "Mã khu vực",
    ma_loaikcb: "Loại KCB",
    ma_cskcb: "Mã cơ sở KCB",
    noi_ttoan: "Nơi thanh toán",
    giam_dinh: "Giám định",
    t_xuattoan: "Xuất toán",
    t_nguonkhac: "Nguồn khác",
    t_datuyen: "Đa tuyến",
    t_vuottran: "Vượt trần",
    // Mapped
    ten_cskcb: "Tên cơ sở KCB",
    khoa: "Khoa điều trị",
    ml2: "Nội/Ngoại trú",
    ml4: "Loại hình KCB",
    ma_benh_chinh: "Mã bệnh chính",
    // Metadata
    upload_timestamp: "Thời điểm tải lên",
    is_normalized: "Trạng thái chuẩn hóa",
    normalized_at: "Thời điểm chuẩn hóa",
};

/* ── Numeric Columns ── */
const NUMERIC_COLS = new Set([
    "stt", "gioi_tinh", "so_ngay_dtri", "ket_qua_dtri", "tinh_trang_rv",
    "t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau", "t_pttt", "t_vtyt",
    "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle", "t_kham", "t_giuong",
    "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids", "t_xuattoan", "t_nguonkhac",
    "t_datuyen", "t_vuottran", "nam_qt", "thang_qt", "ma_loaikcb",
    "ma_lydo_vvien", "giam_dinh", "noi_ttoan",
]);

/* ── Currency / Cost Columns ── */
const COST_COLS = new Set([
    "t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau", "t_pttt", "t_vtyt",
    "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle", "t_kham", "t_giuong",
    "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids", "t_xuattoan", "t_nguonkhac",
    "t_datuyen", "t_vuottran",
]);

/* ── Standard Enumerations for Medical BHYT ── */
const GIOI_TINH_OPTIONS = [
    { value: "1", label: "1 - Nam" },
    { value: "2", label: "2 - Nữ" },
];

const LYDO_VVIEN_OPTIONS = [
    { value: "1", label: "1 - Đúng tuyến" },
    { value: "2", label: "2 - Cấp cứu" },
    { value: "3", label: "3 - Trái tuyến" },
];

const KET_QUA_DTRI_OPTIONS = [
    { value: "1", label: "1 - Khỏi" },
    { value: "2", label: "2 - Đỡ" },
    { value: "3", label: "3 - Không thay đổi" },
    { value: "4", label: "4 - Nặng hơn" },
    { value: "5", label: "5 - Tử vong" },
];

const TINH_TRANG_RV_OPTIONS = [
    { value: "1", label: "1 - Ra viện" },
    { value: "2", label: "2 - Chuyển viện" },
    { value: "3", label: "3 - Trốn viện" },
    { value: "4", label: "4 - Xin ra viện" },
];

const DEFAULT_LOAIKCB_OPTIONS = [
    { value: "1", label: "1 - Khám bệnh (Ngoại trú)" },
    { value: "2", label: "2 - Điều trị ngoại trú" },
    { value: "3", label: "3 - Nội trú" },
    { value: "4", label: "4 - Nội trú ban ngày" },
];

const DEFAULT_CSKCB_OPTIONS = [
    { value: "31006", label: "31006 - Trung tâm (CS1)" },
    { value: "31334", label: "31334 - Phân viện Minh Đức" },
    { value: "31335", label: "31335 - Cơ sở điều trị Quảng Thanh" },
];

/** Unwrap BigQuery wrapper objects like { value: "..." } */
function unwrap(val: unknown): string {
    if (val == null) return "";
    if (typeof val === "object" && val !== null && "value" in (val as Record<string, unknown>)) {
        const inner = (val as Record<string, unknown>).value;
        return inner == null ? "" : String(inner);
    }
    if (typeof val === "boolean") return val ? "true" : "false";
    return String(val);
}

/** Format currency VND */
function formatVND(val: number | string | null | undefined): string {
    if (val == null || val === "") return "0 ₫";
    const num = typeof val === "number" ? val : Number(String(val).replace(/,/g, ""));
    if (isNaN(num)) return "0 ₫";
    return `${num.toLocaleString("vi-VN")} ₫`;
}

export default function EditRecordModal({ open, row, onClose, onSave, loading }: EditRecordModalProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("patient");
    const [draft, setDraft] = useState<Record<string, string>>({});

    // Dynamic lookups fetched once
    const [khoaList, setKhoaList] = useState<{ makhoa_xml: string; short_name: string; full_name: string }[]>([]);
    const [loaiKcbList, setLoaiKcbList] = useState<{ ma_loaikcb: number; ml2: string; ml4: string }[]>([]);
    const [cskcbList, setCskcbList] = useState<{ ma_cskcb: string; ten_cskcb: string }[]>([]);

    // Fetch lookups for smart dropdowns
    useEffect(() => {
        if (!open) return;
        Promise.all([
            fetch("/api/bq/lookup?table=lookup_khoa").then((r) => r.json()).catch(() => ({ rows: [] })),
            fetch("/api/bq/lookup?table=lookup_loaikcb").then((r) => r.json()).catch(() => ({ rows: [] })),
            fetch("/api/bq/lookup?table=lookup_cskcb").then((r) => r.json()).catch(() => ({ rows: [] })),
        ]).then(([khoaRes, loaiRes, cskcbRes]) => {
            if (khoaRes.rows?.length) {
                // Deduplicate by makhoa_xml + short_name
                const seen = new Set<string>();
                const unique = khoaRes.rows.filter((k: any) => {
                    const key = `${k.makhoa_xml}_${k.short_name}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                setKhoaList(unique);
            }
            if (loaiRes.rows?.length) setLoaiKcbList(loaiRes.rows);
            if (cskcbRes.rows?.length) setCskcbList(cskcbRes.rows);
        });
    }, [open]);

    // Populate draft when row opens
    useEffect(() => {
        if (row && open) {
            const d: Record<string, string> = {};
            for (const col of SCHEMA_COLS) {
                d[col] = unwrap(row[col]);
            }
            setDraft(d);
            setActiveTab("patient");
        }
    }, [row, open]);

    // Compute changed fields
    const changedFields = useMemo(() => {
        if (!row) return {};
        const changes: Row = {};
        for (const col of SCHEMA_COLS) {
            const original = unwrap(row[col]);
            const current = draft[col] ?? "";
            if (current !== original) {
                if (NUMERIC_COLS.has(col) && current !== "") {
                    const num = Number(current);
                    if (!isNaN(num)) {
                        changes[col] = num;
                        continue;
                    }
                }
                changes[col] = current || null;
            }
        }
        return changes;
    }, [row, draft]);

    const changedCount = Object.keys(changedFields).length;
    const hasChanges = changedCount > 0;

    const handleFieldChange = (col: string, value: string) => {
        setDraft((prev) => ({ ...prev, [col]: value }));
    };

    const handleRevertField = (col: string) => {
        if (!row) return;
        setDraft((prev) => ({ ...prev, [col]: unwrap(row[col]) }));
    };

    const handleRevertAll = () => {
        if (!row) return;
        const d: Record<string, string> = {};
        for (const col of SCHEMA_COLS) {
            d[col] = unwrap(row[col]);
        }
        setDraft(d);
    };

    const handleSave = () => {
        if (!hasChanges || !row) return;
        onSave(row, changedFields);
    };

    // Calculate changes count per tab
    const tabChanges = useMemo(() => {
        const counts = { patient: 0, treatment: 0, costs: 0, system: 0 };
        const patientCols = new Set(["stt", "ma_bn", "ho_ten", "ngay_sinh", "gioi_tinh", "dia_chi", "ma_the", "ma_dkbd", "gt_the_tu", "gt_the_den", "ma_khuvuc"]);
        const treatmentCols = new Set(["ma_benh", "ma_benhkhac", "ma_lydo_vvien", "ma_noi_chuyen", "ngay_vao", "ngay_ra", "so_ngay_dtri", "ket_qua_dtri", "tinh_trang_rv"]);
        const costCols = COST_COLS;
        const systemCols = new Set(["ma_khoa", "nam_qt", "thang_qt", "ma_loaikcb", "ma_cskcb", "noi_ttoan", "giam_dinh"]);

        for (const key of Object.keys(changedFields)) {
            if (patientCols.has(key)) counts.patient++;
            else if (treatmentCols.has(key)) counts.treatment++;
            else if (costCols.has(key)) counts.costs++;
            else if (systemCols.has(key)) counts.system++;
        }
        return counts;
    }, [changedFields]);

    if (!open || !row) return null;

    /* ── Helper Render: Form Field with Change Indicator & Revert ── */
    const renderField = (
        col: string,
        customInput?: React.ReactNode,
        options?: { fullWidth?: boolean; hint?: string }
    ) => {
        const original = unwrap(row[col]);
        const current = draft[col] ?? "";
        const isChanged = current !== original;
        const label = COL_LABELS[col] || col;

        return (
            <div
                key={col}
                className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all ${
                    isChanged
                        ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-200/50"
                        : "bg-white border-slate-200 hover:border-slate-300"
                } ${options?.fullWidth ? "col-span-full" : ""}`}
            >
                <div className="flex items-center justify-between gap-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <span>{label}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">({col})</span>
                    </label>
                    {isChanged && (
                        <button
                            type="button"
                            onClick={() => handleRevertField(col)}
                            title="Khôi phục giá trị gốc"
                            className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium transition-colors"
                        >
                            <RotateCcw className="w-2.5 h-2.5" /> Khôi phục
                        </button>
                    )}
                </div>

                {customInput || (
                    <input
                        type={NUMERIC_COLS.has(col) ? "number" : "text"}
                        value={current}
                        onChange={(e) => handleFieldChange(col, e.target.value)}
                        placeholder="(trống)"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all tabular-nums text-slate-800 placeholder:text-slate-400 font-medium"
                    />
                )}

                {/* Subtitle / Change difference note */}
                {isChanged && (
                    <div className="text-[11px] text-amber-700 font-medium truncate flex items-center gap-1">
                        <span className="text-slate-400 font-normal">Gốc:</span>
                        <span className="italic font-mono">{original || "(trống)"}</span>
                    </div>
                )}
                {options?.hint && !isChanged && (
                    <div className="text-[11px] text-slate-400 font-normal truncate">{options.hint}</div>
                )}
            </div>
        );
    };

    /* ── Helper Render: Read-only metadata field ── */
    const renderReadOnly = (col: string, label?: string, customValue?: string) => {
        const val = customValue !== undefined ? customValue : unwrap(row[col]);
        return (
            <div key={col} className="flex flex-col gap-1 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        {label || COL_LABELS[col] || col}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">({col})</span>
                </div>
                <div className="text-sm font-semibold text-slate-800 truncate py-1">
                    {val || "–"}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                {/* ── Modal Header ── */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-4 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
                            🏥
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                    {unwrap(row.ho_ten) || "Hồ sơ bệnh nhân"}
                                </h3>
                                <span className="text-xs font-mono bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                    Mã BN: {unwrap(row.ma_bn) || "–"}
                                </span>
                                {Boolean(row.ml2) && (
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                            unwrap(row.ml2) === "Nội trú"
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-blue-100 text-blue-800"
                                        }`}
                                    >
                                        {unwrap(row.ml2)}
                                    </span>
                                )}
                                {Boolean(row.khoa) && (
                                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                                        {unwrap(row.khoa)}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>Thẻ BHYT: <strong>{unwrap(row.ma_the) || "–"}</strong></span>
                                <span>•</span>
                                <span>Nơi ĐK: <strong>{unwrap(row.ma_dkbd) || "–"}</strong></span>
                                <span>•</span>
                                <span>CSKCB: <strong>{unwrap(row.ten_cskcb) || unwrap(row.ma_cskcb)}</strong></span>
                                <span>•</span>
                                <span>Quyết toán: <strong>Tháng {unwrap(row.thang_qt)}/{unwrap(row.nam_qt)}</strong></span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
                        title="Đóng cửa sổ"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Navigation Tabs ── */}
                <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-white flex-shrink-0 overflow-x-auto">
                    {[
                        { key: "patient" as TabKey, label: "Bệnh nhân & Thẻ BHYT", icon: User },
                        { key: "treatment" as TabKey, label: "Khám & Điều trị", icon: Stethoscope },
                        { key: "costs" as TabKey, label: "Chi phí KCB", icon: Coins },
                        { key: "system" as TabKey, label: "Phân loại & Hệ thống", icon: SlidersHorizontal },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const count = tabChanges[tab.key];
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                                    isActive
                                        ? "border-primary-600 text-primary-700 bg-primary-50/50"
                                        : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? "text-primary-600" : "text-slate-400"}`} />
                                <span>{tab.label}</span>
                                {count > 0 && (
                                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Modal Body (Tabs Content) ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-slate-50/40">
                    {/* TAB 1: BỆNH NHÂN & THẺ BHYT */}
                    {activeTab === "patient" && (
                        <div className="space-y-6">
                            {/* Section: Thông tin hành chính */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <User className="w-4 h-4 text-primary-600" />
                                    <span>Thông tin hành chính bệnh nhân</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                    {renderField("ho_ten")}
                                    {renderField("ma_bn", undefined, { hint: "Mã định danh bệnh nhân" })}
                                    {renderField("ngay_sinh", undefined, { hint: "Định dạng YYYY-MM-DD hoặc YYYYMMDD" })}
                                    {renderField(
                                        "gioi_tinh",
                                        <select
                                            value={draft["gioi_tinh"] ?? ""}
                                            onChange={(e) => handleFieldChange("gioi_tinh", e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-medium text-slate-800"
                                        >
                                            <option value="">-- Chọn giới tính --</option>
                                            {GIOI_TINH_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {renderField("stt", undefined, { hint: "Số thứ tự dòng trong file gốc" })}
                                    {renderField("dia_chi", undefined, { fullWidth: true, hint: "Địa chỉ nơi cư trú của bệnh nhân" })}
                                </div>
                            </div>

                            {/* Section: Thẻ BHYT */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <CreditCard className="w-4 h-4 text-emerald-600" />
                                    <span>Thông tin thẻ BHYT & Đăng ký ban đầu</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                    {renderField("ma_the", undefined, { hint: "15 ký tự mã thẻ BHYT" })}
                                    {renderField("ma_dkbd", undefined, { hint: "Mã nơi ĐK KCB ban đầu (5 số)" })}
                                    {renderField("ma_khuvuc", undefined, { hint: "K1, K2, K3..." })}
                                    {renderField("gt_the_tu", undefined, { hint: "Ngày bắt đầu hiệu lực (YYYYMMDD)" })}
                                    {renderField("gt_the_den", undefined, { hint: "Ngày kết thúc hiệu lực (YYYYMMDD)" })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: KHÁM & ĐIỀU TRỊ */}
                    {activeTab === "treatment" && (
                        <div className="space-y-6">
                            {/* Section: Chẩn đoán ICD-10 */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                        <Stethoscope className="w-4 h-4 text-primary-600" />
                                        <span>Chẩn đoán bệnh (ICD-10)</span>
                                    </div>
                                    {Boolean(row.ma_benh_chinh) && (
                                        <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono font-semibold">
                                            Mã bệnh chính: {unwrap(row.ma_benh_chinh)}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {renderField("ma_benh", undefined, { hint: "Mã ICD-10 bệnh chính (có thể kèm ; phụ)" })}
                                    {renderField("ma_benhkhac", undefined, { hint: "Các mã ICD-10 bệnh kèm theo" })}
                                </div>
                            </div>

                            {/* Section: Quá trình điều trị & Thời gian */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    <span>Vào viện & Ra viện</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                    {renderField("ngay_vao", undefined, { hint: "YYYY-MM-DD HH:mm:ss" })}
                                    {renderField("ngay_ra", undefined, { hint: "YYYY-MM-DD HH:mm:ss" })}
                                    {renderField("so_ngay_dtri", undefined, { hint: "Số ngày điều trị thực tế" })}
                                    {renderField(
                                        "ma_lydo_vvien",
                                        <select
                                            value={draft["ma_lydo_vvien"] ?? ""}
                                            onChange={(e) => handleFieldChange("ma_lydo_vvien", e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-medium text-slate-800"
                                        >
                                            <option value="">-- Chọn lý do vào viện --</option>
                                            {LYDO_VVIEN_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    )}
                                    {renderField("ma_noi_chuyen", undefined, { hint: "Mã CSKCB chuyển tuyến" })}
                                    {renderField(
                                        "ket_qua_dtri",
                                        <select
                                            value={draft["ket_qua_dtri"] ?? ""}
                                            onChange={(e) => handleFieldChange("ket_qua_dtri", e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-medium text-slate-800"
                                        >
                                            <option value="">-- Chọn kết quả ĐT --</option>
                                            {KET_QUA_DTRI_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    )}
                                    {renderField(
                                        "tinh_trang_rv",
                                        <select
                                            value={draft["tinh_trang_rv"] ?? ""}
                                            onChange={(e) => handleFieldChange("tinh_trang_rv", e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-medium text-slate-800"
                                        >
                                            <option value="">-- Chọn tình trạng ra viện --</option>
                                            {TINH_TRANG_RV_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: CHI PHÍ KCB */}
                    {activeTab === "costs" && (
                        <div className="space-y-6">
                            {/* Summary 4 Big Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col">
                                    <span className="text-xs font-semibold text-indigo-700">Tổng chi phí</span>
                                    <span className="text-lg font-bold text-indigo-900 mt-1">
                                        {formatVND(draft["t_tongchi"])}
                                    </span>
                                    <span className="text-[10px] text-indigo-500 mt-0.5 font-mono">t_tongchi</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col">
                                    <span className="text-xs font-semibold text-emerald-700">BH thanh toán</span>
                                    <span className="text-lg font-bold text-emerald-900 mt-1">
                                        {formatVND(draft["t_bhtt"])}
                                    </span>
                                    <span className="text-[10px] text-emerald-500 mt-0.5 font-mono">t_bhtt</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col">
                                    <span className="text-xs font-semibold text-amber-700">BN thanh toán</span>
                                    <span className="text-lg font-bold text-amber-900 mt-1">
                                        {formatVND(draft["t_bntt"])}
                                    </span>
                                    <span className="text-[10px] text-amber-500 mt-0.5 font-mono">t_bntt</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col">
                                    <span className="text-xs font-semibold text-rose-700">Ngoài danh sách</span>
                                    <span className="text-lg font-bold text-rose-900 mt-1">
                                        {formatVND(draft["t_ngoaids"])}
                                    </span>
                                    <span className="text-[10px] text-rose-500 mt-0.5 font-mono">t_ngoaids</span>
                                </div>
                            </div>

                            {/* Section: Nhập liệu chi phí chính */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <Coins className="w-4 h-4 text-amber-600" />
                                    <span>Tổng số & Trách nhiệm chi trả</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                    {renderField("t_tongchi")}
                                    {renderField("t_bhtt")}
                                    {renderField("t_bntt")}
                                    {renderField("t_ngoaids")}
                                </div>
                            </div>

                            {/* Section: Thuốc, Vật tư, Cận lâm sàng */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    <span>Chi tiết các khoản mục dịch vụ y tế (VNĐ)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                    {renderField("t_thuoc")}
                                    {renderField("t_thuoc_tyle")}
                                    {renderField("t_vtyt")}
                                    {renderField("t_vtyt_tyle")}
                                    {renderField("t_xn")}
                                    {renderField("t_cdha")}
                                    {renderField("t_pttt")}
                                    {renderField("t_mau")}
                                    {renderField("t_kham")}
                                    {renderField("t_giuong")}
                                    {renderField("t_dvkt_tyle")}
                                    {renderField("t_vchuyen")}
                                </div>
                            </div>

                            {/* Section: Quản lý chi phí khác */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <AlertCircle className="w-4 h-4 text-purple-600" />
                                    <span>Xuất toán, Đa tuyến & Khoản mục khác</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                    {renderField("t_xuattoan")}
                                    {renderField("t_nguonkhac")}
                                    {renderField("t_datuyen")}
                                    {renderField("t_vuottran")}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: PHÂN LOẠI & HỆ THỐNG */}
                    {activeTab === "system" && (
                        <div className="space-y-6">
                            {/* Section: Phân loại cơ sở & Khoa */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <SlidersHorizontal className="w-4 h-4 text-primary-600" />
                                    <span>Phân loại KCB & Cơ sở điều trị</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                    {renderField(
                                        "ma_khoa",
                                        <div className="space-y-1">
                                            <input
                                                type="text"
                                                value={draft["ma_khoa"] ?? ""}
                                                onChange={(e) => handleFieldChange("ma_khoa", e.target.value)}
                                                placeholder="Mã khoa..."
                                                list="khoa-suggestions"
                                                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-medium text-slate-800"
                                            />
                                            <datalist id="khoa-suggestions">
                                                {khoaList.map((k, i) => (
                                                    <option key={`${k.makhoa_xml}_${i}`} value={k.makhoa_xml}>
                                                        {k.short_name} ({k.full_name})
                                                    </option>
                                                ))}
                                            </datalist>
                                        </div>,
                                        { hint: "Gõ hoặc chọn từ danh mục khoa" }
                                    )}

                                    {renderField(
                                        "ma_loaikcb",
                                        <select
                                            value={draft["ma_loaikcb"] ?? ""}
                                            onChange={(e) => handleFieldChange("ma_loaikcb", e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-medium text-slate-800"
                                        >
                                            <option value="">-- Chọn loại KCB --</option>
                                            {(loaiKcbList.length > 0
                                                ? loaiKcbList.map((l) => ({
                                                      value: String(l.ma_loaikcb),
                                                      label: `${l.ma_loaikcb} - ${l.ml4} (${l.ml2})`,
                                                  }))
                                                : DEFAULT_LOAIKCB_OPTIONS
                                            ).map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {renderField(
                                        "ma_cskcb",
                                        <select
                                            value={draft["ma_cskcb"] ?? ""}
                                            onChange={(e) => handleFieldChange("ma_cskcb", e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all font-medium text-slate-800"
                                        >
                                            <option value="">-- Chọn CSKCB --</option>
                                            {(cskcbList.length > 0
                                                ? cskcbList.map((c) => ({
                                                      value: String(c.ma_cskcb),
                                                      label: `${c.ma_cskcb} - ${c.ten_cskcb}`,
                                                  }))
                                                : DEFAULT_CSKCB_OPTIONS
                                            ).map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {renderField("nam_qt", undefined, { hint: "Năm quyết toán (VD: 2026)" })}
                                    {renderField("thang_qt", undefined, { hint: "Tháng quyết toán (1 - 12)" })}
                                    {renderField("noi_ttoan")}
                                    {renderField("giam_dinh")}
                                </div>
                            </div>

                            {/* Section: Trường ánh xạ tự động (Chỉ xem) */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <Lock className="w-4 h-4 text-indigo-500" />
                                    <span>Giá trị ánh xạ tự động (Từ bảng danh mục)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                    {renderReadOnly("khoa", "Tên khoa ánh xạ")}
                                    {renderReadOnly("ten_cskcb", "Tên cơ sở KCB")}
                                    {renderReadOnly("ml2", "Phân loại Nội/Ngoại trú")}
                                    {renderReadOnly("ml4", "Loại KCB chi tiết")}
                                    {renderReadOnly("ma_benh_chinh", "Mã bệnh chính")}
                                </div>
                            </div>

                            {/* Section: Metadata hệ thống */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
                                    <Info className="w-4 h-4 text-slate-500" />
                                    <span>Thông tin hệ thống & Metadata</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                    {renderReadOnly(
                                        "is_normalized",
                                        "Chuẩn hóa dữ liệu",
                                        row.is_normalized === true || row.is_normalized === "true"
                                            ? "✓ Đã chuẩn hóa"
                                            : "✗ Chưa chuẩn hóa"
                                    )}
                                    {renderReadOnly("upload_timestamp", "Thời điểm tải lên")}
                                    {renderReadOnly("normalized_at", "Thời điểm chuẩn hóa")}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Modal Footer ── */}
                <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {hasChanges ? (
                            <>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                    Đã thay đổi {changedCount} trường
                                </span>
                                <button
                                    type="button"
                                    onClick={handleRevertAll}
                                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium hover:underline cursor-pointer"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác tất cả
                                </button>
                            </>
                        ) : (
                            <span className="text-xs text-slate-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Chưa có thay đổi nào
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!hasChanges || loading}
                            className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang lưu vào BigQuery...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Lưu thay đổi {hasChanges ? `(${changedCount})` : ""}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
