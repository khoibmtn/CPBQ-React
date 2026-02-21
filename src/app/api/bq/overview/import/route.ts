import { NextResponse } from "next/server";
import { getBqClient } from "@/lib/bigquery";
import {
    PROJECT_ID,
    DATASET_ID,
    FULL_TABLE_ID,
    getFullTableId,
    LOOKUP_CSKCB_TABLE,
    LOOKUP_KHOA_TABLE,
    LOOKUP_LOAIKCB_TABLE,
} from "@/lib/config";
import { REQUIRED_COLS, SCHEMA_COLS, ROW_KEY_COLS } from "@/lib/schema";
import * as XLSX from "xlsx";

/* ═══════════════════════════════════════════════════════════════════════════════
   POST /api/bq/overview/import
   Body: FormData with file + optional sheet name
   Returns: validation results (sheets, valid/invalid counts, summary, duplicates)
   ═══════════════════════════════════════════════════════════════════════════════ */

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "Không tìm thấy file." },
                { status: 400 }
            );
        }

        // Read Excel file
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer" });

        // ── Sheet detection ──
        const compatibleSheets = detectCompatibleSheets(workbook);
        if (compatibleSheets.length === 0) {
            return NextResponse.json({
                error: "Không tìm thấy sheet nào có đủ 14 cột bắt buộc.",
                sheets: [],
            });
        }

        // Process ALL compatible sheets
        const client = getBqClient();
        const sheetsData: {
            sheetName: string;
            matchedCols: number;
            validRows: Record<string, unknown>[];
            invalidCount: number;
            dupCount: number;
            newCount: number;
            issues: { col: string; count: number }[];
            summary: { period: string; maCSKCB: string; rows: number; tongChi: string }[];
        }[] = [];

        for (const sheetInfo of compatibleSheets) {
            const sheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                workbook.Sheets[sheetInfo.sheetName],
                { defval: null }
            );
            if (sheetData.length === 0) continue;

            // Transform + validate
            const transformed = transformRows(sheetData, file.name);
            const { valid, invalid, issues } = validateRows(transformed);
            const summary = buildSummary(valid);

            // Check duplicates (get indices, not just count)
            let dupIndices = new Set<number>();
            try {
                dupIndices = await getDuplicateIndices(client, valid);
            } catch {
                // BigQuery unavailable
            }

            // Build display rows with all schema columns + isDuplicate flag
            const displayRows = valid.map((row, idx) => {
                const display: Record<string, unknown> = { _idx: idx };
                for (const col of SCHEMA_COLS) {
                    display[col] = row[col] ?? null;
                }
                display._isDuplicate = dupIndices.has(idx);
                return display;
            });

            sheetsData.push({
                sheetName: sheetInfo.sheetName,
                matchedCols: sheetInfo.matchedCols.length,
                validRows: displayRows,
                invalidCount: invalid.length,
                dupCount: dupIndices.size,
                newCount: valid.length - dupIndices.size,
                issues,
                summary,
            });
        }

        return NextResponse.json({ sheets: sheetsData });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PUT /api/bq/overview/import
   Body: FormData with file + sheet + rowIndices (JSON array) + mode ("new" | "overwrite")
   - mode="new": Upload only non-duplicate rows
   - mode="overwrite": DELETE old duplicates first, then INSERT new versions
   ═══════════════════════════════════════════════════════════════════════════════ */

