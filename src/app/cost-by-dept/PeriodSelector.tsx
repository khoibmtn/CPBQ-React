"use client";

import { getPeriodColor, formatPeriodLabel } from "@/lib/metrics";

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

    return (
        <div className="period-selector">
            {/* Period rows */}
            <div className="period-rows">
                {periods.map((p, idx) => {
                    const color = getPeriodColor(idx);
                    const label = formatPeriodLabel(
                        p.fromYear, p.fromMonth, p.toYear, p.toMonth
                    );

                    return (
                        <div key={p.id} className="period-row">
                            {/* Badge */}
                            <span
                                className="period-badge"
                                style={{ backgroundColor: color.border }}
                                title={label}
                            >
                                {idx + 1}
                            </span>

                            {/* From Year */}
                            <select
                                className="form-select form-select-sm"
                                value={p.fromYear}
                                onChange={(e) =>
                                    updatePeriod(p.id, "fromYear", +e.target.value)
                                }
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>

                            {/* From Month */}
                            <select
                                className="form-select form-select-sm"
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

                            {/* Arrow */}
                            <span className="period-arrow">→</span>

                            {/* To Year */}
                            <select
                                className="form-select form-select-sm"
                                value={p.toYear}
                                onChange={(e) =>
                                    updatePeriod(p.id, "toYear", +e.target.value)
                                }
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>

                            {/* To Month */}
                            <select
                                className="form-select form-select-sm"
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

                            {/* Delete button */}
                            {periods.length > 1 && (
                                <button
                                    className="period-delete-btn"
                                    onClick={() => removePeriod(p.id)}
                                    title="Xóa khoảng thời gian"
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action buttons */}
            <div className="period-actions">
                <button
                    className="btn btn-secondary"
                    onClick={addPeriod}
                    disabled={periods.length >= 6}
                >
                    ➕ Thêm khoảng so sánh
                </button>
                <button
                    className="btn btn-primary"
                    onClick={onCompare}
                    disabled={loading || periods.length === 0}
                >
                    {loading ? (
                        <>
                            <span className="spinner" /> Đang tải...
                        </>
                    ) : (
                        "📊 So sánh"
                    )}
                </button>
            </div>
        </div>
    );
}
