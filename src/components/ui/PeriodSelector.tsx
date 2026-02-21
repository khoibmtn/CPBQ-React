"use client";

import { getPeriodColor, formatPeriodLabel } from "@/lib/metrics";
import { Plus, Trash2, BarChart3, Loader2 } from "lucide-react";

export interface PeriodDef {
    id: number;
    fromYear: number;
    fromMonth: number;
    toYear: number;
    toMonth: number;
}

interface PeriodSelectorProps {
    yearMonths: { nam_qt: number; thang_qt: number }[];
    periods: PeriodDef[];
    onChange: (periods: PeriodDef[]) => void;
    onCompare: () => void;
    loading: boolean;
}

export default function PeriodSelector({
    yearMonths,
    periods,
    onChange,
    onCompare,
    loading,
}: PeriodSelectorProps) {
    const years = [...new Set(yearMonths.map((ym) => ym.nam_qt))].sort(
        (a, b) => b - a
    );

    const getMonthsForYear = (year: number) =>
        yearMonths
            .filter((ym) => ym.nam_qt === year)
            .map((ym) => ym.thang_qt)
            .sort((a, b) => a - b);

    const updatePeriod = (id: number, field: keyof PeriodDef, value: number) => {
        const updated = periods.map((p) => {
            if (p.id !== id) return p;
            const next = { ...p, [field]: value };
            if (field === "fromYear") {
                const months = getMonthsForYear(value);
                if (months.length > 0 && !months.includes(next.fromMonth)) {
                    next.fromMonth = months[0];
                }
            }
            if (field === "toYear") {
                const months = getMonthsForYear(value);
                if (months.length > 0 && !months.includes(next.toMonth)) {
                    next.toMonth = months[months.length - 1];
                }
            }
            return next;
        });
        onChange(updated);
    };

    const addPeriod = () => {
        const maxId = Math.max(0, ...periods.map((p) => p.id));
        const defaultY = years[0] || 2026;
        const months = getMonthsForYear(defaultY);
        onChange([
            ...periods,
            {
                id: maxId + 1,
                fromYear: defaultY,
                fromMonth: months[0] || 1,
                toYear: defaultY,
                toMonth: months[months.length - 1] || 12,
            },
        ]);
    };

    const removePeriod = (id: number) => {
        onChange(periods.filter((p) => p.id !== id));
    };

    const selectClasses = "rounded-lg border-gray-300 text-sm py-1.5 pl-3 pr-8 focus:border-primary-500 focus:ring-primary-500";

    return (
        <div className="mb-6">
            {/* Period rows */}
            <div className="flex flex-col gap-2 mb-4">
                {periods.map((p, idx) => {
                    const color = getPeriodColor(idx);
                    const label = formatPeriodLabel(
                        p.fromYear, p.fromMonth, p.toYear, p.toMonth
                    );

                    return (
                        <div key={p.id} className="flex items-center gap-2 flex-wrap">
                            <span
                                className="period-badge"
                                style={{ backgroundColor: color.border }}
                                title={label}
                            >
                                {idx + 1}
                            </span>

                            <select
                                className={selectClasses}
                                value={p.fromYear}
                                onChange={(e) =>
                                    updatePeriod(p.id, "fromYear", +e.target.value)
                                }
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>

                            <select
                                className={selectClasses}
                                value={p.fromMonth}
                                onChange={(e) =>
                                    updatePeriod(p.id, "fromMonth", +e.target.value)
                                }
                            >
                                {getMonthsForYear(p.fromYear).map((m) => (
                                    <option key={m} value={m}>
                                        Tháng {m}
                                    </option>
                                ))}
                            </select>

                            <span className="text-gray-400 shrink-0 px-0.5">→</span>

                            <select
                                className={selectClasses}
                                value={p.toYear}
                                onChange={(e) =>
                                    updatePeriod(p.id, "toYear", +e.target.value)
                                }
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>

                            <select
                                className={selectClasses}
                                value={p.toMonth}
                                onChange={(e) =>
                                    updatePeriod(p.id, "toMonth", +e.target.value)
                                }
                            >
                                {getMonthsForYear(p.toYear).map((m) => (
                                    <option key={m} value={m}>
                                        Tháng {m}
                                    </option>
                                ))}
                            </select>

                            {periods.length > 1 && (
                                <button
                                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                    onClick={() => removePeriod(p.id)}
                                    title="Xóa khoảng thời gian"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
                <button
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                    onClick={addPeriod}
                    disabled={periods.length >= 6}
                >
                    <Plus className="w-4 h-4" />
                    Thêm khoảng so sánh
                </button>
                <button
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                    onClick={onCompare}
                    disabled={loading || periods.length === 0}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
                        </>
                    ) : (
                        <>
                            <BarChart3 className="w-4 h-4" /> So sánh
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
