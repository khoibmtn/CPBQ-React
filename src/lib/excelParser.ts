/**
 * excelParser.ts – Client-side Excel parsing & transformation
 * ============================================================
 * All heavy processing runs in the browser to avoid Vercel's 4.5 MB body limit.
 * Server only receives minimal payloads (key columns for dup-check, chunked rows for upload).
 */
import * as XLSX from "xlsx";
import { REQUIRED_COLS, SCHEMA_COLS } from "./schema";

/* ── Types ── */

export interface SheetInfo {
    sheetName: string;
    matchedCols: string[];
    extraCols: string[];
    headerRowIndex: number;
}

export type Row = Record<string, unknown>;

export interface ProcessedSheet {
    sheetName: string;
    matchedCols: number;
    validRows: Row[];         // transformed + validated, with _idx
    invalidCount: number;
    issues: { col: string; count: number }[];
    summary: { period: string; maCSKCB: string; rows: number; tongChi: string }[];
}

/* ── Excel reading ── */

export async function readExcelFile(file: File): Promise<XLSX.WorkBook> {
    const buffer = await file.arrayBuffer();
    return XLSX.read(buffer, { type: "array" });
}

/* ── Sheet detection (flexible header row) ── */

export function detectCompatibleSheets(workbook: XLSX.WorkBook): SheetInfo[] {
    const compatible: SheetInfo[] = [];
    const requiredSet = new Set(REQUIRED_COLS.map((c) => c.toLowerCase()));

    for (const sheetName of workbook.SheetNames) {
        try {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            // Read as raw array (no auto-header)
            const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
                header: 1,
                defval: null,
            }) as unknown[][];
            if (rawData.length < 2) continue; // need header + at least 1 data row

            // Scan each row to find the header
            for (let rowIdx = 0; rowIdx < rawData.length - 1; rowIdx++) {
                const row = rawData[rowIdx];
                if (!row || !Array.isArray(row)) continue;

                const cellsLower = row.map((c) =>
                    c != null ? String(c).toLowerCase().trim() : ""
                );

                // Check if all required cols are present in this row
                const missingRequired = [...requiredSet].filter(
                    (c) => !cellsLower.includes(c)
                );

                if (missingRequired.length === 0) {
                    // Found header row
                    const schemaCols = SCHEMA_COLS.map((c) => c.toLowerCase());
                    const matched = schemaCols.filter((c) => cellsLower.includes(c));
                    const extra = cellsLower.filter(
                        (c) => c !== "" && !schemaCols.includes(c)
                    );

                    compatible.push({
                        sheetName,
                        matchedCols: matched,
                        extraCols: extra,
                        headerRowIndex: rowIdx,
                    });
                    break; // found header for this sheet, move to next sheet
                }
            }
        } catch {
            continue;
        }
    }
    return compatible;
}

/* ── Row extraction (flexible header + filter blank rows) ── */

export function extractSheetRows(
    workbook: XLSX.WorkBook,
    sheetName: string,
    headerRowIndex = 0
): Row[] {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    // Use `range` to tell sheet_to_json which row is the header
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        range: headerRowIndex,
    });

    // Normalize keys to lowercase, then filter: keep rows with ma_bn AND ho_ten
    return raw
        .map((row) => {
            const r: Row = {};
            for (const [key, val] of Object.entries(row)) {
                r[key.toLowerCase().trim()] = val;
            }
            return r;
        })
        .filter((r) => {
            const maBn = r.ma_bn;
            const hoTen = r.ho_ten;
            return (
                maBn != null && maBn !== "" && String(maBn).trim() !== "" &&
                hoTen != null && hoTen !== "" && String(hoTen).trim() !== ""
            );
        });
}

/* ── Full client-side processing (transform + validate + summary) ── */

export function processSheet(
    sheetName: string,
    rawRows: Row[],
    fileName: string,
    matchedCols: number
): ProcessedSheet {
    const transformed = transformRows(rawRows, fileName);
    const { valid, invalid, issues } = validateRows(transformed);
    const summary = buildSummary(valid);

    // Build display rows with all schema columns
    const displayRows = valid.map((row, idx) => {
        const display: Row = { _idx: idx };
        for (const col of SCHEMA_COLS) {
            display[col] = row[col] ?? null;
        }
        return display;
    });

    return {
        sheetName,
        matchedCols,
        validRows: displayRows,
        invalidCount: invalid.length,
        issues,
        summary,
    };
}

/* ── Transform rows ── */

