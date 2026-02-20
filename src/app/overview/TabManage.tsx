"use client";

import { useState, useEffect } from "react";
import MetricCard, { MetricGrid } from "@/components/ui/MetricCard";
import SectionTitle from "@/components/ui/SectionTitle";
import InfoBanner from "@/components/ui/InfoBanner";
import DataTable, { Column } from "@/components/ui/DataTable";
import SearchBuilder, { SearchCondition } from "@/components/ui/SearchBuilder";

export default function TabManage() {
    /* ── State ── */
    const [years, setYears] = useState<number[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [fromYear, setFromYear] = useState<number>(0);
    const [toYear, setToYear] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [data, setData] = useState<Record<string, unknown>[] | null>(null);
    const [totalRows, setTotalRows] = useState(0);

    // Search
    const [conditions, setConditions] = useState<SearchCondition[]>([
        { field: "", keyword: "", operator: "AND" },
    ]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [displayData, setDisplayData] = useState<Record<string, unknown>[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Selection & delete
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [confirmText, setConfirmText] = useState("");
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
                if (yrs.length > 0) {
                    setFromYear(yrs[yrs.length - 1]); // oldest
                    setToYear(yrs[0]); // newest
                }
                if (cols.length > 0) {
                    setConditions([{ field: cols[0], keyword: "", operator: "AND" }]);
                }
                setInitialLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setInitialLoading(false);
            });
    }, []);

    /* ── Load data ── */
    const handleLoad = async () => {
        setLoading(true);
        setError(null);
        setData(null);
        setDisplayData([]);
        setIsSearching(false);
        setSelectedRows(new Set());
        setDeleteMsg(null);

        try {
            const res = await fetch("/api/bq/overview/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "load",
                    fromYear,
                    toYear,
                }),
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            setData(d.data || []);
            setDisplayData(d.data || []);
            setTotalRows(d.total || 0);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    /* ── Search ── */
    const handleSearch = async () => {
        const activeConds = conditions.filter((c) => c.keyword.trim());
        if (activeConds.length === 0) {
            setDisplayData(data || []);
            setIsSearching(false);
            return;
        }

        setSearchLoading(true);
        setSelectedRows(new Set());

        try {
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
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setSearchLoading(false);
        }
    };

    /* ── Delete ── */
    const handleDelete = async () => {
        if (confirmText !== "XÓA") {
            setError("Nhập đúng \"XÓA\" để xác nhận xóa.");
            return;
        }

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
            setDeleteMsg(`✅ Đã xóa ${d.deletedCount} / ${d.total} dòng!`);
            setSelectedRows(new Set());
            setConfirmText("");
            // Reload data
            await handleLoad();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setDeleteLoading(false);
        }
    };

    /* ── Build table columns ── */
    const tableColumns: Column[] = columns.slice(0, 30).map((col) => ({
        key: col,
        label: col,
        align: col.startsWith("t_") || col === "so_ngay_dtri" ? "right" as const : "left" as const,
    }));

    /* ── Metrics ── */
    const nMonths =
        data
            ? new Set(
                data.map(
                    (r) => `${r.nam_qt}-${r.thang_qt}`
                )
            ).size
            : 0;
    const nCskcb =
        data
            ? new Set(data.map((r) => r.ma_cskcb as string)).size
            : 0;

    /* ── Render ── */

    if (initialLoading) {
        return (
            <div className="loading-overlay">
                <div className="spinner" /> Đang tải...
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

            {/* Year range selector */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
                    <label className="form-label">Năm bắt đầu</label>
                    <select
                        className="form-select"
                        value={fromYear}
                        onChange={(e) => setFromYear(+e.target.value)}
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label className="form-label">Năm kết thúc</label>
                    <select
                        className="form-select"
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
                <button
                    className="btn btn-primary"
                    onClick={handleLoad}
                    disabled={loading}
                    style={{ height: 40 }}
                >
                    {loading ? (
                        <>
                            <span className="spinner" /> Đang tải...
                        </>
                    ) : (
                        "📥 Tải dữ liệu"
                    )}
                </button>
            </div>

            {/* Metrics */}
            {data && (
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

                    <hr className="divider" />

                    {/* Search */}
                    <SectionTitle icon="🔍">Dữ liệu chi tiết</SectionTitle>

                    <SearchBuilder
                        columns={columns}
                        conditions={conditions}
                        onConditionsChange={setConditions}
                        onSearch={handleSearch}
                        loading={searchLoading}
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
                        />
                    </div>

                    {/* Delete section */}
                    {selectedRows.size > 0 && (
                        <div
                            style={{
                                marginTop: "1rem",
                                padding: "1rem",
                                borderRadius: "0.75rem",
                                border: "1px solid var(--warning-bg)",
                                background: "var(--bg-card-alt)",
                            }}
                        >
                            <InfoBanner type="warning">
                                Đã chọn <strong>{selectedRows.size}</strong> dòng.
                                Nhập &quot;XÓA&quot; để xác nhận xóa khỏi BigQuery.
                            </InfoBanner>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "0.75rem",
                                    alignItems: "flex-end",
                                    marginTop: "0.75rem",
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">
                                        Nhập &quot;XÓA&quot; để xác nhận:
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={confirmText}
                                        onChange={(e) =>
                                            setConfirmText(e.target.value)
                                        }
                                        placeholder="XÓA"
                                    />
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleDelete}
                                    disabled={deleteLoading || confirmText !== "XÓA"}
                                    style={{ height: 40 }}
                                >
                                    {deleteLoading ? (
                                        <>
                                            <span className="spinner" /> Đang xóa...
                                        </>
                                    ) : (
                                        `🗑️ Xóa ${selectedRows.size} dòng`
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {!data && !loading && (
                <InfoBanner type="info">
                    Chọn khoảng năm và bấm <strong>Tải dữ liệu</strong> để hiển thị.
                </InfoBanner>
            )}
        </div>
    );
}
