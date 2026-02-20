/**
 * exportExcel.ts – Client-side Excel export for Hospital Stats
 * =============================================================
 * Uses the `xlsx` (SheetJS) library to generate .xlsx files in the browser.
 */

import * as XLSX from "xlsx";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface ExportRow {
    label: string;
    section?: boolean;
    totalStyle?: boolean;
    values?: Record<string, number[]>;
}

const GROUPS = ["Nội trú", "Ngoại trú", "Tổng"] as const;

/* ── Helpers ───────────────────────────────────────────────────────────── */

function fmtNum(v: number, isDecimal = false): string | number {
    if (v === 0 || isNaN(v)) return "";
    if (isDecimal) return Math.round(v * 100) / 100; // keep as number for Excel
    return Math.round(v);
}

function pctText(first: number, last: number): string {
    if (!first || first === 0 || !last) return "";
    const pct = (last / first - 1) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
}

function diffText(first: number, last: number): string | number {
    const d = last - first;
    if (d === 0) return "";
    return Math.round(d);
}

/* ── Main Export ───────────────────────────────────────────────────────── */

export function exportHospitalStats(
    rows: ExportRow[],
    periodLabels: string[],
    options: {
        showRatio: boolean;
        showDiff: boolean;
    }
) {
    const { showRatio, showDiff } = options;
    const n = periodLabels.length;

    // Build worksheet data as array-of-arrays
    const wsData: (string | number)[][] = [];
    const merges: XLSX.Range[] = [];

    /* ── Header row 1: "Toàn BV" + group names ── */
    const h1: (string | number)[] = ["Toàn BV"];
    const colsPerGroup = n + (showDiff ? 1 : 0) + (showRatio ? 1 : 0);

    for (const g of GROUPS) {
        h1.push(g);
        for (let i = 1; i < colsPerGroup; i++) h1.push(""); // placeholders for merge
    }
    wsData.push(h1);

    // Merge "Toàn BV" across row 0-1
    merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });

    // Merge each group header
    let colStart = 1;
    for (let gi = 0; gi < GROUPS.length; gi++) {
        if (colsPerGroup > 1) {
            merges.push({
                s: { r: 0, c: colStart },
                e: { r: 0, c: colStart + colsPerGroup - 1 },
            });
        }
        colStart += colsPerGroup;
    }

    /* ── Header row 2: period labels + optional columns ── */
    const h2: (string | number)[] = [""]; // under "Toàn BV"
    for (let gi = 0; gi < GROUPS.length; gi++) {
        for (let pi = 0; pi < n; pi++) {
            h2.push(periodLabels[pi]);
        }
        if (showDiff) h2.push("Chênh lệch");
        if (showRatio) h2.push("Tỷ lệ %");
    }
    wsData.push(h2);

    /* ── Data rows ── */
    for (const row of rows) {
        if (row.section) {
            // Section header row
            const sectionRow: (string | number)[] = [row.label];
            wsData.push(sectionRow);
            continue;
        }

        const isDecimal = row.label === "Ngày ĐT TB";
        const r: (string | number)[] = [row.label];

        for (const g of GROUPS) {
            const vals = row.values?.[g] || [];
            for (let pi = 0; pi < n; pi++) {
                r.push(fmtNum(vals[pi] ?? 0, isDecimal));
            }
            if (showDiff) {
                r.push(vals.length >= 2 ? diffText(vals[0], vals[vals.length - 1]) : "");
            }
            if (showRatio) {
                r.push(vals.length >= 2 ? pctText(vals[0], vals[vals.length - 1]) : "");
            }
        }

        wsData.push(r);
    }

    /* ── Create workbook & download ── */
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!merges"] = merges;

    // Set column widths
    const colWidths: XLSX.ColInfo[] = [{ wch: 16 }]; // label column
    const totalCols = 1 + colsPerGroup * GROUPS.length;
    for (let i = 1; i < totalCols; i++) {
        colWidths.push({ wch: 14 });
    }
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Toàn viện");
    XLSX.writeFile(wb, `CPBQ_ToanVien_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
