"use client";

import { useState, useEffect, useCallback } from "react";
import MetricCard, { MetricGrid } from "@/components/ui/MetricCard";
import InfoBanner from "@/components/ui/InfoBanner";
import SectionTitle from "@/components/ui/SectionTitle";

/* ── Types ── */

interface PivotRow {
    thang_qt: number;
    ml2: string;
    ma_cskcb: string;
    ten_cskcb: string | null;
    so_luot: number;
    tong_chi: number;
}

interface CskcbInfo {
    ma: string;
    ten: string;
}

type Metric = "so_luot" | "tong_chi";

/* ── Component ── */

export default function TabPivot() {
    const [years, setYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [metric, setMetric] = useState<Metric>("so_luot");
    const [rawData, setRawData] = useState<PivotRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDetail, setShowDetail] = useState(false);

    // Load available years
    useEffect(() => {
        fetch("/api/bq/overview")
            .then((r) => r.json())
            .then((d) => {
                if (d.error) {
                    setError(d.error);
                    setInitialLoading(false);
                    return;
                }
                const yrs: number[] = d.years || [];
                setYears(yrs);
                if (yrs.length > 0) {
                    setSelectedYear(yrs[0]);
                }
                setInitialLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setInitialLoading(false);
            });
    }, []);

    // Fetch pivot data when year changes
    const fetchPivot = useCallback(async () => {
        if (!selectedYear) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/bq/overview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: selectedYear }),
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            setRawData(d.data || []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        if (selectedYear) fetchPivot();
    }, [selectedYear, fetchPivot]);

    /* ── Build pivot ── */

    const buildPivot = () => {
        if (rawData.length === 0) return null;

        const ngoaiTru = rawData.filter((r) => r.ml2 === "Ngoại trú");
        const noiTru = rawData.filter((r) => r.ml2 === "Nội trú");

        // Get unique CSKCBs for each type
        const getUniqueCskcb = (rows: PivotRow[]): CskcbInfo[] => {
            const map = new Map<string, string>();
            for (const r of rows) {
                if (!map.has(r.ma_cskcb)) {
                    map.set(r.ma_cskcb, r.ten_cskcb || r.ma_cskcb);
                }
            }
            return Array.from(map.entries())
                .map(([ma, ten]) => ({ ma, ten }))
                .sort((a, b) => a.ma.localeCompare(b.ma));
        };

        const ngoaiCskcb = getUniqueCskcb(ngoaiTru);
        const noiCskcb = getUniqueCskcb(noiTru);

        // Build rows
        const pivotRows: Record<string, number | string>[] = [];
        let grandNgoai = 0,
            grandNoi = 0;

        for (let thang = 1; thang <= 12; thang++) {
            const row: Record<string, number | string> = { thang: `T${String(thang).padStart(2, "0")}` };

            let tongNgoai = 0;
            for (const cskcb of ngoaiCskcb) {
                const match = ngoaiTru.find(
                    (r) => r.thang_qt === thang && r.ma_cskcb === cskcb.ma
                );
                const val = match ? (match[metric] as number) : 0;
                row[`ngoai_${cskcb.ma}`] = val;
                tongNgoai += val;
            }
            row["ngoai_tong"] = tongNgoai;
            grandNgoai += tongNgoai;

            let tongNoi = 0;
            for (const cskcb of noiCskcb) {
                const match = noiTru.find(
                    (r) => r.thang_qt === thang && r.ma_cskcb === cskcb.ma
                );
                const val = match ? (match[metric] as number) : 0;
                row[`noi_${cskcb.ma}`] = val;
                tongNoi += val;
            }
            row["noi_tong"] = tongNoi;
            grandNoi += tongNoi;

            row["tong_cong"] = tongNgoai + tongNoi;
            pivotRows.push(row);
        }

        // Total row
        const totalRow: Record<string, number | string> = { thang: "TỔNG NĂM" };
        for (const cskcb of ngoaiCskcb) {
            totalRow[`ngoai_${cskcb.ma}`] = pivotRows.reduce(
                (s, r) => s + ((r[`ngoai_${cskcb.ma}`] as number) || 0),
                0
            );
        }
        totalRow["ngoai_tong"] = grandNgoai;
        for (const cskcb of noiCskcb) {
            totalRow[`noi_${cskcb.ma}`] = pivotRows.reduce(
                (s, r) => s + ((r[`noi_${cskcb.ma}`] as number) || 0),
                0
            );
        }
        totalRow["noi_tong"] = grandNoi;
        totalRow["tong_cong"] = grandNgoai + grandNoi;
        pivotRows.push(totalRow);

        return { pivotRows, ngoaiCskcb, noiCskcb, grandNgoai, grandNoi };
    };

    const fmt = (v: number) =>
        v === 0 ? "" : v.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

    const pivot = buildPivot();

    /* ── Render ── */

    if (initialLoading) {
        return (
            <div className="loading-overlay">
                <div className="spinner" /> Đang tải...
            </div>
        );
    }

    if (years.length === 0) {
        return <InfoBanner type="warning">Chưa có dữ liệu trong database.</InfoBanner>;
    }

    const unit = metric === "tong_chi" ? " VNĐ" : " lượt";

    return (
        <div>
            {error && <InfoBanner type="error">❌ {error}</InfoBanner>}

            {/* Filters */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
                    <label className="form-label">📅 Năm quyết toán</label>
                    <select
                        className="form-select"
                        value={selectedYear ?? ""}
                        onChange={(e) => setSelectedYear(+e.target.value)}
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label className="form-label">📈 Chỉ số hiển thị</label>
                    <select
                        className="form-select"
                        value={metric}
                        onChange={(e) => setMetric(e.target.value as Metric)}
                    >
                        <option value="so_luot">Số lượt KCB</option>
                        <option value="tong_chi">Tổng chi phí (VNĐ)</option>
                    </select>
                </div>
            </div>

            {loading && (
                <div className="loading-overlay">
                    <div className="spinner" /> Đang truy vấn dữ liệu...
                </div>
            )}

            {!loading && pivot && (
                <>
                    {/* Metric cards */}
                    <MetricGrid>
                        <MetricCard
                            label="Tổng Ngoại trú"
                            value={`${fmt(pivot.grandNgoai)}${unit}`}
                            icon="🔵"
                            color="blue"
                        />
                        <MetricCard
                            label="Tổng Nội trú"
                            value={`${fmt(pivot.grandNoi)}${unit}`}
                            icon="🟠"
                            color="orange"
                        />
                        <MetricCard
                            label="Tổng cộng"
                            value={`${fmt(pivot.grandNgoai + pivot.grandNoi)}${unit}`}
                            icon="📊"
                            color="green"
                        />
                    </MetricGrid>

                    {/* Pivot table */}
                    <div className="data-table-wrapper" style={{ marginTop: "1rem" }}>
                        <table className="data-table pivot-table">
                            <thead>
                                <tr>
                                    <th rowSpan={2} style={{ textAlign: "center" }}>
                                        Tháng
                                    </th>
                                    {pivot.ngoaiCskcb.length > 0 && (
                                        <th
                                            colSpan={pivot.ngoaiCskcb.length + 1}
                                            className="group-header-ngoai"
                                        >
                                            💵 Ngoại trú
                                        </th>
                                    )}
                                    {pivot.noiCskcb.length > 0 && (
                                        <th
                                            colSpan={pivot.noiCskcb.length + 1}
                                            className="group-header-noi"
                                        >
                                            🏥 Nội trú
                                        </th>
                                    )}
                                    <th rowSpan={2} style={{ textAlign: "center" }}>
                                        TỔNG CỘNG
                                    </th>
                                </tr>
                                <tr>
                                    {pivot.ngoaiCskcb.map((c) => (
                                        <th key={`h-ngoai-${c.ma}`} className="sub-header-ngoai">
                                            {c.ten}
                                        </th>
                                    ))}
                                    {pivot.ngoaiCskcb.length > 0 && (
                                        <th className="sub-header-ngoai subtotal">Tổng</th>
                                    )}
                                    {pivot.noiCskcb.map((c) => (
                                        <th key={`h-noi-${c.ma}`} className="sub-header-noi">
                                            {c.ten}
                                        </th>
                                    ))}
                                    {pivot.noiCskcb.length > 0 && (
                                        <th className="sub-header-noi subtotal">Tổng</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {pivot.pivotRows.map((row, idx) => {
                                    const isTotal = row.thang === "TỔNG NĂM";
                                    const trClass = isTotal
                                        ? "row-total"
                                        : idx % 2 === 0
                                            ? "row-even"
                                            : "row-odd";
                                    return (
                                        <tr key={idx} className={trClass}>
                                            <td
                                                style={{
                                                    textAlign: "center",
                                                    fontWeight: isTotal ? 700 : 600,
                                                }}
                                            >
                                                {row.thang}
                                            </td>
                                            {pivot.ngoaiCskcb.map((c) => (
                                                <td
                                                    key={`ngoai-${c.ma}`}
                                                    className="right"
                                                    style={isTotal ? { fontWeight: 700 } : {}}
                                                >
                                                    {fmt(row[`ngoai_${c.ma}`] as number)}
                                                </td>
                                            ))}
                                            {pivot.ngoaiCskcb.length > 0 && (
                                                <td
                                                    className="right subtotal-col-ngoai"
                                                    style={{
                                                        fontWeight: isTotal ? 700 : 600,
                                                    }}
                                                >
                                                    {fmt(row["ngoai_tong"] as number)}
                                                </td>
                                            )}
                                            {pivot.noiCskcb.map((c) => (
                                                <td
                                                    key={`noi-${c.ma}`}
                                                    className="right"
                                                    style={isTotal ? { fontWeight: 700 } : {}}
                                                >
                                                    {fmt(row[`noi_${c.ma}`] as number)}
                                                </td>
                                            ))}
                                            {pivot.noiCskcb.length > 0 && (
                                                <td
                                                    className="right subtotal-col-noi"
                                                    style={{
                                                        fontWeight: isTotal ? 700 : 600,
                                                    }}
                                                >
                                                    {fmt(row["noi_tong"] as number)}
                                                </td>
                                            )}
                                            <td
                                                className="right subtotal-col-tong"
                                                style={{ fontWeight: 700 }}
                                            >
                                                {fmt(row["tong_cong"] as number)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Raw data collapsible */}
                    <details style={{ marginTop: "1rem" }}>
                        <summary
                            style={{
                                cursor: "pointer",
                                color: "var(--text-secondary)",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                            }}
                            onClick={() => setShowDetail(!showDetail)}
                        >
                            🔍 Xem dữ liệu chi tiết ({rawData.length} dòng)
                        </summary>
                        {showDetail && (
                            <div className="data-table-wrapper" style={{ marginTop: "0.5rem", maxHeight: 400, overflowY: "auto" }}>
                                <table className="data-table data-table-compact">
                                    <thead>
                                        <tr>
                                            <th>Tháng</th>
                                            <th>Loại</th>
                                            <th>Mã CSKCB</th>
                                            <th>Tên CSKCB</th>
                                            <th style={{ textAlign: "right" }}>Số lượt</th>
                                            <th style={{ textAlign: "right" }}>Tổng chi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rawData.map((r, i) => (
                                            <tr key={i} className={i % 2 === 0 ? "row-even" : "row-odd"}>
                                                <td style={{ textAlign: "center" }}>T{String(r.thang_qt).padStart(2, "0")}</td>
                                                <td>{r.ml2}</td>
                                                <td>{r.ma_cskcb}</td>
                                                <td>{r.ten_cskcb || "–"}</td>
                                                <td className="right">{r.so_luot.toLocaleString()}</td>
                                                <td className="right">{r.tong_chi.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </details>
                </>
            )}

            {!loading && !pivot && rawData.length === 0 && !error && (
                <InfoBanner type="info">
                    Chọn năm quyết toán để xem dữ liệu tổng hợp.
                </InfoBanner>
            )}
        </div>
    );
}
