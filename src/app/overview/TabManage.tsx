"use client";
import React from "react";
import { Loader2, Trash2 } from "lucide-react";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import { SCHEMA_COLS } from "@/lib/schema";
import MetricCard, { MetricGrid } from "@/components/ui/MetricCard";
import SectionTitle from "@/components/ui/SectionTitle";
import InfoBanner from "@/components/ui/InfoBanner";
import DataTable, { Column } from "@/components/ui/DataTable";
import SearchBuilder, { SearchCondition } from "@/components/ui/SearchBuilder";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import * as XLSX from "xlsx";

export default function TabManage() {
    const AUTO_THRESHOLD = 3; // ≤3 years → RAM, >3 → BigQuery

    /* ── State ── */
    const [years, setYears] = useSessionState<number[]>("mg_years", []);
    const [columns, setColumns] = useSessionState<string[]>("mg_columns", []);
    const [fromYear, setFromYear] = useSessionState<number>("mg_fromYear", 0);
    const [toYear, setToYear] = useSessionState<number>("mg_toYear", 0);
    const [method, setMethod] = useSessionState<string>("mg_method", "🧠 Tự động");
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(years.length === 0);
    const [error, setError] = useState<string | null>(null);

    // Data — don't persist large datasets (exceeds 5MB sessionStorage limit)
    const [data, setData] = useState<Record<string, unknown>[] | null>(null);
    const [totalRows, setTotalRows] = useState(0);
    const [dataLoaded, setDataLoaded] = useSessionState("mg_dataLoaded", false);
    const [actualMethod, setActualMethod] = useSessionState("mg_actualMethod", "RAM");

    // Search
    const [conditions, setConditions] = useState<SearchCondition[]>([
        { field: "", keyword: "", operator: "AND" },
    ]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [displayData, setDisplayData] = useState<Record<string, unknown>[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Selection & delete
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

    // Check unlock status from localStorage (shared with Settings page)
    const [isUnlocked, setIsUnlocked] = useState(false);
    useEffect(() => {
        setIsUnlocked(localStorage.getItem("settings_unlocked") === "true");
    }, []);

    /* ── Load initial metadata ── */
    useEffect(() => {
        fetch("/api/bq/overview/manage")
            .then((r) => r.json())
            .then((d) => {
                if (d.error) {
                    setError(d.error);
                    setInitialLoading(false);
                    return;
                }
                const yrs: number[] = d.years || [];
                const cols: string[] = d.columns || [];
                setYears(yrs);
                setColumns(cols);
                if (yrs.length > 0 && fromYear === 0) {
                    const currentYear = new Date().getFullYear();
                    // Default both to current year (or nearest available)
                    const bestYear = yrs.includes(currentYear) ? currentYear : yrs[0];
                    setFromYear(bestYear);
                    setToYear(bestYear);
                }
                if (cols.length > 0 && !conditions[0].field) {
                    setConditions([{ field: cols[0], keyword: "", operator: "AND" }]);
                }
                setInitialLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setInitialLoading(false);
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Determine actual method ── */
    const getActualMethod = useCallback(() => {
        const nYears = toYear - fromYear + 1;
        if (method === "🧠 Tự động") return nYears <= AUTO_THRESHOLD ? "RAM" : "BigQuery";
        if (method === "💾 RAM") return "RAM";
        return "BigQuery";
    }, [method, fromYear, toYear]);

    /* ── Load data ── */
    const handleLoad = useCallback(async () => {
        setLoading(true);
        setError(null);
        setData(null);
        setDisplayData([]);
        setIsSearching(false);
        setSelectedRows(new Set());
        setDeleteMsg(null);

        const resolvedMethod = getActualMethod();
        setActualMethod(resolvedMethod);

        try {
            if (resolvedMethod === "RAM") {
                // Load all rows into memory
                const res = await fetch("/api/bq/overview/manage", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "load", fromYear, toYear }),
                });
                const d = await res.json();
                if (d.error) throw new Error(d.error);
                const loadedData: Record<string, unknown>[] = d.data || [];
                setData(loadedData);
                setDisplayData(loadedData);
                setTotalRows(d.total || 0);
                if (loadedData.length > 0) {
                    const dataCols = Object.keys(loadedData[0]).filter(
                        (c) => c !== "upload_timestamp" && c !== "source_file"
                    );
                    setColumns(dataCols);
                    if (conditions.length === 1 && !conditions[0].keyword) {
                        setConditions([{ field: dataCols[0] || "", keyword: "", operator: "AND" }]);
                    }
                }
            } else {
                // BigQuery mode: only count, don't load data
                const res = await fetch("/api/bq/overview/manage", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "count", fromYear, toYear }),
                });
                const d = await res.json();
                if (d.error) throw new Error(d.error);
                setData([]); // Empty array to indicate "loaded but no local data"
                setTotalRows(d.total || 0);
            }
            setDataLoaded(true);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [fromYear, toYear, getActualMethod]);


    /* ── Search ── */
    const handleSearch = async () => {
        const activeConds = conditions.filter((c) => c.keyword.trim());
        if (activeConds.length === 0) {
            setDisplayData(actualMethod === "RAM" ? (data || []) : []);
            setIsSearching(false);
            return;
        }

        setSearchLoading(true);
        setSelectedRows(new Set());

        try {
            if (actualMethod === "RAM" && data && data.length > 0) {
                // Client-side filtering
                let filtered = [...data];
                for (let i = 0; i < activeConds.length; i++) {
                    const cond = activeConds[i];
                    const keyword = cond.keyword.toLowerCase().trim();
                    const field = cond.field;
                    const matchFn = (row: Record<string, unknown>) => {
                        const val = String(row[field] ?? "").toLowerCase();
                        return val.includes(keyword);
                    };
                    if (i === 0) {
                        filtered = filtered.filter(matchFn);
                    } else {
                        const op = cond.operator || "AND";
                        if (op === "AND") {
                            filtered = filtered.filter(matchFn);
                        } else {
                            // OR: merge with previous results
                            const prevFiltered = filtered;
                            const orResults = (data || []).filter(matchFn);
                            const combined = new Set([...prevFiltered, ...orResults]);
                            filtered = Array.from(combined);
                        }
                    }
                }
                setDisplayData(filtered);
                setIsSearching(true);
            } else {
                // Server-side BigQuery search
                const res = await fetch("/api/bq/overview/manage", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "search",
                        conditions,
                        fromYear,
                        toYear,
                    }),
                });
                const d = await res.json();
                if (d.error) throw new Error(d.error);
                setDisplayData(d.data || []);
                setIsSearching(true);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setSearchLoading(false);
        }
    };

    /* ── Delete ── */
    const DELETE_KEY_COLS = ["ma_cskcb", "ma_bn", "ma_loaikcb", "ngay_vao", "ngay_ra", "upload_timestamp"];

    const handleDelete = async () => {
        setShowDeleteConfirm(false);
        setDeleteLoading(true);
        setError(null);

        // Only send key columns needed for deletion (not the entire row data)
        const rowsToDelete = Array.from(selectedRows).map((idx) => {
            const fullRow = displayData[idx];
            const keyRow: Record<string, unknown> = {};
            for (const col of DELETE_KEY_COLS) {
                if (fullRow[col] !== undefined) keyRow[col] = fullRow[col];
            }
            return keyRow;
        });

        try {
            const res = await fetch("/api/bq/overview/manage", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: rowsToDelete }),
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            if (d.errors && d.errors.length > 0) {
                setError(`Lỗi khi xóa: ${d.errors.join("; ")}`);
            }
            setDeleteMsg(`✅ Đã xóa ${d.deletedCount} / ${d.total} dòng!`);
            setSelectedRows(new Set());

            // Update total count
            if (d.deletedCount > 0) {
                setTotalRows((prev) => Math.max(0, prev - d.deletedCount));
            }

            // Re-run search to refresh results (instead of full reload which clears everything)
            if (isSearching) {
                const activeConds = conditions.filter((c) => c.keyword.trim());
                if (activeConds.length > 0) {
                    const searchRes = await fetch("/api/bq/overview/manage", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "search",
                            conditions,
                            fromYear,
                            toYear,
                        }),
                    });
                    const sd = await searchRes.json();
                    if (!sd.error) {
                        setDisplayData(sd.data || []);
                    }
                }
            } else if (actualMethod === "RAM") {
                // RAM mode: remove deleted rows from local data
                const deletedIndices = new Set(selectedRows);
                const newDisplay = displayData.filter((_, i) => !deletedIndices.has(i));
                setDisplayData(newDisplay);
                if (data) {
                    const fullRowsToDelete = Array.from(selectedRows).map((idx) => displayData[idx]);
                    const rowsToRemoveKeys = new Set(
                        fullRowsToDelete.map((r) => JSON.stringify(r))
                    );
                    setData(data.filter((r) => !rowsToRemoveKeys.has(JSON.stringify(r))));
                }
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setDeleteLoading(false);
        }
    };

    /* ── Column display config ── */
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
        is_normalized: "Chuẩn hóa", normalized_at: "Ngày chuẩn hóa",
        ten_cskcb: "Tên CSKCB", khoa: "Khoa", ml2: "Nội/Ngoại trú", ml4: "Loại KCB",
        ma_benh_chinh: "Mã bệnh chính", upload_timestamp: "Ngày tải lên",
    };

    const RIGHT_ALIGN_COLS = new Set([
        "t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau", "t_pttt", "t_vtyt",
        "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle", "t_kham", "t_giuong",
        "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids", "t_xuattoan", "t_nguonkhac",
        "t_datuyen", "t_vuottran", "so_ngay_dtri",
    ]);

    const CENTER_ALIGN_COLS = new Set([
        "stt", "ngay_sinh", "gioi_tinh", "ngay_vao", "ngay_ra", "ma_cskcb",
        "ma_dkbd", "ma_khoa", "ma_loaikcb", "ma_khuvuc", "nam_qt", "thang_qt",
        "ket_qua_dtri", "tinh_trang_rv", "ma_lydo_vvien", "noi_ttoan",
        "giam_dinh", "is_normalized",
    ]);

    /* ── Build table columns ── */
    // Derive columns from actual display data when available
    const effectiveCols = displayData.length > 0
        ? Object.keys(displayData[0]).filter(
            (c) => c !== "upload_timestamp" && c !== "source_file"
        )
        : columns;

    const tableColumns: Column[] = effectiveCols.map((col) => ({
        key: col,
        label: COL_LABELS[col] || col,
        align: (RIGHT_ALIGN_COLS.has(col) ? "right" : CENTER_ALIGN_COLS.has(col) ? "center" : "left") as "left" | "center" | "right",
        ...(col === "is_normalized" ? {
            width: 80,
            render: (val: unknown) => {
                const v = val === true || val === "true" || val === 1 || val === "1";
                return v ? React.createElement("span", { className: "text-green-600 font-bold" }, "x") : "";
            },
        } : {}),
    }));

    /* ── Row styling: blue text for normalized rows ── */
    const getRowClassName = (displayIdx: number): string => {
        const row = displayData[displayIdx];
        if (!row) return "";
        const v = row.is_normalized;
        if (v === true || v === "true" || v === 1 || v === "1") return "text-blue-600";
        return "";
    };

    /* ── Export Excel ── */
    const handleExportExcel = useCallback(() => {
        if (displayData.length === 0) return;

        /** Reverse ISO date "YYYY-MM-DD" → integer 19770902 */
        const dateToInt = (val: unknown): number | unknown => {
            if (val == null || val === "") return val;
            const s = String(val).trim();
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) return Number(`${m[1]}${m[2]}${m[3]}`);
            return val;
        };

        /** Reverse ISO datetime "YYYY-MM-DDThh:mm:ss" → "'YYYYMMDDHHmm" */
        const datetimeToCompact = (val: unknown): string | unknown => {
            if (val == null || val === "") return val;
            const s = String(val).trim();
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
            if (m) return `'${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}`;
            return val;
        };

        const DATE_INT_COLS = new Set(["ngay_sinh", "gt_the_tu", "gt_the_den"]);
        const DATETIME_COLS = new Set(["ngay_vao", "ngay_ra"]);

        // Unwrap BQ objects, enforce SCHEMA_COLS order, reverse-transform dates
        const exportData = displayData.map((row) => {
            const out: Record<string, unknown> = {};
            for (const col of SCHEMA_COLS) {
                let val = row[col];
                // Unwrap BigQuery wrapper objects
                if (val != null && typeof val === "object" && "value" in (val as Record<string, unknown>)) {
                    val = (val as Record<string, unknown>).value;
                }
                // Reverse-transform dates to original format
                if (DATE_INT_COLS.has(col)) {
                    val = dateToInt(val);
                } else if (DATETIME_COLS.has(col)) {
                    val = datetimeToCompact(val);
                }
                out[col] = val ?? "";
            }
            return out;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        const fileName = `BHYT_${fromYear}-${toYear}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }, [displayData, fromYear, toYear]);

    /* ── Metrics ── */
    const nMonths = actualMethod === "RAM" && data && data.length > 0
        ? new Set(data.map((r) => `${r.nam_qt}-${r.thang_qt}`)).size
        : toYear - fromYear + 1;
    const nCskcb = actualMethod === "RAM" && data && data.length > 0
        ? new Set(data.map((r) => r.ma_cskcb as string)).size
        : "–";

    /* ── Render ── */

    if (initialLoading) {
        return (
            <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
        );
    }

    if (years.length === 0) {
        return <InfoBanner type="info">Chưa có dữ liệu trên BigQuery.</InfoBanner>;
    }

    return (
        <div>
            <SectionTitle icon="📋">Quản lý số liệu</SectionTitle>

            {deleteMsg && <InfoBanner type="success">{deleteMsg}</InfoBanner>}
            {error && <InfoBanner type="error">❌ {error}</InfoBanner>}

            {/* Year range + method selector */}
            <section className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm mb-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            Năm bắt đầu
                        </label>
                        <select
                            className="bg-transparent border-none text-sm font-semibold py-0 pl-0 pr-8 focus:ring-0 cursor-pointer"
                            value={fromYear}
                            onChange={(e) => setFromYear(+e.target.value)}
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            Năm kết thúc
                        </label>
                        <select
                            className="bg-transparent border-none text-sm font-semibold py-0 pl-0 pr-8 focus:ring-0 cursor-pointer"
                            value={toYear}
                            onChange={(e) => setToYear(+e.target.value)}
                        >
                            {years
                                .filter((y) => y >= fromYear)
                                .map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            Phương pháp
                        </label>
                        <select
                            className="bg-transparent border-none text-sm font-semibold py-0 pl-0 pr-8 focus:ring-0 cursor-pointer"
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                        >
                            <option value="🧠 Tự động">🧠 Tự động</option>
                            <option value="💾 RAM">💾 RAM</option>
                            <option value="☁️ BigQuery">☁️ BigQuery</option>
                        </select>
                    </div>
                    <button
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
                        onClick={handleLoad}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
                            </>
                        ) : (
                            "📥 Tải dữ liệu"
                        )}
                    </button>
                </div>
            </section>
            {data !== null && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                    {actualMethod === "RAM" ? "💾" : "☁️"} Phương pháp:
                    <strong> {actualMethod}</strong>
                    {" "}• {toYear - fromYear + 1} năm ({fromYear}–{toYear})
                    {actualMethod === "BigQuery" && " • Tìm kiếm sẽ truy vấn trực tiếp BigQuery"}
                </div>
            )}

            {/* Metrics */}
            {data !== null && (
                <>
                    <MetricGrid>
                        <MetricCard
                            label="Số dòng"
                            value={totalRows.toLocaleString()}
                            icon="📊"
                            color="blue"
                        />
                        <MetricCard
                            label="Số tháng"
                            value={String(nMonths)}
                            icon="📅"
                            color="cyan"
                        />
                        <MetricCard
                            label="Số CSKCB"
                            value={String(nCskcb)}
                            icon="🏥"
                            color="purple"
                        />
                    </MetricGrid>

                    <hr className="border-gray-200 my-4" />

                    {/* Search */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <SectionTitle icon="🔍">Dữ liệu chi tiết</SectionTitle>
                        <button
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                            onClick={handleExportExcel}
                            disabled={displayData.length === 0}
                            style={{ whiteSpace: "nowrap" }}
                        >
                            📥 Tải Excel ({displayData.length.toLocaleString()})
                        </button>
                    </div>

                    <SearchBuilder
                        columns={columns}
                        columnLabels={COL_LABELS}
                        conditions={conditions}
                        onConditionsChange={setConditions}
                        onSearch={handleSearch}
                        loading={searchLoading}
                        extraButtons={
                            isUnlocked && selectedRows.size > 0 ? (
                                <button
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={deleteLoading}
                                    style={{ height: 40 }}
                                >
                                    {deleteLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" /> Đang xóa...
                                        </>
                                    ) : (
                                        <><Trash2 className="w-4 h-4" /> Xóa {selectedRows.size} dòng đã chọn</>
                                    )}
                                </button>
                            ) : undefined
                        }
                    />

                    {isSearching && (() => {
                        const noiTru = displayData.filter((r) => r.ml2 === "Nội trú").length;
                        const ngoaiTru = displayData.filter((r) => r.ml2 === "Ngoại trú").length;
                        return (
                            <InfoBanner type="success" style={{ marginTop: "0.75rem" }}>
                                Tìm thấy <strong>{displayData.length.toLocaleString()}</strong> / {totalRows.toLocaleString()} hồ sơ
                                {(noiTru > 0 || ngoaiTru > 0) && (
                                    <> (trong đó Nội trú: <strong>{noiTru.toLocaleString()}</strong>, Ngoại trú: <strong>{ngoaiTru.toLocaleString()}</strong>)</>
                                )}
                            </InfoBanner>
                        );
                    })()}

                    {/* Data table */}
                    <div style={{ marginTop: "0.75rem" }}>
                        <DataTable
                            columns={tableColumns}
                            data={displayData}
                            selectable={isUnlocked}
                            selectedRows={selectedRows}
                            onSelectionChange={setSelectedRows}
                            stickyHeader
                            rowClassName={getRowClassName}
                        />
                    </div>



                    {/* Confirm Delete Dialog */}
                    <ConfirmDialog
                        open={showDeleteConfirm}
                        title="Xác nhận xóa dữ liệu"
                        message={
                            <>
                                Bạn có chắc chắn muốn xóa <strong>{selectedRows.size}</strong> dòng đã chọn khỏi BigQuery?
                                <br />
                                <span style={{ color: "var(--tbl-diff-neg)", fontWeight: 600 }}>Hành động này không thể hoàn tác.</span>
                            </>
                        }
                        confirmLabel={`Xóa ${selectedRows.size} dòng`}
                        cancelLabel="Hủy bỏ"
                        variant="danger"
                        onConfirm={handleDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                </>
            )}

            {data === null && !loading && (
                <InfoBanner type="info">
                    Chọn khoảng năm và bấm <strong>Tải dữ liệu</strong> để hiển thị.
                </InfoBanner>
            )}
        </div>
    );
}
