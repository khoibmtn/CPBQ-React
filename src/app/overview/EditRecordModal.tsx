"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Save, Loader2, Lock } from "lucide-react";
import { SCHEMA_COLS, MAPPED_COLS, METADATA_COLS } from "@/lib/schema";

type Row = Record<string, unknown>;

interface EditRecordModalProps {
    open: boolean;
    row: Row | null;
    onClose: () => void;
    onSave: (originalRow: Row, updatedFields: Row) => Promise<void>;
    loading?: boolean;
}

/* ── Column display names ── */
const COL_LABELS: Record<string, string> = {
    stt: "STT", ma_bn: "Mã BN", ho_ten: "Họ tên", ngay_sinh: "Ngày sinh",
    gioi_tinh: "Giới tính", dia_chi: "Địa chỉ", ma_the: "Mã thẻ",
    ma_dkbd: "Mã ĐKBD", gt_the_tu: "GT thẻ từ", gt_the_den: "GT thẻ đến",
    ma_benh: "Mã bệnh", ma_benhkhac: "Mã bệnh khác",
    ma_lydo_vvien: "Lý do VV", ma_noi_chuyen: "Nơi chuyển",
    ngay_vao: "Ngày vào", ngay_ra: "Ngày ra", so_ngay_dtri: "Số ngày ĐT",
    ket_qua_dtri: "Kết quả ĐT", tinh_trang_rv: "Tình trạng RV",
    t_tongchi: "Tổng chi", t_xn: "Xét nghiệm", t_cdha: "CĐHA",
    t_thuoc: "Thuốc", t_mau: "Máu", t_pttt: "PTTT", t_vtyt: "VTYT",
    t_dvkt_tyle: "DVKT tỷ lệ", t_thuoc_tyle: "Thuốc tỷ lệ",
    t_vtyt_tyle: "VTYT tỷ lệ", t_kham: "Khám", t_giuong: "Giường",
    t_vchuyen: "Vận chuyển", t_bntt: "BN thanh toán", t_bhtt: "BH thanh toán",
    t_ngoaids: "Ngoài DS", ma_khoa: "Mã khoa", nam_qt: "Năm QT",
    thang_qt: "Tháng QT", ma_khuvuc: "Mã khu vực", ma_loaikcb: "Loại KCB",
    ma_cskcb: "Mã CSKCB", noi_ttoan: "Nơi thanh toán", giam_dinh: "Giám định",
    t_xuattoan: "Xuất toán", t_nguonkhac: "Nguồn khác",
    t_datuyen: "Đa tuyến", t_vuottran: "Vượt trần",
    // Mapped columns
    ten_cskcb: "Tên CSKCB", khoa: "Khoa", ml2: "Nội/Ngoại trú",
    ml4: "Loại KCB (tên)", ma_benh_chinh: "Mã bệnh chính",
    // Metadata
    upload_timestamp: "Ngày tải lên", is_normalized: "Chuẩn hóa",
    normalized_at: "Ngày chuẩn hóa",
};

/* ── Grouped field layout ── */
const FIELD_GROUPS = [
    {
        title: "🏥 Thông tin bệnh nhân",
        cols: ["stt", "ma_bn", "ho_ten", "ngay_sinh", "gioi_tinh", "dia_chi"],
    },
    {
        title: "💳 Thẻ BHYT",
        cols: ["ma_the", "ma_dkbd", "gt_the_tu", "gt_the_den"],
    },
    {
        title: "🩺 Chẩn đoán & Điều trị",
        cols: ["ma_benh", "ma_benhkhac", "ma_lydo_vvien", "ma_noi_chuyen",
            "ngay_vao", "ngay_ra", "so_ngay_dtri", "ket_qua_dtri", "tinh_trang_rv"],
    },
    {
        title: "💰 Chi phí",
        cols: ["t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau", "t_pttt",
            "t_vtyt", "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle",
            "t_kham", "t_giuong", "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids",
            "t_xuattoan", "t_nguonkhac", "t_datuyen", "t_vuottran"],
    },
    {
        title: "📋 Phân loại",
        cols: ["ma_khoa", "nam_qt", "thang_qt", "ma_khuvuc", "ma_loaikcb",
            "ma_cskcb", "noi_ttoan", "giam_dinh"],
    },
];

