/**
 * metrics.ts — Centralized metric definitions for cost-by-dept page
 * Ported from cost_by_dept.py lines 99-547
 */

/* ═══════════════════════════════════════════════════════════════════════════════
   METRIC DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════════ */

export interface MetricDef {
    name: string;
    field: string | null; // null = count metric (so_luot)
    isCount: boolean;
    noiOnly: boolean;
}

export interface BqMetricDef {
    name: string;
    field: string;
    noiOnly: boolean;
}

export interface RatioMetricDef {
    name: string;
    numField: string;
    denField: string;
    noiOnly: boolean;
    fmt: "pct" | "dec";
}

/** 13 base metrics */
export const METRICS: MetricDef[] = [
    { name: "Số lượt KCB", field: null, isCount: true, noiOnly: false },
    { name: "Số ngày điều trị", field: "so_ngay_dtri", isCount: false, noiOnly: true },
    { name: "Tổng chi", field: "t_tongchi", isCount: false, noiOnly: false },
    { name: "Xét nghiệm", field: "t_xn", isCount: false, noiOnly: false },
    { name: "CĐHA", field: "t_cdha", isCount: false, noiOnly: false },
    { name: "Thuốc", field: "t_thuoc", isCount: false, noiOnly: false },
    { name: "Máu", field: "t_mau", isCount: false, noiOnly: false },
    { name: "PTTT", field: "t_pttt", isCount: false, noiOnly: false },
    { name: "VTYT", field: "t_vtyt", isCount: false, noiOnly: false },
    { name: "Tiền khám", field: "t_kham", isCount: false, noiOnly: false },
    { name: "Tiền giường", field: "t_giuong", isCount: false, noiOnly: false },
    { name: "Tiền BHTT", field: "t_bhtt", isCount: false, noiOnly: false },
    { name: "Tiền BNTT", field: "t_bntt", isCount: false, noiOnly: false },
];

/** 11 per-visit average metrics (BQ = bình quân) */
export const BQ_METRICS: BqMetricDef[] = METRICS
    .filter((m) => !m.isCount && m.field !== "so_ngay_dtri")
    .map((m) => ({
        name: `BQ ${m.name}`,
        field: m.field!,
        noiOnly: m.noiOnly,
    }));

