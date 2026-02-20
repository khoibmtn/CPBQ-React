"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import PageHeader from "@/components/ui/PageHeader";
import InfoBanner from "@/components/ui/InfoBanner";
import SectionTitle from "@/components/ui/SectionTitle";
import PeriodSelector, { PeriodDef } from "./PeriodSelector";
import ComparisonTable from "./ComparisonTable";
import {
    ColumnDef,
    DEFAULT_COLUMNS,
    getActiveColumns,
    ProfileItem,
    formatPeriodLabel,
} from "@/lib/metrics";

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
    const [initData, setInitData] = useState<InitData | null>(null);
    const [initLoading, setInitLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Periods
    const [periods, setPeriods] = useState<PeriodDef[]>([]);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<PeriodResult[] | null>(null);

    // Options
    const [showDiff, setShowDiff] = useState(false);
    const [showRatio, setShowRatio] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<string>("");
    const [activeColumns, setActiveColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
    const [useMerge, setUseMerge] = useState(true);

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

                // Initialize 2 default periods
                const yms: { nam_qt: number; thang_qt: number }[] =
                    d.yearMonths || [];
                if (yms.length > 0) {
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

                    setPeriods([
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
                    ]);
                }
                setInitLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setInitLoading(false);
            });
    }, []);

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
    if (initLoading) {
        return (
            <>
                <PageHeader
                    title="Chi phí theo khoa"
                    subtitle="So sánh chi phí giữa các khoa · Nhiều khoảng thời gian"
                    icon="🏥"
                    gradient="linear-gradient(135deg, rgba(16,185,129,0.9), rgba(6,182,212,0.85))"
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
                    title="Chi phí theo khoa"
                    subtitle="So sánh chi phí giữa các khoa · Nhiều khoảng thời gian"
                    icon="🏥"
                    gradient="linear-gradient(135deg, rgba(16,185,129,0.9), rgba(6,182,212,0.85))"
                />
                <InfoBanner type="info">
                    Chưa có dữ liệu trong database.
                </InfoBanner>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Chi phí theo khoa"
                subtitle="So sánh chi phí giữa các khoa · Nhiều khoảng thời gian"
                icon="🏥"
                gradient="linear-gradient(135deg, rgba(16,185,129,0.9), rgba(6,182,212,0.85))"
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

            {/* Options bar */}
            {results && (
                <div className="cbd-options-bar">
                    {/* Profile selector */}
                    {initData.profileNames.length > 0 && (
                        <div className="cbd-option">
                            <label className="form-label">Profile</label>
                            <select
                                className="form-select form-select-sm"
                                value={selectedProfile}
                                onChange={(e) => {
                                    setSelectedProfile(e.target.value);
                                }}
                            >
                                <option value="">Tất cả</option>
                                {initData.profileNames.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Diff/ratio checkboxes */}
                    {periods.length >= 2 && (
                        <>
                            <label className="cbd-checkbox">
                                <input
                                    type="checkbox"
                                    checked={showDiff}
                                    onChange={(e) =>
                                        setShowDiff(e.target.checked)
                                    }
                                />
                                Cột chênh lệch
                            </label>
                            <label className="cbd-checkbox">
                                <input
                                    type="checkbox"
                                    checked={showRatio}
                                    onChange={(e) =>
                                        setShowRatio(e.target.checked)
                                    }
                                />
                                Cột tỷ lệ %
                            </label>
                        </>
                    )}

                    {/* Merge toggle */}
                    {Object.keys(initData.mergeRules).length > 0 && (
                        <label className="cbd-checkbox">
                            <input
                                type="checkbox"
                                checked={useMerge}
                                onChange={(e) =>
                                    setUseMerge(e.target.checked)
                                }
                            />
                            Gộp khoa
                        </label>
                    )}
                </div>
            )}

            {/* Comparison table */}
            {results && (
                <>
                    {/* Merge warning */}
                    {mergeWarning && (
                        <InfoBanner type="warning">
                            <strong>⚠️ Phát hiện thay đổi cấu trúc khoa giữa các khoảng thời gian:</strong>
                            <ul style={{ margin: "0.5rem 0 0 1rem", padding: 0 }}>
                                {mergeWarning.map((msg, i) => (
                                    <li key={i} style={{ marginBottom: "0.25rem" }}>{msg}</li>
                                ))}
                            </ul>
                            <p style={{ marginTop: "0.5rem", fontStyle: "italic", opacity: 0.8 }}>
                                Số liệu gộp có thể chưa chính xác nếu cấu trúc khoa thay đổi nhiều lần.
                            </p>
                        </InfoBanner>
                    )}

                    <SectionTitle icon="📊">Bảng so sánh</SectionTitle>
                    <ComparisonTable
                        periodsData={results}
                        columns={activeColumns}
                        khoaOrder={initData.khoaOrder}
                        mergeRules={useMerge ? initData.mergeRules : {}}
                        showDiff={showDiff}
                        showRatio={showRatio}
                    />
                </>
            )}
        </>
    );
}
