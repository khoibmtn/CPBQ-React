"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import PageHeader from "@/components/ui/PageHeader";
import InfoBanner from "@/components/ui/InfoBanner";
import SectionTitle from "@/components/ui/SectionTitle";
import PeriodSelector, { PeriodDef } from "@/components/ui/PeriodSelector";
import IcdTable, { IcdRow, IcdPeriodData, CostType, DiffMetric } from "./IcdTable";
import { formatPeriodLabel } from "@/lib/metrics";

/* ── Types ────────────────────────────────────────────────────────────────── */

interface InitData {
    yearMonths: { nam_qt: number; thang_qt: number }[];
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function IcdAnalysisPage() {
    // ── Init state ──
    const [initData, setInitData] = useState<InitData | null>(null);
    const [initLoading, setInitLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Periods ──
    const [periods, setPeriods] = useState<PeriodDef[]>([]);

    // ── Filter state ──
    const [ml2, setMl2] = useState("Nội trú");
    const [costTypeLabel, setCostTypeLabel] = useState("Tổng CP");
    const [ratio, setRatio] = useState(70);
    const [selectedKhoa, setSelectedKhoa] = useState("Toàn Bệnh viện");
    const [sortPeriodText, setSortPeriodText] = useState("");
    const [diffChoice, setDiffChoice] = useState("Không");
    const [diffReverse, setDiffReverse] = useState(true);

    // ── Data state ──
    const [loading, setLoading] = useState(false);
    const [periodsData, setPeriodsData] = useState<IcdPeriodData[] | null>(null);
    const [availableKhoa, setAvailableKhoa] = useState<string[]>([]);

    // ── Load init data ──
    useEffect(() => {
        fetch("/api/bq/icd-analysis")
            .then((r) => r.json())
            .then((d) => {
                if (d.error) throw new Error(d.error);
                setInitData(d);

                // Set default periods
                const yms = d.yearMonths as { nam_qt: number; thang_qt: number }[];
                if (yms.length > 0) {
                    const latestYear = yms[yms.length - 1].nam_qt;
                    const latestMonths = yms
                        .filter((ym: { nam_qt: number }) => ym.nam_qt === latestYear)
                        .map((ym: { thang_qt: number }) => ym.thang_qt)
                        .sort((a: number, b: number) => a - b);

                    setPeriods([
                        {
                            id: 1,
                            fromYear: latestYear,
                            fromMonth: latestMonths[0] || 1,
                            toYear: latestYear,
                            toMonth: latestMonths[latestMonths.length - 1] || 12,
                        },
                        {
                            id: 2,
                            fromYear: latestYear,
                            fromMonth: latestMonths[0] || 1,
                            toYear: latestYear,
                            toMonth: latestMonths[latestMonths.length - 1] || 12,
                        },
                    ]);
                }
                setInitLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setInitLoading(false);
            });
    }, []);

    // ── ML2 default ratio ──
    const ml2Defaults: Record<string, number> = {
        "Nội trú": 70,
        "Ngoại trú": 80,
        "Toàn BV": 70,
    };
    useEffect(() => {
        setRatio(ml2Defaults[ml2] ?? 70);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ml2]);

    // ── Compare handler ──
    const handleCompare = useCallback(async () => {
        setLoading(true);
        setError(null);
        setPeriodsData(null);

        try {
            const ml2Filter = ml2 === "Toàn BV" ? "all" : ml2;
            const khoaFilter = selectedKhoa === "Toàn Bệnh viện" ? "all" : selectedKhoa;

            const res = await fetch("/api/bq/icd-analysis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periods, ml2Filter, khoaFilter }),
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);

            const results: IcdPeriodData[] = periods.map((p, i) => ({
                period: p,
                data: (d.periodsData[i] || []) as IcdRow[],
            }));
            setPeriodsData(results);
            setAvailableKhoa(d.availableKhoa || []);

            // Default sort period
            if (!sortPeriodText && results.length > 0) {
                const label = formatPeriodLabel(
                    results[0].period.fromYear, results[0].period.fromMonth,
                    results[0].period.toYear, results[0].period.toMonth
                );
                setSortPeriodText(label);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [periods, ml2, selectedKhoa, sortPeriodText]);

    // ── Auto-refetch when server-side filters change ──
    useEffect(() => {
        // Only auto-refetch if we already have data loaded
        if (periodsData) {
            handleCompare();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ml2, selectedKhoa]);

    // ── Derived: cost type ──
    const costTypeMap: Record<string, CostType> = {
        "Số lượt": "soluot",
        "Tổng CP": "tongcp",
        "CP BHYT": "cpbhyt",
    };
    const costType = costTypeMap[costTypeLabel] || "tongcp";

    const pctLabelMap: Record<CostType, string> = {
        soluot: "%Số lượt",
        tongcp: "%Tổng CP",
        cpbhyt: "%CP BHYT",
    };
    const pctColLabel = pctLabelMap[costType];

    // ── Diff metric ──
    const bqLabel = costType === "cpbhyt" ? "BQĐT BHYT" : "BQĐT Tổng chi";
    const diffOptionsMap: Record<string, DiffMetric> = {
        "Số lượt": "so_luot",
        "Ngày ĐTTB": "ngay_dttb",
        [bqLabel]: "bq_dt",
        [pctColLabel]: "pct_val",
    };
    const diffOptions = ["Không", ...Object.keys(diffOptionsMap)];
    const diffMetric: DiffMetric | null = diffChoice !== "Không" ? (diffOptionsMap[diffChoice] ?? null) : null;
    const hasDiff = periods.length >= 2;

    // ── Computed: ICD list via cumulative filter ──
    const { icdList, cumSum, totalIcdCount } = useMemo(() => {
        if (!periodsData) return { icdList: [], cumSum: 0, totalIcdCount: 0 };

        // Find sort period
        let sortIdx = 0;
        for (let i = 0; i < periodsData.length; i++) {
            const label = formatPeriodLabel(
                periodsData[i].period.fromYear, periodsData[i].period.fromMonth,
                periodsData[i].period.toYear, periodsData[i].period.toMonth
            );
            if (label === sortPeriodText) {
                sortIdx = i;
                break;
            }
        }

        const sortData = periodsData[sortIdx]?.data;
        if (!sortData || sortData.length === 0) return { icdList: [], cumSum: 0, totalIcdCount: 0 };

        // Compute %
        const totalVal = costType === "soluot"
            ? sortData.reduce((s, r) => s + (r.so_luot || 0), 0)
            : costType === "tongcp"
                ? sortData.reduce((s, r) => s + (r.t_tongchi || 0), 0)
                : sortData.reduce((s, r) => s + (r.t_bhtt || 0), 0);

        const withPct = sortData.map((r) => {
            let val = 0;
            if (costType === "soluot") val = r.so_luot || 0;
            else if (costType === "tongcp") val = r.t_tongchi || 0;
            else val = r.t_bhtt || 0;
            return { code: r.ma_benh_chinh, pct: totalVal ? (val / totalVal) * 100 : 0 };
        });
        withPct.sort((a, b) => b.pct - a.pct);

        let acc = 0;
        const list: string[] = [];
        for (const item of withPct) {
            if (acc + item.pct > ratio) break;
            acc += item.pct;
            list.push(item.code);
        }
        // Ensure at least one
        if (list.length === 0 && withPct.length > 0) {
            list.push(withPct[0].code);
            acc = withPct[0].pct;
        }

        return { icdList: list, cumSum: acc, totalIcdCount: withPct.length };
    }, [periodsData, sortPeriodText, costType, ratio]);

    // ── Period text options ──
    const periodTextOptions = useMemo(() => {
        return periods.map((p) =>
            formatPeriodLabel(p.fromYear, p.fromMonth, p.toYear, p.toMonth)
        );
    }, [periods]);

    // ── Khoa options ──
    const khoaOptions = useMemo(() => {
        return ["Toàn Bệnh viện", ...availableKhoa];
    }, [availableKhoa]);

    /* ── Render ── */
    if (initLoading) {
        return (
            <>
                <PageHeader
                    title="Chi phí theo mã bệnh"
                    subtitle="Thống kê theo mã ICD · Phân tích tích lũy %"
                    icon="🔬"
                    gradient="linear-gradient(135deg, rgba(139,92,246,0.9), rgba(236,72,153,0.85))"
                />
                <div className="loading-overlay">
                    <div className="spinner" /> Đang tải...
                </div>
            </>
        );
    }

    if (!initData || initData.yearMonths.length === 0) {
        return (
            <>
                <PageHeader
                    title="Chi phí theo mã bệnh"
                    subtitle="Thống kê theo mã ICD · Phân tích tích lũy %"
                    icon="🔬"
                    gradient="linear-gradient(135deg, rgba(139,92,246,0.9), rgba(236,72,153,0.85))"
                />
                <InfoBanner type="info">Chưa có dữ liệu trong database.</InfoBanner>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Chi phí theo mã bệnh"
                subtitle="Thống kê theo mã ICD · Phân tích tích lũy %"
                icon="🔬"
                gradient="linear-gradient(135deg, rgba(139,92,246,0.9), rgba(236,72,153,0.85))"
            />

            {error && <InfoBanner type="error">❌ {error}</InfoBanner>}

            <SectionTitle icon="📅">Chọn khoảng thời gian</SectionTitle>

            <PeriodSelector
                yearMonths={initData.yearMonths}
                periods={periods}
                onChange={setPeriods}
                onCompare={handleCompare}
                loading={loading}
            />

            {/* Filter bar — always visible after data loads */}
            {periodsData && (
                <>
                    <div className="icd-filter-bar">
                        {/* Khoa filter */}
                        <div className="icd-filter-item">
                            <label className="form-label">Thống kê theo khoa</label>
                            <select
                                className="form-select form-select-sm"
                                value={selectedKhoa}
                                onChange={(e) => setSelectedKhoa(e.target.value)}
                            >
                                {khoaOptions.map((k) => (
                                    <option key={k} value={k}>{k}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sort period */}
                        <div className="icd-filter-item">
                            <label className="form-label">Mốc thống kê</label>
                            <select
                                className="form-select form-select-sm"
                                value={sortPeriodText}
                                onChange={(e) => setSortPeriodText(e.target.value)}
                            >
                                {periodTextOptions.map((pt) => (
                                    <option key={pt} value={pt}>{pt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Cost type */}
                        <div className="icd-filter-item">
                            <label className="form-label">Loại thống kê</label>
                            <select
                                className="form-select form-select-sm"
                                value={costTypeLabel}
                                onChange={(e) => setCostTypeLabel(e.target.value)}
                            >
                                <option value="Số lượt">Số lượt</option>
                                <option value="Tổng CP">Tổng CP</option>
                                <option value="CP BHYT">CP BHYT</option>
                            </select>
                        </div>

                        {/* ML2 filter */}
                        <div className="icd-filter-item">
                            <label className="form-label">🏥 Loại hình</label>
                            <select
                                className="form-select form-select-sm"
                                value={ml2}
                                onChange={(e) => setMl2(e.target.value)}
                            >
                                <option value="Nội trú">Nội trú</option>
                                <option value="Ngoại trú">Ngoại trú</option>
                                <option value="Toàn BV">Toàn BV</option>
                            </select>
                        </div>

                        {/* Cumulative % threshold */}
                        <div className="icd-filter-item icd-filter-narrow">
                            <label className="form-label">Ngưỡng %</label>
                            <input
                                type="number"
                                className="form-select form-select-sm"
                                min={1}
                                max={100}
                                value={ratio}
                                onChange={(e) => setRatio(Math.min(100, Math.max(1, +e.target.value)))}
                            />
                        </div>

                        {/* Diff metric */}
                        <div className="icd-filter-item">
                            <label className="form-label">📊 Chênh lệch</label>
                            <select
                                className="form-select form-select-sm"
                                value={diffChoice}
                                onChange={(e) => setDiffChoice(e.target.value)}
                                disabled={!hasDiff}
                            >
                                {diffOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Diff direction toggle */}
                        {hasDiff && diffChoice !== "Không" && (
                            <div className="icd-filter-item icd-filter-narrow">
                                <label className="form-label">Hướng</label>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setDiffReverse(!diffReverse)}
                                    title="T-P: Đầu − Cuối · P-T: Cuối − Đầu"
                                >
                                    {diffReverse ? "T-P" : "P-T"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Info line */}
                    <div className="icd-info-line">
                        <span>
                            📋 Hiển thị <strong>{icdList.length}</strong> / {totalIcdCount} mã bệnh
                            {" "}(tích lũy {pctColLabel} ≈ <strong>{cumSum.toFixed(1)}%</strong> / {ratio}%)
                        </span>
                    </div>

                    {/* Table */}
                    {icdList.length > 0 ? (
                        <>
                            <SectionTitle icon="📊">Bảng thống kê ICD</SectionTitle>
                            <IcdTable
                                periodsData={periodsData}
                                icdList={icdList}
                                costType={costType}
                                pctColLabel={pctColLabel}
                                diffMetric={diffMetric}
                                diffReverse={diffReverse}
                            />
                        </>
                    ) : (
                        <InfoBanner type="info">
                            ℹ️ Không có dữ liệu cho khoảng thời gian đã chọn.
                        </InfoBanner>
                    )}
                </>
            )}
        </>
    );
}
