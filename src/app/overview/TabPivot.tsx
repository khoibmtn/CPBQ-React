"use client";
import { Loader2, TrendingUp, Activity, Bed, Search } from "lucide-react";

import { useState, useEffect, useCallback } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import InfoBanner from "@/components/ui/InfoBanner";

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
    const [years, setYears] = useSessionState<number[]>("pv_years", []);
    const [selectedYear, setSelectedYear] = useSessionState<number | null>("pv_selectedYear", null);
    const [metric, setMetric] = useSessionState<Metric>("pv_metric", "so_luot");
    const [rawData, setRawData] = useSessionState<PivotRow[]>("pv_rawData", []);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(years.length === 0);
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
                if (yrs.length > 0 && !selectedYear) {
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

        const pivotRows: Record<string, number | string>[] = [];
        let grandNgoai = 0,
            grandNoi = 0;

        for (let thang = 1; thang <= 12; thang++) {
            const row: Record<string, number | string> = { thang: `Tháng ${String(thang).padStart(2, "0")}` };
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

        return { pivotRows, ngoaiCskcb, noiCskcb, grandNgoai, grandNoi };
    };

    const fmt = (v: number) =>
        v === 0 ? "" : v.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

    const pivot = buildPivot();

    /* ── Render ── */

    if (initialLoading) {
        return (
            <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
        );
    }

    if (years.length === 0) {
        return <InfoBanner type="warning">Chưa có dữ liệu trong database.</InfoBanner>;
    }

    const unit = metric === "tong_chi" ? " VNĐ" : " lượt";

    return (
        <div className="flex flex-col gap-6">
            {error && <InfoBanner type="error">❌ {error}</InfoBanner>}

            {/* Filter card */}
            <section className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            Năm quyết toán
                        </label>
                        <select
                            className="bg-transparent border-none text-sm font-semibold py-0 pl-0 pr-8 focus:ring-0 cursor-pointer"
                            value={selectedYear ?? ""}
                            onChange={(e) => setSelectedYear(+e.target.value)}
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            Chỉ số hiển thị
                        </label>
                        <select
                            className="bg-transparent border-none text-sm font-semibold py-0 pl-0 pr-8 focus:ring-0 cursor-pointer min-w-[180px]"
                            value={metric}
                            onChange={(e) => setMetric(e.target.value as Metric)}
                        >
                            <option value="so_luot">Số lượt KCB (Lượt)</option>
                            <option value="tong_chi">Tổng chi phí (VNĐ)</option>
                        </select>
                    </div>
                </div>
            </section>

            {loading && (
                <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang truy vấn dữ liệu...
                </div>
            )}

            {!loading && pivot && (
                <>
                    {/* Metric cards */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white border border-slate-200 p-6 rounded-xl hover:border-sky-300 transition-all shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">TỔNG NGOẠI TRÚ</span>
                                    <span className="text-3xl font-bold text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {fmt(pivot.grandNgoai)}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 mt-1">{unit}</span>
                                </div>
                                <div className="bg-sky-100 p-3 rounded-xl text-sky-500">
                                    <Activity className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 p-6 rounded-xl hover:border-orange-300 transition-all shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">TỔNG NỘI TRÚ</span>
                                    <span className="text-3xl font-bold text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {fmt(pivot.grandNoi)}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 mt-1">{unit}</span>
                                </div>
                                <div className="bg-orange-100 p-3 rounded-xl text-orange-500">
                                    <Bed className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 p-6 rounded-xl hover:border-emerald-300 transition-all shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">TỔNG CỘNG</span>
                                    <span className="text-3xl font-bold text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {fmt(pivot.grandNgoai + pivot.grandNoi)}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 mt-1">{unit}</span>
                                </div>
                                <div className="bg-emerald-100 p-3 rounded-xl text-emerald-500">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Pivot table card */}
                    <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                📊 Số liệu chi tiết theo Tháng
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse" style={{ fontVariantNumeric: "tabular-nums" }}>
                                <thead>
                                    {/* Row 1: Group headers */}
                                    <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-center">
                                        <th className="p-3 text-left border border-gray-200 bg-slate-200 sticky left-0 z-10 text-slate-700">
                                            Tháng
                                        </th>
                                        {pivot.ngoaiCskcb.length > 0 && (
                                            <th
                                                className="p-2 border border-gray-200 text-blue-700 bg-blue-50/80"
                                                colSpan={pivot.ngoaiCskcb.length + 1}
                                            >
                                                Ngoại trú
                                            </th>
                                        )}
                                        {pivot.noiCskcb.length > 0 && (
                                            <th
                                                className="p-2 border border-gray-200 text-orange-700 bg-orange-50/80"
                                                colSpan={pivot.noiCskcb.length + 1}
                                            >
                                                Nội trú
                                            </th>
                                        )}
                                        <th className="p-3 border border-gray-200 text-slate-900 bg-slate-200 min-w-[100px]">
                                            Tổng cộng
                                        </th>
                                    </tr>
                                    {/* Row 2: Sub-headers */}
                                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-tight text-right text-slate-600">
                                        <th className="p-3 border border-gray-200 text-left sticky left-0 bg-slate-50 shadow-[1px_0_0_0_#e5e7eb]">
                                            Cơ sở KCB
                                        </th>
                                        {pivot.ngoaiCskcb.map((c) => (
                                            <th key={`h-ngoai-${c.ma}`} className="p-2 border border-gray-200">
                                                {c.ten}
                                            </th>
                                        ))}
                                        {pivot.ngoaiCskcb.length > 0 && (
                                            <th className="p-2 border border-gray-200 bg-blue-100/50 text-blue-700">Tổng</th>
                                        )}
                                        {pivot.noiCskcb.map((c) => (
                                            <th key={`h-noi-${c.ma}`} className="p-2 border border-gray-200">
                                                {c.ten}
                                            </th>
                                        ))}
                                        {pivot.noiCskcb.length > 0 && (
                                            <th className="p-2 border border-gray-200 bg-orange-100/50 text-orange-700">Tổng</th>
                                        )}
                                        <th className="p-2 border border-gray-200 text-slate-800 bg-slate-100/50">Toàn viện</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {pivot.pivotRows.map((row, idx) => {
                                        const isEven = idx % 2 === 0;
                                        const bgClass = isEven ? "bg-white" : "bg-slate-50/40";
                                        const stickyBg = isEven ? "bg-white" : "bg-[#f9fafb]";
                                        return (
                                            <tr key={idx} className={`${bgClass} hover:bg-slate-50 transition-colors`}>
                                                <td className={`p-3 px-4 text-left font-semibold text-slate-700 sticky left-0 ${stickyBg} border border-gray-200 shadow-[1px_0_0_0_#e5e7eb]`}>
                                                    {row.thang}
                                                </td>
                                                {pivot.ngoaiCskcb.map((c) => (
                                                    <td key={`ngoai-${c.ma}`} className="p-3 text-right text-slate-600 border border-gray-200">
                                                        {fmt(row[`ngoai_${c.ma}`] as number)}
                                                    </td>
                                                ))}
                                                {pivot.ngoaiCskcb.length > 0 && (
                                                    <td className="p-3 text-right font-bold text-blue-800 bg-blue-50/40 border border-gray-200">
                                                        {fmt(row["ngoai_tong"] as number)}
                                                    </td>
                                                )}
                                                {pivot.noiCskcb.map((c) => (
                                                    <td key={`noi-${c.ma}`} className="p-3 text-right text-slate-600 border border-gray-200">
                                                        {fmt(row[`noi_${c.ma}`] as number)}
                                                    </td>
                                                ))}
                                                {pivot.noiCskcb.length > 0 && (
                                                    <td className="p-3 text-right font-bold text-orange-800 bg-orange-50/40 border border-gray-200">
                                                        {fmt(row["noi_tong"] as number)}
                                                    </td>
                                                )}
                                                <td className="p-3 text-right font-bold text-slate-900 bg-slate-50/80 border border-gray-200">
                                                    {fmt(row["tong_cong"] as number)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-indigo-50/80 text-slate-800 text-sm">
                                    <tr className="font-medium border-t-2 border-slate-300">
                                        <td className="p-4 px-4 sticky left-0 bg-indigo-50 border border-gray-200 font-bold shadow-[1px_0_0_0_#e5e7eb]">
                                            TỔNG NĂM
                                        </td>
                                        {pivot.ngoaiCskcb.map((c) => {
                                            const total = pivot.pivotRows.reduce(
                                                (s, r) => s + ((r[`ngoai_${c.ma}`] as number) || 0), 0
                                            );
                                            return (
                                                <td key={`t-ngoai-${c.ma}`} className="p-4 text-right border border-gray-200">
                                                    {fmt(total)}
                                                </td>
                                            );
                                        })}
                                        {pivot.ngoaiCskcb.length > 0 && (
                                            <td className="p-4 text-right border border-gray-200 bg-blue-100/40 font-bold">
                                                {fmt(pivot.grandNgoai)}
                                            </td>
                                        )}
                                        {pivot.noiCskcb.map((c) => {
                                            const total = pivot.pivotRows.reduce(
                                                (s, r) => s + ((r[`noi_${c.ma}`] as number) || 0), 0
                                            );
                                            return (
                                                <td key={`t-noi-${c.ma}`} className="p-4 text-right border border-gray-200">
                                                    {fmt(total)}
                                                </td>
                                            );
                                        })}
                                        {pivot.noiCskcb.length > 0 && (
                                            <td className="p-4 text-right border border-gray-200 bg-orange-100/40 font-bold">
                                                {fmt(pivot.grandNoi)}
                                            </td>
                                        )}
                                        <td className="p-4 text-right bg-indigo-100 border border-gray-200 font-bold">
                                            {fmt(pivot.grandNgoai + pivot.grandNoi)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>

                    {/* Raw data collapsible */}
                    <details className="group bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <summary className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Search className="w-5 h-5 text-slate-400 group-open:rotate-90 transition-transform" />
                                <span className="text-sm font-bold text-slate-700">
                                    Xem dữ liệu chi tiết ({rawData.length} dòng)
                                </span>
                            </div>
                            <span className="text-xs text-slate-500 font-medium italic">Nhấp để xem bảng dữ liệu thô</span>
                        </summary>
                        <div className="border-t border-slate-100">
                            <div className="max-h-[400px] overflow-auto" onClick={() => setShowDetail(!showDetail)}>
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="p-3 pl-6">Tháng</th>
                                            <th className="p-3">Loại</th>
                                            <th className="p-3">Mã CSKCB</th>
                                            <th className="p-3">Tên CSKCB</th>
                                            <th className="p-3 text-right">Số lượt</th>
                                            <th className="p-3 text-right pr-6">Tổng chi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-medium text-slate-600">
                                        {rawData.map((r, i) => (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="p-3 pl-6">T{String(r.thang_qt).padStart(2, "0")}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${r.ml2 === "Ngoại trú"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : "bg-orange-100 text-orange-700"
                                                        }`}>
                                                        {r.ml2 === "Ngoại trú" ? "NGOẠI" : "NỘI"}
                                                    </span>
                                                </td>
                                                <td className="p-3">{r.ma_cskcb}</td>
                                                <td className="p-3">{r.ten_cskcb || "–"}</td>
                                                <td className="p-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                                                    {r.so_luot.toLocaleString()}
                                                </td>
                                                <td className="p-3 text-right pr-6" style={{ fontVariantNumeric: "tabular-nums" }}>
                                                    {r.tong_chi.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
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