/** 2 ratio metrics */
export const RATIO_METRICS: RatioMetricDef[] = [
    { name: "Ngày ĐTTB", numField: "so_ngay_dtri", denField: "so_luot", noiOnly: true, fmt: "dec" },
    { name: "Tỷ lệ thuốc/tổng chi", numField: "t_thuoc", denField: "t_tongchi", noiOnly: false, fmt: "pct" },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   UNIFIED COLUMN DEFINITION
   ═══════════════════════════════════════════════════════════════════════════════ */

export type ColumnType = "metric" | "bq" | "ratio";

export interface ColumnDef {
    type: ColumnType;
    name: string;
    field?: string;
    isCount?: boolean;
    noiOnly: boolean;
    numField?: string;
    denField?: string;
    fmt?: "pct" | "dec";
}

/** Default ordered column list (metrics → bq → ratio) */
export const DEFAULT_COLUMNS: ColumnDef[] = [
    ...METRICS.map((m) => ({
        type: "metric" as const,
        name: m.name,
        field: m.field ?? undefined,
        isCount: m.isCount,
        noiOnly: m.noiOnly,
    })),
    ...BQ_METRICS.map((m) => ({
        type: "bq" as const,
        name: m.name,
        field: m.field,
        noiOnly: m.noiOnly,
    })),
    ...RATIO_METRICS.map((m) => ({
        type: "ratio" as const,
        name: m.name,
        numField: m.numField,
        denField: m.denField,
        noiOnly: m.noiOnly,
        fmt: m.fmt,
    })),
];

/* ═══════════════════════════════════════════════════════════════════════════════
   METRIC KEY LOOKUPS (for profile-based column filtering)
   ═══════════════════════════════════════════════════════════════════════════════ */

const METRIC_KEY_MAP: Record<string, ColumnDef> = {
    so_luot: { type: "metric", name: "Số lượt KCB", isCount: true, noiOnly: false },
    so_ngay_dtri: { type: "metric", name: "Số ngày điều trị", field: "so_ngay_dtri", noiOnly: true },
    t_tongchi: { type: "metric", name: "Tổng chi", field: "t_tongchi", noiOnly: false },
    t_xn: { type: "metric", name: "Xét nghiệm", field: "t_xn", noiOnly: false },
    t_cdha: { type: "metric", name: "CĐHA", field: "t_cdha", noiOnly: false },
    t_thuoc: { type: "metric", name: "Thuốc", field: "t_thuoc", noiOnly: false },
    t_mau: { type: "metric", name: "Máu", field: "t_mau", noiOnly: false },
    t_pttt: { type: "metric", name: "PTTT", field: "t_pttt", noiOnly: false },
    t_vtyt: { type: "metric", name: "VTYT", field: "t_vtyt", noiOnly: false },
    t_kham: { type: "metric", name: "Tiền khám", field: "t_kham", noiOnly: false },
    t_giuong: { type: "metric", name: "Tiền giường", field: "t_giuong", noiOnly: false },
    t_bhtt: { type: "metric", name: "Tiền BHTT", field: "t_bhtt", noiOnly: false },
    t_bntt: { type: "metric", name: "Tiền BNTT", field: "t_bntt", noiOnly: false },
};

const BQ_KEY_MAP: Record<string, ColumnDef> = {};
for (const m of BQ_METRICS) {
    const key = `bq_${m.field}`;
    BQ_KEY_MAP[key] = { type: "bq", name: m.name, field: m.field, noiOnly: m.noiOnly };
}

const RATIO_KEY_MAP: Record<string, ColumnDef> = {
    ngay_dttb: { type: "ratio", name: "Ngày ĐTTB", numField: "so_ngay_dtri", denField: "so_luot", noiOnly: true, fmt: "dec" },
    tl_thuoc_tongchi: { type: "ratio", name: "Tỷ lệ thuốc/tổng chi", numField: "t_thuoc", denField: "t_tongchi", noiOnly: false, fmt: "pct" },
};

export interface ProfileItem {
    metric_key: string;
    thu_tu: number;
    visible: boolean;
}

/** Resolve a profile config into ordered column list */
export function getActiveColumns(profileItems: ProfileItem[] | null): ColumnDef[] {
    if (!profileItems || profileItems.length === 0) {
        return DEFAULT_COLUMNS;
    }

    const columns: ColumnDef[] = [];
    for (const item of profileItems) {
        if (!item.visible) continue;
        const key = item.metric_key;
        const col = METRIC_KEY_MAP[key] || BQ_KEY_MAP[key] || RATIO_KEY_MAP[key];
        if (col) {
            columns.push(col);
        }
    }

    return columns.length > 0 ? columns : DEFAULT_COLUMNS;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PERIOD COLORS
   ═══════════════════════════════════════════════════════════════════════════════ */

export const PERIOD_COLORS = [
    { bg: "rgba(59,130,246,0.10)", border: "#3b82f6", label: "#93c5fd" },  // 0: Blue
    { bg: "rgba(249,115,22,0.10)", border: "#f97316", label: "#fdba74" },  // 1: Orange
    { bg: "rgba(20,184,166,0.10)", border: "#14b8a6", label: "#5eead4" },  // 2: Teal
    { bg: "rgba(139,92,246,0.10)", border: "#8b5cf6", label: "#c4b5fd" },  // 3: Violet
    { bg: "rgba(236,72,153,0.10)", border: "#ec4899", label: "#f9a8d4" },  // 4: Pink
    { bg: "rgba(16,185,129,0.10)", border: "#10b981", label: "#6ee7b7" },  // 5: Emerald
];

export function getPeriodColor(index: number) {
    return PERIOD_COLORS[index % PERIOD_COLORS.length];
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FORMATTING HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

export function fmtNumber(val: number | null | undefined, isCount = false): string {
    if (val == null || val === 0 || isNaN(val)) return "";
    if (isCount) return Math.round(val).toLocaleString("en-US");
    return Math.round(val).toLocaleString("en-US");
}

export function calcBq(amount: number | null, soLuot: number | null): string {
    if (!soLuot || soLuot === 0) return "";
    if (!amount || amount === 0) return "";
    return Math.round(amount / soLuot).toLocaleString("en-US");
}

export function calcRatio(num: number | null, den: number | null, fmt: "pct" | "dec" = "pct"): string {
    if (!den || den === 0) return "";
    if (!num || num === 0) return "";
    const val = num / den;
    if (fmt === "pct") return `${(val * 100).toFixed(1)}%`;
    return val.toFixed(1);
}

export function formatPeriodLabel(fromY: number, fromM: number, toY: number, toM: number): string {
    if (fromY === toY && fromM === toM) {
        return `${String(fromM).padStart(2, "0")}.${String(fromY % 100).padStart(2, "0")}`;
    }
    return `${String(fromM).padStart(2, "0")}.${String(fromY % 100).padStart(2, "0")}-${String(toM).padStart(2, "0")}.${String(toY % 100).padStart(2, "0")}`;
}

/** Get raw numeric value from a data row for a column definition */
export function getColRawValue(col: ColumnDef, row: Record<string, number> | null): number {
    if (!row) return 0;
    if (col.type === "metric") {
        const key = col.isCount ? "so_luot" : (col.field || "");
        return row[key] || 0;
    } else if (col.type === "bq") {
        const amount = row[col.field || ""] || 0;
        const soLuot = row["so_luot"] || 0;
        if (!soLuot) return 0;
        return amount / soLuot;
    } else if (col.type === "ratio") {
        const num = row[col.numField || ""] || 0;
        const den = row[col.denField || ""] || 0;
        if (!den) return 0;
        return num / den;
    }
    return 0;
}

/** Sum multiple rows across periods */
export function sumRows(
    rows: (Record<string, number> | null)[][],
    nPeriods: number
): Record<string, number>[] {
    const result: Record<string, number>[] = [];
    for (let pi = 0; pi < nPeriods; pi++) {
        const t: Record<string, number> = {};
        for (const m of METRICS) {
            const key = m.isCount ? "so_luot" : (m.field || "");
            t[key] = rows.reduce((acc, row) => {
                if (row[pi]) {
                    return acc + (row[pi]![key] || 0);
                }
                return acc;
            }, 0);
        }
        result.push(t);
    }
    return result;
}
