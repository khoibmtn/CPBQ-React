"use client";

import { useState, useRef } from "react";
import SectionTitle from "@/components/ui/SectionTitle";
import InfoBanner from "@/components/ui/InfoBanner";

/* ── Types ── */

interface SheetInfo {
    sheetName: string;
    matchedCols: string[];
    extraCols: string[];
}

interface ValidationResult {
    sheets: SheetInfo[];
    validRows: number;
    invalidRows: number;
    issues: { col: string; count: number }[];
    summary: { period: string; maCSKCB: string; rows: number; tongChi: string }[];
    duplicateCount: number;
    newCount: number;
}

export default function TabImport() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ValidationResult | null>(null);
    const [selectedSheet, setSelectedSheet] = useState("");
    const [uploadDone, setUploadDone] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setResult(null);
            setUploadDone(false);
            setUploadMsg(null);
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
            setFile(f);
            setResult(null);
            setUploadDone(false);
            setUploadMsg(null);
            setError(null);
        }
    };

    const handleValidate = async () => {
        if (!file) return;
        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            if (selectedSheet) {
                formData.append("sheet", selectedSheet);
            }

            const res = await fetch("/api/bq/overview/import", {
                method: "POST",
                body: formData,
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            setResult(d);
            if (d.sheets?.length === 1) {
                setSelectedSheet(d.sheets[0].sheetName);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setUploading(false);
        }
    };

    const handleUpload = async () => {
        if (!file || !selectedSheet) return;
        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("sheet", selectedSheet);
            formData.append("action", "upload");

            const res = await fetch("/api/bq/overview/import", {
                method: "PUT",
                body: formData,
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            setUploadDone(true);
            setUploadMsg(`✅ Đã tải lên ${d.uploaded?.toLocaleString() || 0} dòng thành công!`);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <SectionTitle icon="📥">Import dữ liệu Excel lên BigQuery</SectionTitle>

            <InfoBanner type="info">
                Upload file Excel chứa dữ liệu thanh toán BHYT. Hệ thống sẽ tự động
                phát hiện sheet, kiểm tra cấu trúc, xác nhận trùng lặp trước khi tải lên.
            </InfoBanner>

            {error && <InfoBanner type="error">❌ {error}</InfoBanner>}
            {uploadMsg && <InfoBanner type="success">{uploadMsg}</InfoBanner>}

            {/* File upload zone */}
            <div
                className="file-upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                />
                {file ? (
                    <div className="file-info">
                        <span className="file-icon">📁</span>
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">
                            ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                    </div>
                ) : (
                    <div className="upload-placeholder">
                        <span className="upload-icon">📤</span>
                        <p>Kéo thả file Excel hoặc click để chọn</p>
                        <small>.xlsx, .xls</small>
                    </div>
                )}
            </div>

            {file && !result && (
                <button
                    className="btn btn-primary"
                    onClick={handleValidate}
                    disabled={uploading}
                    style={{ marginTop: "0.75rem" }}
                >
                    {uploading ? (
                        <>
                            <span className="spinner" /> Đang kiểm tra...
                        </>
                    ) : (
                        "🔍 Kiểm tra dữ liệu"
                    )}
                </button>
            )}

            {/* Validation results */}
            {result && (
                <div style={{ marginTop: "1rem" }}>
                    {/* Sheet detection */}
                    {result.sheets.length > 0 && (
                        <>
                            <SectionTitle icon="🔍">Phát hiện sheet dữ liệu</SectionTitle>
                            {result.sheets.length === 1 ? (
                                <InfoBanner type="success">
                                    Tự động phát hiện sheet{" "}
                                    <strong>{result.sheets[0].sheetName}</strong> (
                                    {result.sheets[0].matchedCols.length} cột khớp)
                                </InfoBanner>
                            ) : (
                                <>
                                    <InfoBanner type="info">
                                        Phát hiện <strong>{result.sheets.length}</strong>{" "}
                                        sheet có cấu trúc phù hợp.
                                    </InfoBanner>
                                    <select
                                        className="form-select"
                                        value={selectedSheet}
                                        onChange={(e) =>
                                            setSelectedSheet(e.target.value)
                                        }
                                        style={{ marginTop: "0.5rem" }}
                                    >
                                        {result.sheets.map((s) => (
                                            <option
                                                key={s.sheetName}
                                                value={s.sheetName}
                                            >
                                                📄 {s.sheetName} (
                                                {s.matchedCols.length} cột khớp)
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}
                        </>
                    )}

                    <hr className="divider" />

                    {/* Data summary */}
                    <SectionTitle icon="📖">Tóm tắt dữ liệu</SectionTitle>

                    <InfoBanner type="success">
                        Đọc được <strong>{result.validRows.toLocaleString()}</strong>{" "}
                        dòng hợp lệ
                        {result.invalidRows > 0 && (
                            <>
                                , <strong>{result.invalidRows.toLocaleString()}</strong>{" "}
                                dòng không hợp lệ
                            </>
                        )}
                    </InfoBanner>

                    {result.summary.length > 0 && (
                        <div className="data-table-wrapper" style={{ marginTop: "0.5rem" }}>
                            <table className="data-table data-table-compact">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: "center" }}>Kỳ</th>
                                        <th style={{ textAlign: "center" }}>Mã CSKCB</th>
                                        <th style={{ textAlign: "right" }}>Số dòng</th>
                                        <th style={{ textAlign: "right" }}>Tổng chi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.summary.map((s, i) => (
                                        <tr key={i} className={i % 2 === 0 ? "row-even" : "row-odd"}>
                                            <td style={{ textAlign: "center" }}>{s.period}</td>
                                            <td style={{ textAlign: "center" }}>{s.maCSKCB}</td>
                                            <td className="right">{s.rows.toLocaleString()}</td>
                                            <td className="right">{s.tongChi}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <hr className="divider" />

                    {/* Duplicate info */}
                    <SectionTitle icon="🔍">Kiểm tra trùng lặp</SectionTitle>

                    {result.duplicateCount > 0 ? (
                        <InfoBanner type="warning">
                            <strong>{result.duplicateCount.toLocaleString()}</strong> dòng
                            trùng trên BigQuery,{" "}
                            <strong>{result.newCount.toLocaleString()}</strong> dòng mới.
                        </InfoBanner>
                    ) : (
                        <InfoBanner type="success">
                            <strong>{result.newCount.toLocaleString()}</strong> dòng mới,
                            không có trùng lặp.
                        </InfoBanner>
                    )}

                    {/* Upload button */}
                    {!uploadDone && result.newCount > 0 && (
                        <button
                            className="btn btn-primary"
                            onClick={handleUpload}
                            disabled={uploading}
                            style={{ marginTop: "1rem" }}
                        >
                            {uploading ? (
                                <>
                                    <span className="spinner" /> Đang tải lên...
                                </>
                            ) : (
                                `✅ Xác nhận tải lên ${result.newCount.toLocaleString()} dòng mới`
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
