"use client";

import { useState, useRef, useMemo } from "react";
import SectionTitle from "@/components/ui/SectionTitle";
import InfoBanner from "@/components/ui/InfoBanner";
import DataTable, { Column } from "@/components/ui/DataTable";

/* ── Types ── */

interface SheetData {
    sheetName: string;
    matchedCols: number;
    validRows: Record<string, unknown>[];
    invalidCount: number;
    dupCount: number;
    newCount: number;
    issues: { col: string; count: number }[];
    summary: { period: string; maCSKCB: string; rows: number; tongChi: string }[];
}

type TabFilter = "valid" | "duplicate";

const DISPLAY_COLS: Column[] = [
    { key: "stt", label: "STT", align: "center", width: 60 },
    { key: "ma_bn", label: "Mã BN" },
    { key: "ho_ten", label: "Họ tên" },
    { key: "ngay_sinh", label: "Ngày sinh", align: "center" },
    { key: "gioi_tinh", label: "GT", align: "center", width: 40 },
    { key: "ma_cskcb", label: "CSKCB", align: "center" },
    { key: "ngay_vao", label: "Ngày vào", align: "center" },
    { key: "ngay_ra", label: "Ngày ra", align: "center" },
    { key: "t_tongchi", label: "Tổng chi", align: "right" },
    { key: "t_bhtt", label: "BH thanh toán", align: "right" },
    { key: "_status", label: "Trạng thái", align: "center", width: 80 },
];

