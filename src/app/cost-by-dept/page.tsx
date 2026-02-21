"use client";
import { Loader2 } from "lucide-react";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import PeriodSelector, { PeriodDef } from "./PeriodSelector";
import ComparisonTable from "./ComparisonTable";
import {
    ColumnDef,
    DEFAULT_COLUMNS,
    getActiveColumns,
    ProfileItem,
    formatPeriodLabel,
} from "@/lib/metrics";
import { exportCostByDept } from "@/lib/exportExcel";

interface InitData {
    yearMonths: { nam_qt: number; thang_qt: number }[];
    khoaOrder: Record<string, number>;
    profileNames: string[];
    mergeRules: Record<string, string>;
    targetEstablished: Record<string, string>;
}

type Row = Record<string, number>;

interface PeriodResult {
    period: PeriodDef;
    data: Row[];
}

export default function CostByDeptPage() {
    /* ── State ── */
    const [initData, setInitData] = useSessionState<InitData | null>("cbd_initData", null);
    const [initLoading, setInitLoading] = useState(!initData); // skip spinner if cached
    const [error, setError] = useState<string | null>(null);

    // Persisted state
    const [periods, setPeriods] = useSessionState<PeriodDef[]>("cbd_periods", []);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useSessionState<PeriodResult[] | null>("cbd_results", null);

    // Options
    const [showDiff, setShowDiff] = useSessionState("cbd_showDiff", false);
    const [showRatio, setShowRatio] = useSessionState("cbd_showRatio", false);
    const [selectedProfile, setSelectedProfile] = useSessionState("cbd_profile", "");
    const [activeColumns, setActiveColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
    const [useMerge, setUseMerge] = useSessionState("cbd_useMerge", true);

    /* ── Init ── */
    useEffect(() => {
        fetch("/api/bq/cost-by-dept")
            .then((r) => r.json())
            .then((d) => {
                if (d.error) {
                    setError(d.error);
                    setInitLoading(false);
                    return;
                }
                setInitData(d);

                // Initialize default periods ONLY if no persisted periods
                const yms: { nam_qt: number; thang_qt: number }[] =
                    d.yearMonths || [];
                setPeriods((prev: PeriodDef[]) => {
                    if (prev.length > 0) return prev; // already have persisted periods
                    if (yms.length === 0) return prev;
                    const years = [
                        ...new Set(yms.map((ym: { nam_qt: number }) => ym.nam_qt)),
                    ].sort((a, b) => b - a);

                    const latestYear = years[0];
                    const latestMonths = yms
                        .filter((ym: { nam_qt: number }) => ym.nam_qt === latestYear)
                        .map((ym: { thang_qt: number }) => ym.thang_qt)
                        .sort((a: number, b: number) => a - b);

                    const prevYear = years.length > 1 ? years[1] : latestYear;
                    const prevMonths = yms
                        .filter((ym: { nam_qt: number }) => ym.nam_qt === prevYear)
                        .map((ym: { thang_qt: number }) => ym.thang_qt)
                        .sort((a: number, b: number) => a - b);

                    return [
                        {
                            id: 1,
                            fromYear: prevYear,
                            fromMonth: prevMonths[prevMonths.length - 1] || 1,
                            toYear: prevYear,
                            toMonth: prevMonths[prevMonths.length - 1] || 12,
                        },
                        {
                            id: 2,
                            fromYear: latestYear,
                            fromMonth: latestMonths[latestMonths.length - 1] || 1,
                            toYear: latestYear,
                            toMonth: latestMonths[latestMonths.length - 1] || 12,
                        },
                    ];
                });
                setInitLoading(false);
            })
            .catch((e: Error) => {
                setError(e.message);
                setInitLoading(false);
            });
    }, []);

    /* ── Profile change → update columns immediately ── */
    useEffect(() => {
        if (!selectedProfile) {
            setActiveColumns(DEFAULT_COLUMNS);
            return;
        }
        fetch(`/api/bq/profiles?name=${encodeURIComponent(selectedProfile)}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.items && d.items.length > 0) {
                    setActiveColumns(getActiveColumns(d.items as ProfileItem[]));
                } else {
                    setActiveColumns(DEFAULT_COLUMNS);
                }
            })
            .catch(() => {
                setActiveColumns(DEFAULT_COLUMNS);
            });
    }, [selectedProfile]);

    /* ── Compare ── */
    const handleCompare = useCallback(async () => {
        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const body: { periods: PeriodDef[]; profileName?: string } = {
                periods,
            };
            if (selectedProfile) {
                body.profileName = selectedProfile;
            }

            const res = await fetch("/api/bq/cost-by-dept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);

            const periodsData: PeriodResult[] = periods.map((p, i) => ({
                period: p,
                data: d.periodsData[i] || [],
            }));
            setResults(periodsData);

            // Apply profile columns if returned
            if (d.profileConfig) {
                setActiveColumns(
                    getActiveColumns(d.profileConfig as ProfileItem[])
                );
            } else {
                setActiveColumns(DEFAULT_COLUMNS);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [periods, selectedProfile]);

    /* ── Merge warning ── */
    const mergeWarning = useMemo(() => {
        if (!results || !initData) return null;
        const mergeRules = initData.mergeRules;
        if (!mergeRules || Object.keys(mergeRules).length === 0) return null;
        if (results.length < 2) return null;

        // Collect unique khoa names per period (BEFORE merge)
        const periodKhoas: { label: string; khoas: Set<string> }[] = results.map((pr) => ({
            label: formatPeriodLabel(pr.period.fromYear, pr.period.fromMonth, pr.period.toYear, pr.period.toMonth),
            khoas: new Set(pr.data.map((r) => r.khoa as unknown as string)),
        }));

        // Build reverse rules: target → [sources]
        const reverseRules: Record<string, string[]> = {};
        for (const [src, tgt] of Object.entries(mergeRules)) {
            if (!reverseRules[tgt]) reverseRules[tgt] = [];
            reverseRules[tgt].push(src);
        }

        const changes: string[] = [];
        for (const [target, sources] of Object.entries(reverseRules)) {
            const targetInAny = periodKhoas.some((pk) => pk.khoas.has(target));
            if (!targetInAny) continue;

            const estStr = initData.targetEstablished?.[target]
                ? ` (thành lập từ ${initData.targetEstablished[target]})`
                : "";

            for (const pk of periodKhoas) {
                const foundSources = sources.filter((s) => pk.khoas.has(s));
                if (foundSources.length === 0) continue;
                const srcText = foundSources.join(", ");
                const targetExists = pk.khoas.has(target);
                if (targetExists) {
                    changes.push(
                        `Chu kỳ ${pk.label}: Số liệu khoa ${srcText} gộp vào khoa ${target}${estStr}`
                    );
                } else {
                    changes.push(
                        `Chu kỳ ${pk.label}: Số liệu ${srcText} → gộp lại thành ${target}${estStr}`
                    );
                }
            }
        }

        if (changes.length === 0) return null;
        return changes;
    }, [results, initData]);

    /* ── Render ── */
    const headerJSX = (
        <header className="flex items-center gap-4 mb-6">
            <div className="bg-primary-100 p-3 rounded-xl">
                <span className="text-2xl">🏥</span>
            </div>
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Chi phí theo khoa</h1>
                <p className="text-slate-500 text-sm">So sánh chi phí giữa các khoa • Nhiều khoảng thời gian</p>
            </div>
        </header>
    );

    if (initLoading) {
        return (
            <>
                {headerJSX}
                <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
                </div>
            </>
        );
    }

    if (!initData || initData.yearMonths.length === 0) {
        return (
            <>
                {headerJSX}
                <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-4 text-sm">
                    Chưa có dữ liệu trong database.
                </div>
            </>
        );
    }

    return (
        <>
            {headerJSX}

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
                    ❌ {error}
                </div>
            )}

            {/* ── Main card ── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Period selector section */}
                <div className="p-6 border-b border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
                        <span className="text-sm">📅</span>
                        <span>Chọn khoảng thời gian</span>
                    </div>

                    <PeriodSelector
                        yearMonths={initData.yearMonths}
                        periods={periods}
                        onChange={setPeriods}
                        onCompare={handleCompare}
                        loading={loading}
                    />

                    {/* Options bar — border-t separator */}
                    <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-100">
                        {/* Profile selector */}
                        {initData.profileNames.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profile</label>
                                <select
                                    className="bg-slate-50 border-slate-200 rounded-lg text-sm w-auto py-1.5 pl-3 pr-8 focus:border-primary-500 focus:ring-primary-500"
                                    value={selectedProfile}
                                    onChange={(e) => setSelectedProfile(e.target.value)}
                                >
                                    <option value="">Tất cả</option>
                                    {initData.profileNames.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Checkboxes */}
                        <div className="flex items-center gap-6 mt-auto">
                            {periods.length >= 2 && (
                                <>
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                            checked={showDiff}
                                            onChange={(e) => setShowDiff(e.target.checked)}
                                        />
                                        <span className="ml-2 text-sm text-slate-600">Cột chênh lệch</span>
                                    </label>
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                            checked={showRatio}
                                            onChange={(e) => setShowRatio(e.target.checked)}
                                        />
                                        <span className="ml-2 text-sm text-slate-600">Cột tỷ lệ %</span>
                                    </label>
                                </>
                            )}
                            {Object.keys(initData.mergeRules).length > 0 && (
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                        checked={useMerge}
                                        onChange={(e) => setUseMerge(e.target.checked)}
                                    />
                                    <span className="ml-2 text-sm text-slate-600">Gộp khoa</span>
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* Merge warning — inside the card */}
                {results && mergeWarning && (
                    <div className="mx-6 mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-amber-500 mt-0.5">⚠️</span>
                            <div className="text-sm text-amber-800">
                                <p className="font-bold mb-1">Phát hiện thay đổi cấu trúc khoa giữa các khoảng thời gian:</p>
                                <ul className="list-disc list-inside space-y-1 opacity-90">
                                    {mergeWarning.map((msg, i) => (
                                        <li key={i}>{msg}</li>
                                    ))}
                                </ul>
                                <p className="mt-2 italic text-xs opacity-75">
                                    * Số liệu gộp có thể chưa chính xác nếu cấu trúc khoa thay đổi quá nhiều lần.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table section — inside the card */}
                {results && (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-primary-600">📊</span>
                                <h2 className="font-bold text-lg">Bảng so sánh</h2>
                            </div>
                            <button
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                onClick={() => exportCostByDept(
                                    results,
                                    activeColumns,
                                    initData.khoaOrder,
                                    useMerge ? initData.mergeRules : {},
                                    showDiff,
                                    showRatio
                                )}
                                title="Tải file Excel"
                            >
                                📥 Tải Excel
                            </button>
                        </div>
                        <ComparisonTable
                            periodsData={results}
                            columns={activeColumns}
                            khoaOrder={initData.khoaOrder}
                            mergeRules={useMerge ? initData.mergeRules : {}}
                            showDiff={showDiff}
                            showRatio={showRatio}
                        />
                    </div>
                )}

                {/* Empty state */}
                {!results && (
                    <div className="p-12 text-center text-slate-400">
                        <p className="text-sm">Chọn khoảng thời gian và nhấn <strong className="text-primary-600">So sánh</strong> để xem dữ liệu.</p>
                    </div>
                )}
            </div>
        </>
    );
}