export async function PUT(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const sheetName = formData.get("sheet") as string | null;
        const rowIndicesStr = formData.get("rowIndices") as string | null;
        const mode = (formData.get("mode") as string) || "new";

        if (!file || !sheetName) {
            return NextResponse.json(
                { error: "Missing file or sheet name." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
            workbook.Sheets[sheetName],
            { defval: null }
        );

        // Transform + validate
        const transformed = transformRows(sheetData, file.name);
        const { valid } = validateRows(transformed);

        if (valid.length === 0) {
            return NextResponse.json({ error: "Không có dòng hợp lệ.", uploaded: 0 });
        }

        // Filter by selected row indices if provided
        let selectedRows = valid;
        if (rowIndicesStr) {
            try {
                const indices: number[] = JSON.parse(rowIndicesStr);
                const indexSet = new Set(indices);
                selectedRows = valid.filter((_, i) => indexSet.has(i));
            } catch {
                // Invalid JSON — use all valid rows
            }
        }

        if (selectedRows.length === 0) {
            return NextResponse.json({ error: "Không có dòng nào được chọn.", uploaded: 0 });
        }

        const client = getBqClient();

        if (mode === "overwrite") {
            // True overwrite: DELETE old records by composite key, then INSERT new
            const DATETIME_COLS = new Set(["ngay_vao", "ngay_ra"]);
            let deletedCount = 0;

            for (const row of selectedRows) {
                const conditions: string[] = [];
                for (const col of ROW_KEY_COLS) {
                    const val = row[col];
                    if (val === null || val === undefined) {
                        conditions.push(`${col} IS NULL`);
                    } else if (typeof val === "number") {
                        conditions.push(`${col} = ${val}`);
                    } else if (DATETIME_COLS.has(col)) {
                        const safeVal = String(val).replace(/'/g, "\\'");
                        conditions.push(`${col} = DATETIME('${safeVal}')`);
                    } else {
                        const safeVal = String(val).replace(/'/g, "\\'");
                        conditions.push(`${col} = '${safeVal}'`);
                    }
                }
                const whereClause = conditions.join(" AND ");
                try {
                    const deleteQ = `DELETE FROM \`${FULL_TABLE_ID}\` WHERE ${whereClause}`;
                    const [job] = await client.createQueryJob({ query: deleteQ });
                    await job.getQueryResults();
                    const affected = Number(job.metadata?.statistics?.query?.numDmlAffectedRows) || 0;
                    deletedCount += affected;
                } catch (e: unknown) {
                    console.error("[OVERWRITE-DELETE]", e instanceof Error ? e.message : e);
                }
            }
            console.log(`[OVERWRITE] Deleted ${deletedCount} old records`);

            // Then insert all selected rows (fresh)
            const uploaded = await uploadToBigQuery(client, selectedRows);
            return NextResponse.json({ uploaded, deleted: deletedCount, mode: "overwrite" });
        } else {
            // mode="new": Filter out duplicates, upload only new
            const dupIndices = await getDuplicateIndices(client, selectedRows);
            const newRows = selectedRows.filter((_, i) => !dupIndices.has(i));

            if (newRows.length === 0) {
                return NextResponse.json({
                    uploaded: 0,
                    message: "Tất cả dòng đã tồn tại trên BigQuery.",
                });
            }

            const uploaded = await uploadToBigQuery(client, newRows);
            return NextResponse.json({ uploaded, mode: "new" });
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════════ */

interface SheetInfo {
    sheetName: string;
    matchedCols: string[];
    extraCols: string[];
}

function detectCompatibleSheets(workbook: XLSX.WorkBook): SheetInfo[] {
    const compatible: SheetInfo[] = [];

    for (const sheetName of workbook.SheetNames) {
        try {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            // Read only headers (first row)
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

type Row = Record<string, unknown>;

function transformRows(rows: Row[], sourceFileName: string): Row[] {
    const now = new Date().toISOString();

    return rows.map((row) => {
        const r: Row = {};

        // Normalize column names
        for (const [key, val] of Object.entries(row)) {
            r[key.toLowerCase().trim()] = val;
        }

        // Parse date integers (ngay_sinh, gt_the_tu, gt_the_den)
        for (const col of ["ngay_sinh", "gt_the_tu", "gt_the_den"]) {
            if (r[col] != null) {
                r[col] = parseDateInt(r[col]);
            }
        }

        // Parse datetime strings (ngay_vao, ngay_ra)
        for (const col of ["ngay_vao", "ngay_ra"]) {
            if (r[col] != null) {
                r[col] = parseDatetimeStr(r[col]);
            }
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
                if (r[col] === "nan" || r[col] === "undefined") {
                    r[col] = null;
                }
            } else {
                r[col] = null;
            }
        }

        // Helper to parse messy numbers (e.g., "2,027" or " 1,500.5 ")
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

        // Metadata
        r["upload_timestamp"] = now;
        r["source_file"] = sourceFileName;

        return r;
    });
}

function parseDateInt(val: unknown): string | null {
    if (val == null) return null;
    try {
        const raw = String(val).trim();

        // Already ISO format: "YYYY-MM-DD" → pass through
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        // Integer format: 19770902 → "1977-09-02"
        const s = String(Math.round(Number(raw)));
        if (s.length === 8) {
            const y = s.slice(0, 4);
            const m = s.slice(4, 6);
            const d = s.slice(6, 8);
            return `${y}-${m}-${d}`;
        }

        // Excel serial date number (e.g. 44927)
        if (!isNaN(Number(raw)) && Number(raw) > 10000 && Number(raw) < 100000) {
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + Number(raw) * 86400000);
            const yy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, "0");
            const dd = String(date.getDate()).padStart(2, "0");
            return `${yy}-${mm}-${dd}`;
        }

        return null;
    } catch {
        return null;
    }
}

function parseDatetimeStr(val: unknown): string | null {
    if (val == null) return null;
    try {
        const s = String(val).trim().replace(/^'/, "");

        // Already ISO datetime: "2026-01-02T07:35:00" → pass through
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s;

        // Already ISO date only: "2026-01-02" → append time
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00`;

        if (s.length === 12) {
            // YYYYMMDDHHmm
            return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00`;
        } else if (s.length === 14) {
            // YYYYMMDDHHmmss
            return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
        } else if (s.length === 8) {
            // YYYYMMDD
            return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`;
        }
        // Try parsing as JS Date
        const d = new Date(val as string);
        if (!isNaN(d.getTime())) {
            return d.toISOString().replace("Z", "");
        }
        return null;
    } catch {
        return null;
    }
}

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

            // Check null/empty
            if (val == null || val === "" || val === "nan") {
                issueMap.set(col, (issueMap.get(col) || 0) + 1);
                isValid = false;
                continue;
            }

            // Column-specific checks
            if (col === "gioi_tinh") {
                const num = Number(val);
                if (![1, 2].includes(num)) {
                    issueMap.set(col, (issueMap.get(col) || 0) + 1);
                    isValid = false;
                }
            } else if (col === "thang_qt") {
                const num = Number(val);
                if (isNaN(num) || num < 1 || num > 12) {
                    issueMap.set(col, (issueMap.get(col) || 0) + 1);
                    isValid = false;
                }
            } else if (col === "t_tongchi" || col === "t_bhtt") {
                if (isNaN(Number(val))) {
                    issueMap.set(col, (issueMap.get(col) || 0) + 1);
                    isValid = false;
                }
            }
        }

        if (isValid) {
            valid.push(row);
        } else {
            invalid.push(row);
        }
    }

    const issues = Array.from(issueMap.entries()).map(([col, count]) => ({
        col,
        count,
    }));

    return { valid, invalid, issues };
}

function buildSummary(
    rows: Row[]
): { period: string; maCSKCB: string; rows: number; tongChi: string }[] {
    const groups = new Map<
        string,
        { rows: number; tongChi: number }
    >();

    for (const r of rows) {
        const key = `${r.nam_qt || "?"}/${String(r.thang_qt || "?").padStart(2, "0")}|${r.ma_cskcb || "?"}`;
        const existing = groups.get(key) || { rows: 0, tongChi: 0 };
        existing.rows += 1;
        existing.tongChi += Number(r.t_tongchi) || 0;
        groups.set(key, existing);
    }

    return Array.from(groups.entries())
        .sort()
        .map(([key, val]) => {
            const [period, maCSKCB] = key.split("|");
            return {
                period,
                maCSKCB,
                rows: val.rows,
                tongChi: val.tongChi.toLocaleString("vi-VN", {
                    maximumFractionDigits: 0,
                }),
            };
        });
}

/**
 * Unwrap BigQuery value objects into plain strings for comparison.
 * BQ returns datetime/timestamp fields as `{ value: "2026-01-02T07:35:00" }`.
 * Without unwrapping, String({value:...}) becomes "[object Object]".
 */
function bqScalar(val: unknown): string {
    if (val == null) return "";
    if (typeof val === "object" && val !== null && "value" in (val as Record<string, unknown>)) {
        return String((val as Record<string, unknown>).value ?? "");
    }
    return String(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkDuplicateCount(client: any, rows: Row[]): Promise<number> {
    const maBnList = [
        ...new Set(
            rows
                .map((r) => r.ma_bn)
                .filter(Boolean)
                .map(String)
        ),
    ];
    if (maBnList.length === 0) return 0;

    const keyCols = ROW_KEY_COLS.join(", ");
    const BATCH_SIZE = 5000;
    let totalDups = 0;

    for (let i = 0; i < maBnList.length; i += BATCH_SIZE) {
        const batch = maBnList.slice(i, i + BATCH_SIZE);
        const inList = batch.map((m) => `'${m.replace(/'/g, "\\'")}'`).join(", ");
        const query = `SELECT ${keyCols} FROM \`${FULL_TABLE_ID}\` WHERE ma_bn IN (${inList})`;

        try {
            const [job] = await client.createQueryJob({ query });
            const [bqRows] = await job.getQueryResults();

            if (bqRows.length === 0) continue;

            // Build set of BQ key tuples
            const bqKeys = new Set(
                bqRows.map((bqRow: Row) =>
                    ROW_KEY_COLS.map((c) => bqScalar(bqRow[c])).join("|")
                )
            );

            // Check rows against BQ keys
            for (const row of rows) {
                const rowKey = ROW_KEY_COLS.map((c) =>
                    bqScalar(row[c])
                ).join("|");
                if (bqKeys.has(rowKey)) {
                    totalDups++;
                }
            }
        } catch {
            // Skip batch errors
        }
    }

    return totalDups;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDuplicateIndices(client: any, rows: Row[]): Promise<Set<number>> {
    const dupIndices = new Set<number>();
    const maBnList = [
        ...new Set(
            rows.map((r) => r.ma_bn).filter(Boolean).map(String)
        ),
    ];
    if (maBnList.length === 0) return dupIndices;

    const keyCols = ROW_KEY_COLS.join(", ");
    const BATCH_SIZE = 5000;

    for (let i = 0; i < maBnList.length; i += BATCH_SIZE) {
        const batch = maBnList.slice(i, i + BATCH_SIZE);
        const inList = batch.map((m) => `'${m.replace(/'/g, "\\'")}'`).join(", ");
        const query = `SELECT ${keyCols} FROM \`${FULL_TABLE_ID}\` WHERE ma_bn IN (${inList})`;

        try {
            const [job] = await client.createQueryJob({ query });
            const [bqRows] = await job.getQueryResults();
            if (bqRows.length === 0) continue;

            const bqKeys = new Set(
                bqRows.map((bqRow: Row) =>
                    ROW_KEY_COLS.map((c) => bqScalar(bqRow[c])).join("|")
                )
            );

            rows.forEach((row, idx) => {
                const rowKey = ROW_KEY_COLS.map((c) =>
                    bqScalar(row[c])
                ).join("|");
                if (bqKeys.has(rowKey)) {
                    dupIndices.add(idx);
                }
            });
        } catch {
            // Skip batch errors
        }
    }

    return dupIndices;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkLookupCodes(client: any, rows: Row[]): Promise<string[]> {
    const warnings: string[] = [];

    // Check ma_cskcb
    try {
        const cskcbTable = getFullTableId(LOOKUP_CSKCB_TABLE);
        const query = `SELECT DISTINCT CAST(ma_cskcb AS STRING) AS ma_cskcb FROM \`${cskcbTable}\``;
        const [job] = await client.createQueryJob({ query });
        const [bqRows] = await job.getQueryResults();
        const knownCskcb = new Set(bqRows.map((r: Row) => String(r.ma_cskcb)));

        const uploadCskcb = new Set(
            rows.map((r) => String(r.ma_cskcb)).filter(Boolean)
        );
        const missing = [...uploadCskcb].filter((c) => !knownCskcb.has(c));
        if (missing.length > 0) {
            warnings.push(
                `Mã CSKCB chưa có trong danh mục: ${missing.sort().join(", ")}`
            );
        }
    } catch {
        // Skip
    }

    // Check ma_loaikcb
    try {
        const loaikcbTable = getFullTableId(LOOKUP_LOAIKCB_TABLE);
        const query = `SELECT DISTINCT ma_loaikcb FROM \`${loaikcbTable}\``;
        const [job] = await client.createQueryJob({ query });
        const [bqRows] = await job.getQueryResults();
        const knownLoaikcb = new Set(
            bqRows.map((r: Row) => Number(r.ma_loaikcb))
        );

        const uploadLoaikcb = new Set(
            rows
                .map((r) => Number(r.ma_loaikcb))
                .filter((n) => !isNaN(n))
        );
        const missing = [...uploadLoaikcb].filter(
            (c) => !knownLoaikcb.has(c)
        );
        if (missing.length > 0) {
            warnings.push(
                `Mã loại KCB chưa có trong danh mục: ${missing.sort().join(", ")}`
            );
        }
    } catch {
        // Skip
    }

    return warnings;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadToBigQuery(client: any, rows: Row[]): Promise<number> {
    // Keep only schema columns + metadata
    const allowedCols = [
        ...SCHEMA_COLS,
        "upload_timestamp",
        "source_file",
    ];
    const allowedSet = new Set(allowedCols);

    const cleanRows = rows.map((row) => {
        const r: Row = {};
        for (const [key, val] of Object.entries(row)) {
            if (allowedSet.has(key)) {
                r[key] = val;
            }
        }
        return r;
    });

    // Use DML INSERT (not streaming insert) to avoid streaming buffer issues
    // Streaming inserts block DELETE/UPDATE for 30-90 minutes
    const BATCH = 200; // Smaller batches for DML to avoid query size limits
    let uploaded = 0;

    for (let i = 0; i < cleanRows.length; i += BATCH) {
        const batch = cleanRows.slice(i, i + BATCH);

        // Build VALUES clause
        const valueRows = batch.map((row) => {
            const vals = allowedCols.map((col) => {
                const v = row[col];
                if (v === null || v === undefined) return "NULL";
                if (typeof v === "number") return String(v);
                // Escape single quotes in strings
                const s = String(v).replace(/'/g, "\\'");
                return `'${s}'`;
            });
            return `(${vals.join(", ")})`;
        });

        const colList = allowedCols.join(", ");
        const query = `INSERT INTO \`${FULL_TABLE_ID}\` (${colList}) VALUES ${valueRows.join(",\n")}`;

        try {
            const [job] = await client.createQueryJob({ query });
            await job.getQueryResults();
            uploaded += batch.length;
        } catch (err: unknown) {
            console.error("[UPLOAD] DML INSERT error:", err instanceof Error ? err.message : err);
            // Continue with next batch
        }
    }

    return uploaded;
}