function transformRows(rows: Row[], sourceFileName: string): Row[] {
    const now = new Date().toISOString();

    return rows.map((row) => {
        const r: Row = {};
        for (const [key, val] of Object.entries(row)) {
            r[key.toLowerCase().trim()] = val;
        }

        // Parse date integers
        for (const col of ["ngay_sinh", "gt_the_tu", "gt_the_den"]) {
            if (r[col] != null) r[col] = parseDateInt(r[col]);
        }

        // Parse datetime strings
        for (const col of ["ngay_vao", "ngay_ra"]) {
            if (r[col] != null) r[col] = parseDatetimeStr(r[col]);
        }

        // String columns
        const strCols = [
            "ma_bn", "ma_the", "ma_dkbd", "ma_benh", "ma_benhkhac",
            "ma_noi_chuyen", "ma_khoa", "ma_khuvuc", "ma_cskcb",
            "giam_dinh", "ho_ten", "dia_chi",
        ];
        for (const col of strCols) {
            if (r[col] != null && r[col] !== "") {
                r[col] = String(r[col]);
                if (r[col] === "nan" || r[col] === "undefined") r[col] = null;
            } else {
                r[col] = null;
            }
        }

        const parseNum = (v: unknown) => {
            if (typeof v === "number") return v;
            if (typeof v === "string") {
                const cleaned = v.replace(/,/g, "").trim();
                return cleaned ? Number(cleaned) : NaN;
            }
            return NaN;
        };

        // Float columns
        const floatCols = [
            "t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau",
            "t_pttt", "t_vtyt", "t_dvkt_tyle", "t_thuoc_tyle",
            "t_vtyt_tyle", "t_kham", "t_giuong", "t_vchuyen",
            "t_bntt", "t_bhtt", "t_ngoaids", "t_xuattoan",
            "t_nguonkhac", "t_datuyen", "t_vuottran",
        ];
        for (const col of floatCols) {
            if (r[col] != null) {
                const num = parseNum(r[col]);
                r[col] = isNaN(num) ? null : num;
            }
        }

        // Int columns
        const intCols = [
            "stt", "gioi_tinh", "ma_lydo_vvien", "so_ngay_dtri",
            "ket_qua_dtri", "tinh_trang_rv", "nam_qt", "thang_qt",
            "ma_loaikcb", "noi_ttoan",
        ];
        for (const col of intCols) {
            if (r[col] != null) {
                const num = parseNum(r[col]);
                r[col] = isNaN(num) ? null : Math.round(num);
            }
        }

        r["upload_timestamp"] = now;
        r["source_file"] = sourceFileName;
        return r;
    });
}

/* ── Date parsers ── */

function parseDateInt(val: unknown): string | null {
    if (val == null) return null;
    try {
        const raw = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const s = String(Math.round(Number(raw)));
        if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        if (!isNaN(Number(raw)) && Number(raw) > 10000 && Number(raw) < 100000) {
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + Number(raw) * 86400000);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        }
        return null;
    } catch { return null; }
}

function parseDatetimeStr(val: unknown): string | null {
    if (val == null) return null;
    try {
        const s = String(val).trim().replace(/^'/, "");
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00`;
        if (s.length === 12) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00`;
        if (s.length === 14) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
        if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`;
        const d = new Date(val as string);
        if (!isNaN(d.getTime())) return d.toISOString().replace("Z", "");
        return null;
    } catch { return null; }
}

/* ── Validate ── */

function validateRows(rows: Row[]): {
    valid: Row[];
    invalid: Row[];
    issues: { col: string; count: number }[];
} {
    const issueMap = new Map<string, number>();
    const valid: Row[] = [];
    const invalid: Row[] = [];

    for (const row of rows) {
        let isValid = true;
        for (const col of REQUIRED_COLS) {
            const val = row[col as string];
            if (val == null || val === "" || val === "nan") {
                issueMap.set(col, (issueMap.get(col) || 0) + 1);
                isValid = false;
                continue;
            }
            if (col === "gioi_tinh" && ![1, 2].includes(Number(val))) {
                issueMap.set(col, (issueMap.get(col) || 0) + 1);
                isValid = false;
            } else if (col === "thang_qt") {
                const num = Number(val);
                if (isNaN(num) || num < 1 || num > 12) {
                    issueMap.set(col, (issueMap.get(col) || 0) + 1);
                    isValid = false;
                }
            } else if ((col === "t_tongchi" || col === "t_bhtt") && isNaN(Number(val))) {
                issueMap.set(col, (issueMap.get(col) || 0) + 1);
                isValid = false;
            }
        }
        (isValid ? valid : invalid).push(row);
    }

    return {
        valid, invalid,
        issues: Array.from(issueMap.entries()).map(([col, count]) => ({ col, count })),
    };
}

/* ── Summary ── */

function buildSummary(
    rows: Row[]
): { period: string; maCSKCB: string; rows: number; tongChi: string }[] {
    const groups = new Map<string, { rows: number; tongChi: number }>();
    for (const r of rows) {
        const key = `${r.nam_qt || "?"}/${String(r.thang_qt || "?").padStart(2, "0")}|${r.ma_cskcb || "?"}`;
        const existing = groups.get(key) || { rows: 0, tongChi: 0 };
        existing.rows += 1;
        existing.tongChi += Number(r.t_tongchi) || 0;
        groups.set(key, existing);
    }
    return Array.from(groups.entries()).sort().map(([key, val]) => {
        const [period, maCSKCB] = key.split("|");
        return {
            period, maCSKCB,
            rows: val.rows,
            tongChi: val.tongChi.toLocaleString("vi-VN", { maximumFractionDigits: 0 }),
        };
    });
}
