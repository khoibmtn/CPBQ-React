/**
 * excelParser.ts – Client-side Excel parsing utilities
 * =====================================================
 * Detects compatible sheets and extracts rows from Excel files.
 * Runs in the browser to avoid sending large binary files to Vercel
 * (which has a hard 4.5 MB body limit).
 */
import * as XLSX from "xlsx";
import { REQUIRED_COLS, SCHEMA_COLS } from "./schema";

export interface SheetInfo {
    sheetName: string;
    matchedCols: string[];
    extraCols: string[];
}

export type Row = Record<string, unknown>;

/**
 * Detect sheets that contain all REQUIRED_COLS.
 */
export function detectCompatibleSheets(workbook: XLSX.WorkBook): SheetInfo[] {
    const compatible: SheetInfo[] = [];

    for (const sheetName of workbook.SheetNames) {
        try {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                sheet,
                { defval: null }
            );
            if (data.length === 0) continue;

            const colsLower = Object.keys(data[0]).map((c) =>
                c.toLowerCase().trim()
            );
            const matched = SCHEMA_COLS.filter((c) =>
                colsLower.includes(c)
            );
            const extra = colsLower.filter(
                (c) => !(SCHEMA_COLS as readonly string[]).includes(c)
            );
            const missingRequired = (REQUIRED_COLS as readonly string[]).filter(
                (c) => !colsLower.includes(c)
            );

            if (missingRequired.length === 0) {
                compatible.push({
                    sheetName,
                    matchedCols: matched as string[],
                    extraCols: extra,
                });
            }
        } catch {
            continue;
        }
    }

    return compatible;
}

/**
 * Extract rows from a specific sheet, normalizing column names to lowercase.
 */
export function extractSheetRows(
    workbook: XLSX.WorkBook,
    sheetName: string
): Row[] {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
    });

    // Normalize column names to lowercase
    return raw.map((row) => {
        const r: Row = {};
        for (const [key, val] of Object.entries(row)) {
            r[key.toLowerCase().trim()] = val;
        }
        return r;
    });
}

/**
 * Read an Excel File object and return the workbook.
 */
export async function readExcelFile(file: File): Promise<XLSX.WorkBook> {
    const buffer = await file.arrayBuffer();
    return XLSX.read(buffer, { type: "array" });
}
