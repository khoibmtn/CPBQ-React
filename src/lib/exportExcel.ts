/**
 * exportExcel.ts – Client-side Excel export for Hospital Stats
 * =============================================================
 * Uses the `xlsx` (SheetJS) library to generate .xlsx files in the browser.
 */

import * as XLSX from "xlsx";
import {
    ColumnDef,
    getColRawValue,
    sumRows,
    formatPeriodLabel,
} from "@/lib/metrics";
import { PeriodDef } from "@/components/ui/PeriodSelector";

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

/* ── Cost by Department Export (exceljs) ───────────────────────────────── */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

type Row = Record<string, number>;

interface CbdPeriodData {
    period: PeriodDef;
    data: Row[];
}

export async function exportCostByDept(
    periodsData: CbdPeriodData[],
    columns: ColumnDef[],
    khoaOrder: Record<string, number>,
    mergeRules: Record<string, string>,
    showDiff: boolean,
    showRatio: boolean
) {
    const nPeriods = periodsData.length;
    const effectiveShowDiff = showDiff && nPeriods >= 2;
    const effectiveShowRatio = showRatio && nPeriods >= 2;
    const colSpan = nPeriods + (effectiveShowDiff ? 1 : 0) + (effectiveShowRatio ? 1 : 0);

    // ── Apply merge rules ──
    const applyMerge = (rows: Row[]): Row[] => {
        if (!mergeRules || Object.keys(mergeRules).length === 0) return rows;
        const grouped = new Map<string, Row>();
        for (const row of rows) {
            const origKhoa = row.khoa as unknown as string;
            const ml2 = row.ml2 as unknown as string;
            const mappedKhoa = mergeRules[origKhoa] || origKhoa;
            const key = `${ml2}|${mappedKhoa}`;
            if (grouped.has(key)) {
                const existing = grouped.get(key)!;
                for (const [k, v] of Object.entries(row)) {
                    if (k === "ml2" || k === "khoa") continue;
                    existing[k] = (existing[k] || 0) + (v || 0);
                }
            } else {
                grouped.set(key, { ...row, khoa: mappedKhoa as unknown as number });
            }
        }
        return Array.from(grouped.values());
    };

    // ── Group data by ml2 → khoa ──
    const groups: Record<string, Record<string, (Row | null)[]>> = {
        "Ngoại trú": {},
        "Nội trú": {},
    };

    periodsData.forEach((pd, pi) => {
        const mergedData = applyMerge(pd.data);
        for (const row of mergedData) {
            const ml2 = row.ml2 as unknown as string;
            const khoa = row.khoa as unknown as string;
            if (!(ml2 in groups)) continue;
            if (!(khoa in groups[ml2])) {
                groups[ml2][khoa] = new Array(nPeriods).fill(null);
            }
            groups[ml2][khoa][pi] = row;
        }
    });

    // ── Sort departments ──
    const sortKey = (name: string): [number, number, string] => {
        const order = khoaOrder[name];
        if (order != null) return [0, order, name];
        return [1, 0, name];
    };

    for (const ml2 of Object.keys(groups)) {
        const entries = Object.entries(groups[ml2]);
        entries.sort((a, b) => {
            const ka = sortKey(a[0]);
            const kb = sortKey(b[0]);
            if (ka[0] !== kb[0]) return ka[0] - kb[0];
            if (ka[1] !== kb[1]) return ka[1] - kb[1];
            return ka[2].localeCompare(kb[2]);
        });
        groups[ml2] = Object.fromEntries(entries);
    }

    // ── Cell value helpers ──
    const getCellNum = (col: ColumnDef, row: Row | null): string | number => {
        if (!row) return "";
        const raw = getColRawValue(col, row);
        if (raw === 0) return "";
        if (col.type === "ratio") {
            if (col.fmt === "pct") return `${(raw * 100).toFixed(1)}%`;
            return Math.round(raw * 10) / 10;
        }
        if (col.type === "bq") return Math.round(raw);
        return Math.round(raw);
    };

    const getDiff = (col: ColumnDef, rows: (Row | null)[]): string | number => {
        const first = getColRawValue(col, rows[0]);
        const last = getColRawValue(col, rows[rows.length - 1]);
        const d = last - first;
        if (d === 0) return "";
        if (col.type === "ratio") {
            if (col.fmt === "pct") {
                const sign = d > 0 ? "+" : "";
                return `${sign}${(d * 100).toFixed(2)}`;
            }
            return Math.round(d * 10) / 10;
        }
        return Math.round(d);
    };

    const getPctChange = (col: ColumnDef, rows: (Row | null)[]): string => {
        const first = getColRawValue(col, rows[0]);
        const last = getColRawValue(col, rows[rows.length - 1]);
        if (!first || first === 0 || !last) return "";
        const pct = (last / first - 1) * 100;
        const sign = pct > 0 ? "+" : "";
        return `${sign}${pct.toFixed(1)}%`;
    };

    // ── Period labels ──
    const periodLabels = periodsData.map((pd) =>
        formatPeriodLabel(pd.period.fromYear, pd.period.fromMonth, pd.period.toYear, pd.period.toMonth)
    );

    // ── Styles ──
    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };

    const headerFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };
    const sectionFont: Partial<ExcelJS.Font> = { bold: true, size: 11, color: { argb: "FF4338CA" } };
    const subtotalFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };
    const totalFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };
    const normalFont: Partial<ExcelJS.Font> = { size: 11 };

    const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };
    const leftAlign: Partial<ExcelJS.Alignment> = { horizontal: "left", vertical: "middle" };
    const rightAlign: Partial<ExcelJS.Alignment> = { horizontal: "right", vertical: "middle" };

    // ── Build workbook ──
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Chi phí theo khoa");

    const totalDataCols = columns.length * colSpan;
    const totalCols = 2 + totalDataCols; // TT + Khoa + data

    // Track max width per column for auto-fit
    const colMaxWidths: number[] = new Array(totalCols).fill(0);
    const updateWidth = (colIdx: number, val: string | number) => {
        const len = String(val).length;
        if (len > colMaxWidths[colIdx]) colMaxWidths[colIdx] = len;
    };

    // ── Helper: style a range of cells ──
    const styleRow = (
        excelRow: ExcelJS.Row,
        font: Partial<ExcelJS.Font>,
        align?: Partial<ExcelJS.Alignment>,
    ) => {
        for (let c = 1; c <= totalCols; c++) {
            const cell = excelRow.getCell(c);
            cell.border = thinBorder;
            cell.font = font;
            if (c === 1) cell.alignment = centerAlign;         // TT
            else if (c === 2) cell.alignment = leftAlign;       // Khoa
            else cell.alignment = align || rightAlign;          // numbers
        }
    };

    /* ── Header Row 1: TT | Khoa | [Metric names] ── */
    const h1Vals: (string | number)[] = ["TT", "Khoa"];
    for (const col of columns) {
        h1Vals.push(col.name + (col.noiOnly ? " (NT)" : ""));
        for (let i = 1; i < colSpan; i++) h1Vals.push("");
    }
    const h1Row = ws.addRow(h1Vals);
    styleRow(h1Row, headerFont, centerAlign);
    h1Vals.forEach((v, i) => updateWidth(i, v));

    /* ── Header Row 2: "" | "" | period labels ── */
    const h2Vals: (string | number)[] = ["", ""];
    for (let ci = 0; ci < columns.length; ci++) {
        for (const lbl of periodLabels) h2Vals.push(lbl);
        if (effectiveShowDiff) h2Vals.push("Chênh lệch");
        if (effectiveShowRatio) h2Vals.push("Tỷ lệ %");
    }
    const h2Row = ws.addRow(h2Vals);
    styleRow(h2Row, headerFont, centerAlign);
    h2Vals.forEach((v, i) => updateWidth(i, v));

    // ── Merges for headers ──
    // TT: merge rows 1-2, col 1
    ws.mergeCells(1, 1, 2, 1);
    // Khoa: merge rows 1-2, col 2
    ws.mergeCells(1, 2, 2, 2);
    // Metric group headers: merge across columns in row 1
    let cStart = 3; // 1-indexed
    for (let ci = 0; ci < columns.length; ci++) {
        if (colSpan > 1) {
            ws.mergeCells(1, cStart, 1, cStart + colSpan - 1);
        }
        cStart += colSpan;
    }

    /* ── Section + data row builder ── */
    const sectionLabels: [string, string][] = [
        ["Ngoại trú", "I. Ngoại trú"],
        ["Nội trú", "II. Nội trú"],
    ];

    const allSubtotals: Record<string, Row[]> = {};

    const addDataRow = (
        idx: string | number,
        label: string,
        periodDataList: (Row | null)[],
        font: Partial<ExcelJS.Font>,
    ) => {
        const vals: (string | number)[] = [idx, label];
        for (const col of columns) {
            for (let pi = 0; pi < nPeriods; pi++) {
                vals.push(getCellNum(col, periodDataList[pi]));
            }
            if (effectiveShowDiff) vals.push(getDiff(col, periodDataList));
            if (effectiveShowRatio) vals.push(getPctChange(col, periodDataList));
        }
        const row = ws.addRow(vals);
        styleRow(row, font);
        // Bold the Khoa cell for subtotal/total rows
        if (font.bold) {
            row.getCell(2).font = font;
        }
        vals.forEach((v, i) => updateWidth(i, v));
    };

    for (const [ml2Key, sectionTitle] of sectionLabels) {
        const deptDict = groups[ml2Key] || {};
        const entries = Object.entries(deptDict);

        // Section header row
        const sVals: (string | number)[] = ["", sectionTitle];
        for (let i = 0; i < totalDataCols; i++) sVals.push("");
        const sRow = ws.addRow(sVals);
        styleRow(sRow, sectionFont, leftAlign);
        sRow.getCell(2).font = sectionFont;
        updateWidth(1, sectionTitle);

        // Department rows
        entries.forEach(([khoaName, periodDataList], idx) => {
            addDataRow(idx + 1, khoaName, periodDataList, normalFont);
        });

        allSubtotals[ml2Key] = sumRows(Object.values(deptDict), nPeriods);
    }

    // III. TỔNG section header
    const tVals: (string | number)[] = ["", "III. TỔNG"];
    for (let i = 0; i < totalDataCols; i++) tVals.push("");
    const tRow = ws.addRow(tVals);
    styleRow(tRow, sectionFont, leftAlign);
    tRow.getCell(2).font = sectionFont;

    // Subtotal: Ngoại trú
    const ngoaiTotals = allSubtotals["Ngoại trú"] || Array(nPeriods).fill({});
    addDataRow(1, "Ngoại trú", ngoaiTotals, subtotalFont);

    // Subtotal: Nội trú
    const noiTotals = allSubtotals["Nội trú"] || Array(nPeriods).fill({});
    addDataRow(2, "Nội trú", noiTotals, subtotalFont);

    // Grand total
    const combined: Row[] = [];
    for (let pi = 0; pi < nPeriods; pi++) {
        const ct: Row = {};
        const ngoai = ngoaiTotals[pi] || {};
        const noi = noiTotals[pi] || {};
        const allKeys = new Set([...Object.keys(ngoai), ...Object.keys(noi)]);
        for (const k of allKeys) {
            ct[k] = (ngoai[k] || 0) + (noi[k] || 0);
        }
        combined.push(ct);
    }
    addDataRow("", "Tổng cộng", combined, totalFont);

    /* ── Auto-fit column widths ── */
    for (let i = 0; i < totalCols; i++) {
        const minW = i === 0 ? 5 : i === 1 ? 12 : 10;
        const w = Math.max(minW, colMaxWidths[i] + 3); // +3 for padding
        ws.getColumn(i + 1).width = w;
    }

    /* ── Download ── */
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `CPBQ_ChiPhiTheoKhoa_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ── ICD Analysis Export (exceljs) ─────────────────────────────────────── */

interface IcdRow {
    ma_benh_chinh: string;
    so_luot: number;
    so_ngay_dtri: number;
    t_tongchi: number;
    t_bhtt: number;
}

interface IcdPeriodData {
    period: PeriodDef;
    data: IcdRow[];
}

type CostType = "soluot" | "tongcp" | "cpbhyt";
type DiffMetric = "so_luot" | "ngay_dttb" | "bq_dt" | "pct_val";

function computeIcdRow(
    row: IcdRow,
    costType: CostType,
    periodTotal: { so_luot: number; t_tongchi: number; t_bhtt: number }
) {
    const so_luot = row.so_luot || 0;
    const so_ngay = row.so_ngay_dtri || 0;
    const tongchi = row.t_tongchi || 0;
    const bhtt = row.t_bhtt || 0;

    const ngay_dttb = so_luot ? so_ngay / so_luot : 0;
    const bq_dt = costType === "cpbhyt"
        ? (so_luot ? bhtt / so_luot : 0)
        : (so_luot ? tongchi / so_luot : 0);

    let pct_val = 0;
    if (costType === "soluot") {
        pct_val = periodTotal.so_luot ? (so_luot / periodTotal.so_luot) * 100 : 0;
    } else if (costType === "tongcp") {
        pct_val = periodTotal.t_tongchi ? (tongchi / periodTotal.t_tongchi) * 100 : 0;
    } else {
        pct_val = periodTotal.t_bhtt ? (bhtt / periodTotal.t_bhtt) * 100 : 0;
    }

    return { so_luot, ngay_dttb, bq_dt, pct_val };
}

export async function exportIcdAnalysis(
    periodsData: IcdPeriodData[],
    icdList: string[],
    costType: CostType,
    pctColLabel: string,
    diffMetric: DiffMetric | null,
    diffReverse: boolean
) {
    const nPeriods = periodsData.length;
    const showDiff = diffMetric !== null && nPeriods >= 2;

    const bqLabel = costType === "cpbhyt" ? "BQĐT BHYT" : "BQĐT Tổng chi";
    const colLabels = ["Số lượt", "Ngày ĐTTB", bqLabel, pctColLabel];
    const colsPerPeriod = colLabels.length;
    const diffCols = showDiff ? 2 : 0;
    const totalDataCols = colsPerPeriod * nPeriods + diffCols;
    const totalCols = 2 + totalDataCols; // STT + Mã bệnh + data

    // Precompute totals per period
    const periodTotals = periodsData.map((pd) => ({
        so_luot: pd.data.reduce((s, r) => s + (r.so_luot || 0), 0),
        t_tongchi: pd.data.reduce((s, r) => s + (r.t_tongchi || 0), 0),
        t_bhtt: pd.data.reduce((s, r) => s + (r.t_bhtt || 0), 0),
    }));

    // Period lookups
    const periodLookups = periodsData.map((pd) => {
        const lookup: Record<string, IcdRow> = {};
        for (const row of pd.data) lookup[row.ma_benh_chinh] = row;
        return lookup;
    });

    // Period labels
    const periodLabels = periodsData.map((pd) =>
        formatPeriodLabel(pd.period.fromYear, pd.period.fromMonth, pd.period.toYear, pd.period.toMonth)
    );

    // Diff label
    let diffValueLabel = "";
    if (showDiff && diffMetric) {
        if (diffMetric === "so_luot") diffValueLabel = "Lượt";
        else if (diffMetric === "ngay_dttb") diffValueLabel = "Ngày";
        else diffValueLabel = "Chi phí";
    }

    // ── Styles ──
    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };

    const headerFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };
    const normalFont: Partial<ExcelJS.Font> = { size: 11 };
    const totalFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };
    const icdFont: Partial<ExcelJS.Font> = { bold: true, size: 11, color: { argb: "FF3B82F6" } };

    const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };
    const rightAlign: Partial<ExcelJS.Alignment> = { horizontal: "right", vertical: "middle" };

    // ── Build workbook ──
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Chi phí theo mã bệnh");

    const colMaxWidths: number[] = new Array(totalCols).fill(0);
    const updateWidth = (colIdx: number, val: string | number) => {
        const len = String(val).length;
        if (len > colMaxWidths[colIdx]) colMaxWidths[colIdx] = len;
    };

    const styleRow = (
        excelRow: ExcelJS.Row,
        font: Partial<ExcelJS.Font>,
        align?: Partial<ExcelJS.Alignment>,
    ) => {
        for (let c = 1; c <= totalCols; c++) {
            const cell = excelRow.getCell(c);
            cell.border = thinBorder;
            cell.font = font;
            if (c <= 2) cell.alignment = centerAlign;
            else cell.alignment = align || rightAlign;
        }
    };

    /* ── Header Row 1: STT | Mã bệnh | [Period labels] | Chênh lệch ── */
    const h1Vals: (string | number)[] = ["STT", "Mã bệnh"];
    for (const lbl of periodLabels) {
        h1Vals.push(lbl);
        for (let i = 1; i < colsPerPeriod; i++) h1Vals.push("");
    }
    if (showDiff) {
        h1Vals.push(`Chênh lệch (${diffReverse ? "T-P" : "P-T"})`);
        h1Vals.push("");
    }
    const h1Row = ws.addRow(h1Vals);
    styleRow(h1Row, headerFont, centerAlign);
    h1Vals.forEach((v, i) => updateWidth(i, v));

    /* ── Header Row 2: "" | "" | column labels per period | diff labels ── */
    const h2Vals: (string | number)[] = ["", ""];
    for (let pi = 0; pi < nPeriods; pi++) {
        for (const cl of colLabels) h2Vals.push(cl);
    }
    if (showDiff) {
        h2Vals.push(diffValueLabel);
        h2Vals.push("%");
    }
    const h2Row = ws.addRow(h2Vals);
    styleRow(h2Row, headerFont, centerAlign);
    h2Vals.forEach((v, i) => updateWidth(i, v));

    // ── Merges ──
    // STT: merge rows 1-2, col 1
    ws.mergeCells(1, 1, 2, 1);
    // Mã bệnh: merge rows 1-2, col 2
    ws.mergeCells(1, 2, 2, 2);
    // Period headers: merge across columns in row 1
    let cStart = 3;
    for (let pi = 0; pi < nPeriods; pi++) {
        if (colsPerPeriod > 1) {
            ws.mergeCells(1, cStart, 1, cStart + colsPerPeriod - 1);
        }
        cStart += colsPerPeriod;
    }
    // Diff header merge
    if (showDiff) {
        ws.mergeCells(1, cStart, 1, cStart + 1);
    }

    /* ── Data rows ── */
    for (let sttIdx = 0; sttIdx < icdList.length; sttIdx++) {
        const icdCode = icdList[sttIdx];
        const vals: (string | number)[] = [sttIdx + 1, icdCode];

        const computedValues: ReturnType<typeof computeIcdRow>[] = [];

        for (let pi = 0; pi < nPeriods; pi++) {
            const row = periodLookups[pi][icdCode];
            if (row) {
                const cv = computeIcdRow(row, costType, periodTotals[pi]);
                computedValues[pi] = cv;
                vals.push(cv.so_luot || "");
                vals.push(cv.ngay_dttb ? Math.round(cv.ngay_dttb * 100) / 100 : "");
                vals.push(cv.bq_dt ? Math.round(cv.bq_dt) : "");
                vals.push(cv.pct_val ? `${cv.pct_val.toFixed(2)}%` : "");
            } else {
                vals.push("", "", "", "");
            }
        }

        // Diff columns
        if (showDiff && diffMetric) {
            const first = computedValues[0];
            const last = computedValues[nPeriods - 1];
            if (first && last) {
                const fIdx = diffReverse ? 0 : nPeriods - 1;
                const lIdx = diffReverse ? nPeriods - 1 : 0;
                const fv = computedValues[fIdx];
                const lv = computedValues[lIdx];
                if (fv && lv) {
                    const a = fv[diffMetric];
                    const b = lv[diffMetric];
                    const diff = b - a;
                    vals.push(diff === 0 ? "" : (diffMetric === "ngay_dttb" ? Math.round(diff * 100) / 100 : Math.round(diff)));
                    const pct = a ? ((b / a - 1) * 100) : 0;
                    vals.push(pct === 0 ? "" : `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`);
                } else {
                    vals.push("", "");
                }
            } else {
                vals.push("", "");
            }
        }

        const dataRow = ws.addRow(vals);
        styleRow(dataRow, normalFont);
        // Blue ICD code cell
        dataRow.getCell(2).font = icdFont;
        vals.forEach((v, i) => updateWidth(i, v));
    }

    /* ── Total row ── */
    const totVals: (string | number)[] = ["", "TỔNG TOÀN BỘ"];
    for (let pi = 0; pi < nPeriods; pi++) {
        const pt = periodTotals[pi];
        const soLuot = pt.so_luot;
        const tongchi = pt.t_tongchi;
        const bhtt = pt.t_bhtt;
        const ngayTotal = periodsData[pi].data.reduce((s, r) => s + (r.so_ngay_dtri || 0), 0);
        const ngayDttb = soLuot ? ngayTotal / soLuot : 0;
        const bqDt = costType === "cpbhyt" ? (soLuot ? bhtt / soLuot : 0) : (soLuot ? tongchi / soLuot : 0);

        totVals.push(soLuot || "");
        totVals.push(ngayDttb ? Math.round(ngayDttb * 100) / 100 : "");
        totVals.push(bqDt ? Math.round(bqDt) : "");
        totVals.push("100.00%");
    }
    if (showDiff) {
        totVals.push("", "");
    }
    const totRow = ws.addRow(totVals);
    styleRow(totRow, totalFont);

    /* ── Auto-fit column widths ── */
    for (let i = 0; i < totalCols; i++) {
        const minW = i === 0 ? 5 : i === 1 ? 10 : 10;
        const w = Math.max(minW, colMaxWidths[i] + 3);
        ws.getColumn(i + 1).width = w;
    }

    /* ── Download ── */
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `CPBQ_MaBenh_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
