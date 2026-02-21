/**
 * formatters.ts – Number & percentage formatting utilities
 * ========================================================
 * Ported from hospital_stats.py / cost_by_dept.py helpers.
 */

/** Format number for display. Returns "-" for 0/null/undefined. */
export function fmt(val: number | null | undefined, isCount = false): string {
    if (val === null || val === undefined || val === 0 || isNaN(val)) return "-";
    if (isCount) return Math.round(val).toLocaleString("en-US");
    return Math.round(val).toLocaleString("en-US");
}

/** Format decimal (2 dp), e.g. "7.72". Returns "-" for 0/null. */
export function fmtDec(val: number | null | undefined): string {
    if (val === null || val === undefined || val === 0 || isNaN(val)) return "-";
    return val.toFixed(2);
}

/** Format a number with commas, no decimals (for currency). */
export function fmtCurrency(val: number | null | undefined): string {
    if (val === null || val === undefined || val === 0 || isNaN(val)) return "";
    return Math.round(val).toLocaleString("en-US");
}

/**
 * Percentage change: (last/first - 1) × 100%.
 * Returns { text, color, sign } for rendering.
 */
export function pctChange(
    firstVal: number | null | undefined,
    lastVal: number | null | undefined
): { text: string; color: string; sign: string } | null {
    if (!firstVal || firstVal === 0 || !lastVal) return null;
    const pct = (lastVal / firstVal - 1) * 100;
    const sign = pct > 0 ? "+" : "";
    const color =
        pct > 0
            ? "#16a34a"
            : pct < 0
                ? "#dc2626"
                : "#94a3b8";
    return { text: `${sign}${pct.toFixed(1)}%`, color, sign };
}

/** Plain text version of pct change (for Excel export). */
export function pctChangeText(
    firstVal: number | null | undefined,
    lastVal: number | null | undefined
): string {
    if (!firstVal || firstVal === 0 || !lastVal) return "";
    const pct = (lastVal / firstVal - 1) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Difference: last - first.
 * Returns { text, color } for rendering.
 */
export function diffValue(
    firstVal: number | null | undefined,
    lastVal: number | null | undefined
): { text: string; color: string } | null {
    const f = firstVal ?? 0;
    const l = lastVal ?? 0;
    const diff = l - f;
    if (diff === 0) return null;
    const sign = diff > 0 ? "+" : "";
    const color =
        diff > 0 ? "#16a34a" : "#dc2626";
    const txt =
        typeof diff === "number" && Math.abs(diff) < 100
            ? `${sign}${diff.toFixed(2)}`
            : `${sign}${Math.round(diff).toLocaleString("en-US")}`;
    return { text: txt, color };
}

/** Raw diff for Excel export. */
export function diffRaw(
    firstVal: number | null | undefined,
    lastVal: number | null | undefined
): number {
    return (lastVal ?? 0) - (firstVal ?? 0);
}

/** Bình quân: amount / so_luot */
export function bq(amount: number, soLuot: number): number {
    if (!soLuot || soLuot === 0 || !amount) return 0;
    return amount / soLuot;
}