/* ── Cost columns → use number input ── */
const NUMERIC_COLS = new Set([
    "stt", "gioi_tinh", "so_ngay_dtri", "ket_qua_dtri", "tinh_trang_rv",
    "t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau", "t_pttt", "t_vtyt",
    "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle", "t_kham", "t_giuong",
    "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids", "t_xuattoan", "t_nguonkhac",
    "t_datuyen", "t_vuottran", "nam_qt", "thang_qt", "ma_loaikcb",
    "ma_lydo_vvien", "giam_dinh", "noi_ttoan",
]);

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

export default function EditRecordModal({ open, row, onClose, onSave, loading }: EditRecordModalProps) {
    const [draft, setDraft] = useState<Record<string, string>>({});

    // Populate draft from row on open
    useEffect(() => {
        if (row && open) {
            const d: Record<string, string> = {};
            for (const col of SCHEMA_COLS) {
                d[col] = unwrap(row[col]);
            }
            setDraft(d);
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
                // Try to preserve number type for numeric columns
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

    const hasChanges = Object.keys(changedFields).length > 0;

    // Collect mapped & metadata cols present in the row
    const mappedCols = useMemo(() => {
        if (!row) return [];
        return Object.keys(row).filter((c) => MAPPED_COLS.has(c));
    }, [row]);

    const metaCols = useMemo(() => {
        if (!row) return [];
        return Object.keys(row).filter((c) => METADATA_COLS.has(c) && c !== "source_file");
    }, [row]);

    if (!open || !row) return null;

    const handleFieldChange = (col: string, value: string) => {
        setDraft((prev) => ({ ...prev, [col]: value }));
    };

    const handleSave = () => {
        if (!hasChanges) return;
        onSave(row, changedFields);
    };

    return (
        <div className="edit-modal-overlay" onClick={onClose}>
            <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="edit-modal-header">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-800">
                            ✏️ Sửa hồ sơ
                        </h3>
                        <span className="text-xs text-slate-500">
                            {row.ma_bn ? `MaBN: ${unwrap(row.ma_bn)}` : ""}
                            {row.ho_ten ? ` • ${unwrap(row.ho_ten)}` : ""}
                        </span>
                    </div>
                    <button onClick={onClose} className="edit-modal-close" title="Đóng">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="edit-modal-body">
                    {/* Editable field groups */}
                    {FIELD_GROUPS.map((group) => (
                        <div key={group.title} className="edit-group">
                            <div className="edit-group-title">{group.title}</div>
                            <div className="edit-group-grid">
                                {group.cols.map((col) => {
                                    const original = unwrap(row[col]);
                                    const current = draft[col] ?? "";
                                    const isChanged = current !== original;
                                    const isNumeric = NUMERIC_COLS.has(col);

                                    return (
                                        <div key={col} className="edit-field">
                                            <label className="edit-field-label" title={col}>
                                                {COL_LABELS[col] || col}
                                                <span className="edit-field-colname">{col}</span>
                                            </label>
                                            <input
                                                type={isNumeric ? "text" : "text"}
                                                inputMode={isNumeric ? "decimal" : "text"}
                                                className={`edit-field-input ${isChanged ? "edit-field-changed" : ""}`}
                                                value={current}
                                                onChange={(e) => handleFieldChange(col, e.target.value)}
                                                placeholder="(trống)"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Mapped columns (read-only) */}
                    {mappedCols.length > 0 && (
                        <div className="edit-group">
                            <div className="edit-group-title">
                                <Lock className="w-3.5 h-3.5 inline-block mr-1 opacity-60" />
                                Trường ánh xạ (chỉ xem)
                            </div>
                            <div className="edit-group-grid">
                                {mappedCols.map((col) => (
                                    <div key={col} className="edit-field">
                                        <label className="edit-field-label">
                                            {COL_LABELS[col] || col}
                                            <span className="edit-field-badge">Ánh xạ</span>
                                        </label>
                                        <div className="edit-field-readonly">
                                            {unwrap(row[col]) || "–"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata (read-only) */}
                    {metaCols.length > 0 && (
                        <div className="edit-group">
                            <div className="edit-group-title">
                                <Lock className="w-3.5 h-3.5 inline-block mr-1 opacity-60" />
                                Metadata
                            </div>
                            <div className="edit-group-grid">
                                {metaCols.map((col) => (
                                    <div key={col} className="edit-field">
                                        <label className="edit-field-label">
                                            {COL_LABELS[col] || col}
                                        </label>
                                        <div className="edit-field-readonly">
                                            {col === "is_normalized"
                                                ? (row[col] === true || row[col] === "true" ? "✓ Đã chuẩn hóa" : "✗ Chưa")
                                                : (unwrap(row[col]) || "–")}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="edit-modal-footer">
                    {hasChanges && (
                        <span className="text-xs text-amber-600 font-medium">
                            {Object.keys(changedFields).length} trường đã thay đổi
                        </span>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        <button onClick={onClose} className="edit-btn-cancel" disabled={loading}>
                            Hủy
                        </button>
                        <button
                            onClick={handleSave}
                            className="edit-btn-save"
                            disabled={!hasChanges || loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" /> Lưu thay đổi
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .edit-modal-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 50;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                }
                .edit-modal {
                    background: white;
                    border-radius: 1rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    width: 100%;
                    max-width: 900px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .edit-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                    background: #f8fafc;
                }
                .edit-modal-close {
                    padding: 0.375rem;
                    border-radius: 0.5rem;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.15s;
                    border: none;
                    background: transparent;
                }
                .edit-modal-close:hover {
                    background: #e2e8f0;
                    color: #334155;
                }
                .edit-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.25rem 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .edit-group {
                    border: 1px solid #e2e8f0;
                    border-radius: 0.75rem;
                    overflow: hidden;
                }
                .edit-group-title {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #475569;
                    padding: 0.625rem 1rem;
                    background: #f1f5f9;
                    border-bottom: 1px solid #e2e8f0;
                }
                .edit-group-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0;
                }
                .edit-field {
                    padding: 0.5rem 0.75rem;
                    border-bottom: 1px solid #f1f5f9;
                    border-right: 1px solid #f1f5f9;
                }
                .edit-field:nth-child(3n) {
                    border-right: none;
                }
                .edit-field-label {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin-bottom: 0.25rem;
                }
                .edit-field-colname {
                    font-size: 0.55rem;
                    color: #cbd5e1;
                    font-weight: 400;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .edit-field-badge {
                    font-size: 0.55rem;
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.25rem;
                    background: #e0e7ff;
                    color: #4338ca;
                    font-weight: 600;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .edit-field-input {
                    width: 100%;
                    padding: 0.375rem 0.5rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.375rem;
                    font-size: 0.8rem;
                    color: #1e293b;
                    background: white;
                    transition: all 0.15s;
                    outline: none;
                    font-variant-numeric: tabular-nums;
                }
                .edit-field-input:focus {
                    border-color: #818cf8;
                    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
                }
                .edit-field-input::placeholder {
                    color: #cbd5e1;
                    font-style: italic;
                }
                .edit-field-changed {
                    border-color: #f59e0b !important;
                    background: #fffbeb !important;
                }
                .edit-field-readonly {
                    padding: 0.375rem 0.5rem;
                    border: 1px solid #f1f5f9;
                    border-radius: 0.375rem;
                    font-size: 0.8rem;
                    color: #64748b;
                    background: #f8fafc;
                    font-style: italic;
                }
                .edit-modal-footer {
                    display: flex;
                    align-items: center;
                    padding: 0.875rem 1.5rem;
                    border-top: 1px solid #e2e8f0;
                    background: #f8fafc;
                }
                .edit-btn-cancel {
                    padding: 0.5rem 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.5rem;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #64748b;
                    background: white;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .edit-btn-cancel:hover {
                    background: #f1f5f9;
                }
                .edit-btn-save {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 1.25rem;
                    border: none;
                    border-radius: 0.5rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: white;
                    background: #4f46e5;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .edit-btn-save:hover:not(:disabled) {
                    background: #4338ca;
                }
                .edit-btn-save:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}
