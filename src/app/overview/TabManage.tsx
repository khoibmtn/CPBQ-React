"use client";
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
                    setFromYear(yrs[yrs.length - 1]); // oldest
                    setToYear(yrs[0]); // newest
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

    /* ── Auto-reload data if it was loaded before ── */
    const hasAutoReloaded = useRef(false);
    useEffect(() => {
        if (dataLoaded && !data && fromYear > 0 && !hasAutoReloaded.current) {
            hasAutoReloaded.current = true;
            handleLoad();
        }
    }, [dataLoaded, data, fromYear, handleLoad]);

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
    const handleDelete = async () => {
        setShowDeleteConfirm(false);
        setDeleteLoading(true);
        setError(null);

        const rowsToDelete = Array.from(selectedRows).map(
            (idx) => displayData[idx]
        );

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
                    const rowsToRemoveKeys = new Set(
                        rowsToDelete.map((r) => JSON.stringify(r))
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

    /* ── Build table columns ── */
    // Derive columns from actual display data when available
    const effectiveCols = displayData.length > 0
        ? Object.keys(displayData[0]).filter(
            (c) => c !== "upload_timestamp" && c !== "source_file"
        )
        : columns;

    const tableColumns: Column[] = effectiveCols.map((col) => ({
        key: col,
        label: col,
        align: col.startsWith("t_") || col === "so_ngay_dtri" ? "right" as const : "left" as const,
    }));

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
                        conditions={conditions}
                        onConditionsChange={setConditions}
                        onSearch={handleSearch}
                        loading={searchLoading}
                        extraButtons={
                            selectedRows.size > 0 ? (
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

                    {isSearching && (
                        <InfoBanner type="success" style={{ marginTop: "0.75rem" }}>
                            Tìm thấy <strong>{displayData.length.toLocaleString()}</strong> / {totalRows.toLocaleString()} dòng
                        </InfoBanner>
                    )}

                    {/* Data table */}
                    <div style={{ marginTop: "0.75rem" }}>
                        <DataTable
                            columns={tableColumns}
                            data={displayData}
                            selectable
                            selectedRows={selectedRows}
                            onSelectionChange={setSelectedRows}
                            stickyHeader
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