export default function TabImport() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sheets, setSheets] = useState<SheetData[]>([]);
    const [selectedSheet, setSelectedSheet] = useState("");
    const [selectedTab, setSelectedTab] = useState<TabFilter>("valid");
    const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set());
    const [removedRows, setRemovedRows] = useState<Set<number>>(new Set());
    const [searchKeyword, setSearchKeyword] = useState("");
    const [uploadMsg, setUploadMsg] = useState<string | null>(null);
    // Tracks rows that have been successfully uploaded/overwritten (by original index)
    const [doneRows, setDoneRows] = useState<Set<number>>(new Set());
    const [doneMode, setDoneMode] = useState<Record<number, "new" | "overwrite">>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── File handling ── */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setSheets([]);
            setUploadMsg(null);
            setError(null);
            setCheckedRows(new Set());
            setRemovedRows(new Set());
            setDoneRows(new Set());
            setDoneMode({});
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
            setFile(f);
            setSheets([]);
            setUploadMsg(null);
            setError(null);
            setCheckedRows(new Set());
            setRemovedRows(new Set());
            setDoneRows(new Set());
            setDoneMode({});
        }
    };

    /* ── Validate (POST) ── */
    const handleValidate = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        setSheets([]);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/bq/overview/import", {
                method: "POST",
                body: formData,
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            const sheetsData: SheetData[] = d.sheets || [];
            setSheets(sheetsData);
            if (sheetsData.length > 0) {
                setSelectedSheet(sheetsData[0].sheetName);
                setSelectedTab("valid");
                // Auto-check all valid (non-duplicate) rows
                const firstSheet = sheetsData[0];
                const validIndices = new Set<number>();
                firstSheet.validRows.forEach((row, i) => {
                    if (!row._isDuplicate) validIndices.add(i);
                });
                setCheckedRows(validIndices);
                setRemovedRows(new Set());
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    /* ── Upload (PUT) ── */
    const handleUpload = async (mode: "new" | "overwrite") => {
        if (!file || !currentSheet) return;
        setLoading(true);
        setError(null);

        // Collect checked row original indices (_idx), filter removed, and filter by type
        const activeRows = currentSheet.validRows.filter(
            (row, i) => !removedRows.has(i) && checkedRows.has(i) &&
                (mode === "new" ? !row._isDuplicate : row._isDuplicate)
        );
        const rowIndices = activeRows.map((r) => r._idx as number);

        if (rowIndices.length === 0) {
            setError(mode === "new"
                ? "Không có dòng mới nào được chọn."
                : "Không có dòng trùng nào được chọn để ghi đè.");
            setLoading(false);
            return;
        }

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("sheet", selectedSheet);
            formData.append("rowIndices", JSON.stringify(rowIndices));
            formData.append("mode", mode);

            const res = await fetch("/api/bq/overview/import", {
                method: "PUT",
                body: formData,
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            // Mark uploaded rows as done
            const uploadedOriginalIndices = activeRows.map((_, idx) => {
                const row = activeRows[idx];
                return currentSheet.validRows.indexOf(row);
            }).filter(i => i >= 0);
            // Use the original row indices from checked
            const doneIndices = currentSheet.validRows
                .map((row, i) => ({ row, i }))
                .filter(({ i }) => !removedRows.has(i) && checkedRows.has(i) &&
                    (mode === "new" ? !currentSheet.validRows[i]._isDuplicate : currentSheet.validRows[i]._isDuplicate))
                .map(({ i }) => i);

            setDoneRows((prev) => {
                const next = new Set(prev);
                doneIndices.forEach((i) => next.add(i));
                return next;
            });
            setDoneMode((prev) => {
                const next = { ...prev };
                doneIndices.forEach((i) => { next[i] = mode; });
                return next;
            });
            // Uncheck done rows
            setCheckedRows((prev) => {
                const next = new Set(prev);
                doneIndices.forEach((i) => next.delete(i));
                return next;
            });

            if (d.mode === "overwrite") {
                setUploadMsg(`✅ Đã ghi đè ${d.uploaded?.toLocaleString() || 0} dòng (xóa ${d.deleted?.toLocaleString() || 0} bản ghi cũ).`);
            } else {
                setUploadMsg(`✅ Đã tải lên ${d.uploaded?.toLocaleString() || 0} dòng mới thành công!`);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    /* ── Delete selected rows (local only) ── */
    const handleLocalDelete = () => {
        setRemovedRows((prev) => {
            const next = new Set(prev);
            checkedRows.forEach((i) => next.add(i));
            return next;
        });
        setCheckedRows(new Set());
    };

    /* ── Switch sheet ── */
    const handleSheetChange = (name: string) => {
        setSelectedSheet(name);
        setSelectedTab("valid");
        setCheckedRows(new Set());
        setRemovedRows(new Set());
        setDoneRows(new Set());
        setDoneMode({});
        setSearchKeyword("");
        setUploadMsg(null);
        // Auto-check all valid rows of new sheet
        const sheet = sheets.find((s) => s.sheetName === name);
        if (sheet) {
            const validIndices = new Set<number>();
            sheet.validRows.forEach((row, i) => {
                if (!row._isDuplicate) validIndices.add(i);
            });
            setCheckedRows(validIndices);
        }
    };

    /* ── Derived data ── */
    const currentSheet = sheets.find((s) => s.sheetName === selectedSheet);

    const filteredRows = useMemo(() => {
        if (!currentSheet) return [];
        let rows: Record<string, unknown>[] = currentSheet.validRows
            .map((row, originalIdx) => ({ ...row, _displayIdx: originalIdx }))
            .filter((_, i) => !removedRows.has(i));

        // Tab filter
        if (selectedTab === "valid") {
            rows = rows.filter((r) => !r._isDuplicate);
        } else {
            rows = rows.filter((r) => r._isDuplicate);
        }

        // Search filter
        if (searchKeyword.trim()) {
            const kw = searchKeyword.toLowerCase();
            rows = rows.filter((r) =>
                Object.entries(r).some(
                    ([k, v]) =>
                        !k.startsWith("_") &&
                        String(v ?? "")
                            .toLowerCase()
                            .includes(kw)
                )
            );
        }

        // Add status badge based on done state
        return rows.map((r) => {
            const origIdx = r._displayIdx as number;
            let status = "Chưa tải lên";
            if (doneRows.has(origIdx)) {
                status = doneMode[origIdx] === "overwrite" ? "✅ Đã ghi đè" : "✅ Đã tải lên";
            }
            return { ...r, _status: status };
        });
    }, [currentSheet, removedRows, selectedTab, searchKeyword, doneRows, doneMode]) as Record<string, unknown>[];

    // Counts
    const validCount = currentSheet
        ? currentSheet.validRows.filter((_, i) => !removedRows.has(i) && !currentSheet.validRows[i]._isDuplicate).length
        : 0;
    const dupCount = currentSheet
        ? currentSheet.validRows.filter((_, i) => !removedRows.has(i) && currentSheet.validRows[i]._isDuplicate).length
        : 0;
    const checkedNewCount = currentSheet
        ? [...checkedRows].filter((i) => !removedRows.has(i) && !doneRows.has(i) && currentSheet.validRows[i] && !currentSheet.validRows[i]._isDuplicate).length
        : 0;
    const checkedDupCount = currentSheet
        ? [...checkedRows].filter((i) => !removedRows.has(i) && !doneRows.has(i) && currentSheet.validRows[i] && currentSheet.validRows[i]._isDuplicate).length
        : 0;

    // Map filtered row indices back to original for selection tracking
    const selectionAdapter = useMemo(() => {
        const displayToOriginal = new Map<number, number>();
        filteredRows.forEach((r, displayIdx) => {
            displayToOriginal.set(displayIdx, r._displayIdx as number);
        });
        return displayToOriginal;
    }, [filteredRows]);

    const displaySelectedRows = useMemo(() => {
        const set = new Set<number>();
        filteredRows.forEach((r, displayIdx) => {
            if (checkedRows.has(r._displayIdx as number)) set.add(displayIdx);
        });
        return set;
    }, [filteredRows, checkedRows]);

    // Disabled rows (already uploaded/overwritten) mapped to display indices
    const displayDisabledRows = useMemo(() => {
        const set = new Set<number>();
        filteredRows.forEach((r, displayIdx) => {
            if (doneRows.has(r._displayIdx as number)) set.add(displayIdx);
        });
        return set;
    }, [filteredRows, doneRows]);

    // Row className for done rows (green background)
    const getRowClassName = (displayIdx: number): string => {
        const origIdx = selectionAdapter.get(displayIdx);
        if (origIdx !== undefined && doneRows.has(origIdx)) return "row-done";
        return "";
    };

    const handleSelectionChange = (displayIndices: Set<number>) => {
        setCheckedRows((prev) => {
            const next = new Set(prev);
            // Uncheck all in current filtered view
            filteredRows.forEach((r) => {
                next.delete(r._displayIdx as number);
            });
            // Check selected ones
            displayIndices.forEach((di) => {
                const orig = selectionAdapter.get(di);
                if (orig !== undefined) next.add(orig);
            });
            return next;
        });
    };

    /* ── Reset ── */
    const handleReset = () => {
        setFile(null);
        setSheets([]);
        setUploadMsg(null);
        setError(null);
        setCheckedRows(new Set());
        setRemovedRows(new Set());
        setDoneRows(new Set());
        setDoneMode({});
        setSearchKeyword("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div>
            <SectionTitle icon="📥">Import dữ liệu Excel lên BigQuery</SectionTitle>

            <InfoBanner type="info">
                Upload file Excel chứa dữ liệu thanh toán BHYT. Hệ thống sẽ tự động
                phát hiện sheet, kiểm tra cấu trúc, xác nhận trùng lặp trước khi tải lên.
            </InfoBanner>

            {error && <InfoBanner type="error">❌ {error}</InfoBanner>}

            {/* File upload zone: only show drop zone when no file */}
            {!file && (
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
                    <div className="upload-placeholder">
                        <span className="upload-icon">📤</span>
                        <p>Kéo thả file Excel hoặc click để chọn</p>
                        <small>.xlsx, .xls</small>
                    </div>
                </div>
            )}

            {/* Hidden file input for when file is already selected */}
            {file && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                />
            )}

            {/* File selected but not yet validated */}
            {file && sheets.length === 0 && doneRows.size === 0 && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 1rem",
                    background: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    marginTop: "0.75rem",
                }}>
                    <span style={{ fontSize: "1.2rem" }}>📁</span>
                    <span style={{ fontWeight: 600 }}>{file.name}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleValidate}
                        disabled={loading}
                        style={{ marginLeft: "0.5rem" }}
                    >
                        {loading ? (
                            <><span className="spinner" /> Đang kiểm tra...</>
                        ) : (
                            "🔍 Kiểm tra"
                        )}
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleReset}
                        style={{ marginLeft: "auto" }}
                        title="Hủy file"
                    >
                        ✕ Hủy
                    </button>
                </div>
            )}

            {/* ── Results ── */}
            {sheets.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                    {/* File info + Sheet selector row */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginBottom: "1rem",
                        flexWrap: "wrap",
                    }}>
                        {/* File info box */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.45rem 1rem",
                            background: "var(--accent-bg, rgba(59,130,246,0.08))",
                            border: "1px solid var(--accent, #3b82f6)",
                            borderRadius: 8,
                            fontSize: "0.9rem",
                        }}>
                            <span>📁</span>
                            <strong>{file!.name}</strong>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                ({(file!.size / 1024).toFixed(1)} KB)
                            </span>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={handleReset}
                                style={{ marginLeft: "0.25rem", padding: "0.15rem 0.5rem", fontSize: "0.8rem" }}
                                title="Hủy file, xóa dữ liệu"
                            >
                                ✕ Hủy
                            </button>
                        </div>

                        {/* Sheet selector */}
                        {sheets.length > 1 && (
                            <select
                                className="form-select"
                                value={selectedSheet}
                                onChange={(e) => handleSheetChange(e.target.value)}
                                style={{
                                    fontWeight: 600,
                                    fontSize: "0.9rem",
                                    padding: "0.45rem 1rem",
                                    background: "var(--success-bg, rgba(34,197,94,0.08))",
                                    border: "1px solid var(--success, #22c55e)",
                                    borderRadius: 8,
                                }}
                            >
                                {sheets.map((s) => (
                                    <option key={s.sheetName} value={s.sheetName}>
                                        📄 {s.sheetName} ({s.matchedCols} cột, {s.validRows.length} dòng)
                                    </option>
                                ))}
                            </select>
                        )}
                        {sheets.length === 1 && (
                            <span style={{
                                padding: "0.45rem 1rem",
                                background: "var(--success-bg, rgba(34,197,94,0.08))",
                                border: "1px solid var(--success, #22c55e)",
                                borderRadius: 8,
                                fontSize: "0.9rem",
                                fontWeight: 600,
                            }}>
                                📄 {sheets[0].sheetName} ({sheets[0].matchedCols} cột, {sheets[0].validRows.length} dòng)
                            </span>
                        )}
                    </div>

                    {/* Summary table */}
                    {currentSheet && currentSheet.summary.length > 0 && (
                        <>
                            <SectionTitle icon="📖">Tóm tắt dữ liệu</SectionTitle>
                            <div className="data-table-wrapper" style={{ marginBottom: "1rem" }}>
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
                                        {currentSheet.summary.map((s, i) => (
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
                        </>
                    )}

                    <hr className="divider" />

                    {/* Tabs: underlined tab navigation */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1.5rem",
                        borderBottom: "2px solid var(--border)",
                        marginBottom: "0.75rem",
                    }}>
                        <button
                            onClick={() => setSelectedTab("valid")}
                            style={{
                                background: "none",
                                border: "none",
                                padding: "0.5rem 0",
                                cursor: "pointer",
                                fontWeight: selectedTab === "valid" ? 700 : 400,
                                color: selectedTab === "valid" ? "var(--accent)" : "var(--text-muted)",
                                borderBottom: selectedTab === "valid" ? "2px solid var(--accent)" : "2px solid transparent",
                                marginBottom: "-2px",
                                fontSize: "0.95rem",
                            }}
                        >
                            ✅ Hợp lệ ({validCount})
                        </button>
                        <button
                            onClick={() => setSelectedTab("duplicate")}
                            style={{
                                background: "none",
                                border: "none",
                                padding: "0.5rem 0",
                                cursor: "pointer",
                                fontWeight: selectedTab === "duplicate" ? 700 : 400,
                                color: selectedTab === "duplicate" ? "var(--warning)" : "var(--text-muted)",
                                borderBottom: selectedTab === "duplicate" ? "2px solid var(--warning)" : "2px solid transparent",
                                marginBottom: "-2px",
                                fontSize: "0.95rem",
                            }}
                        >
                            📋 Trùng lặp ({dupCount})
                        </button>

                        {/* Search + Delete */}
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <input
                                type="search"
                                className="form-input"
                                placeholder="🔍 Tìm kiếm bản ghi..."
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                style={{ maxWidth: 240, height: 36 }}
                            />
                            {checkedRows.size > 0 && (
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={handleLocalDelete}
                                    style={{ whiteSpace: "nowrap", height: 36 }}
                                >
                                    🗑️ Xóa ({checkedRows.size})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Data table */}
                    <DataTable
                        columns={DISPLAY_COLS}
                        data={filteredRows}
                        selectable
                        selectedRows={displaySelectedRows}
                        disabledRows={displayDisabledRows}
                        onSelectionChange={handleSelectionChange}
                        stickyHeader
                        rowClassName={getRowClassName}
                    />

                    {/* Inline success message */}
                    {uploadMsg && (
                        <div style={{
                            marginTop: "0.75rem",
                            padding: "0.5rem 1rem",
                            background: "var(--success-bg, rgba(34,197,94,0.08))",
                            border: "1px solid var(--success, #22c55e)",
                            borderRadius: 8,
                            color: "var(--success, #22c55e)",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            textAlign: "center",
                        }}>
                            {uploadMsg}
                        </div>
                    )}

                    {/* Action buttons: tab-conditional */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: "0.75rem",
                            marginTop: "1rem",
                        }}
                    >
                        {/* Ghi đè: only on duplicate tab */}
                        {selectedTab === "duplicate" && dupCount > 0 && (
                            <button
                                className="btn btn-warning"
                                onClick={() => handleUpload("overwrite")}
                                disabled={loading || checkedDupCount === 0}
                                style={{ height: 44 }}
                            >
                                {loading ? (
                                    <><span className="spinner" /> Đang ghi đè...</>
                                ) : (
                                    `🔄 Xác nhận ghi đè (${checkedDupCount})`
                                )}
                            </button>
                        )}

                        {/* Tải lên mới: only on valid tab */}
                        {selectedTab === "valid" && (
                            <button
                                className="btn btn-primary"
                                onClick={() => handleUpload("new")}
                                disabled={loading || checkedNewCount === 0}
                                style={{ height: 44 }}
                            >
                                {loading ? (
                                    <><span className="spinner" /> Đang tải lên...</>
                                ) : (
                                    `☁️ Tải lên mới (${checkedNewCount})`
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
