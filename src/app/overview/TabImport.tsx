"use client";
import { Loader2, Trash2 } from "lucide-react";

import React, { useState, useRef, useMemo, useEffect, useCallback, Fragment } from "react";
import SectionTitle from "@/components/ui/SectionTitle";
import InfoBanner from "@/components/ui/InfoBanner";
import DataTable, { Column } from "@/components/ui/DataTable";
import { SCHEMA_COLS, ROW_KEY_COLS } from "@/lib/schema";
import { readExcelFile, detectCompatibleSheets, extractSheetRows, processSheet, type Row } from "@/lib/excelParser";

/* ── Types ── */

interface SheetData {
    sheetName: string;
    matchedCols: number;
    validRows: Record<string, unknown>[];
    invalidCount: number;
    dupCount: number;
    newCount: number;
    issues: { col: string; count: number; reason: string; samples: string[] }[];
    summary: { period: string; maCSKCB: string; rows: number; tongChi: string }[];
}

type TabFilter = "summary" | "valid" | "duplicate" | "normalize";

interface SubBreakdown {
    label: string;
    count: number;
    cost: number;
}

interface NormalizeComparison {
    ma_cskcb: string;
    ten_cskcb: string;
    thang_qt: number;
    nam_qt: number;
    bqCount: number;
    excelCount: number;
    dupCount: number;
    bqOnlyCount: number;
    excelOnlyCount: number;
    diff: number;
    bqCost: number;
    excelCost: number;
    bqSubs: SubBreakdown[];
    excelSubs: SubBreakdown[];
    bqNormalized: number;
    bqRaw: number;
}

interface NormalizeResult {
    ma_cskcb: string;
    thang_qt: number;
    nam_qt: number;
    deleted: number;
    inserted: number;
}

interface ProgressState {
    current: number;
    total: number;
    step?: string;
}

/* ── Column config ── */

/** Human-readable labels for BQ columns */
const COL_LABELS: Record<string, string> = {
    stt: "STT", ma_bn: "Mã BN", ho_ten: "Họ tên", ngay_sinh: "Ngày sinh",
    gioi_tinh: "Giới tính", dia_chi: "Địa chỉ", ma_the: "Mã thẻ",
    ma_dkbd: "Mã ĐKBD", gt_the_tu: "GT thẻ từ", gt_the_den: "GT thẻ đến",
    ma_benh: "Mã bệnh", ma_benhkhac: "Mã bệnh khác",
    ma_lydo_vvien: "Lý do VV", ma_noi_chuyen: "Nơi chuyển",
    ngay_vao: "Ngày vào", ngay_ra: "Ngày ra", so_ngay_dtri: "Số ngày ĐT",
    ket_qua_dtri: "Kết quả ĐT", tinh_trang_rv: "Tình trạng RV",
    t_tongchi: "Tổng chi", t_xn: "Xét nghiệm", t_cdha: "CĐHA",
    t_thuoc: "Thuốc", t_mau: "Máu", t_pttt: "PTTT", t_vtyt: "VTYT",
    t_dvkt_tyle: "DVKT tỷ lệ", t_thuoc_tyle: "Thuốc tỷ lệ",
    t_vtyt_tyle: "VTYT tỷ lệ", t_kham: "Khám", t_giuong: "Giường",
    t_vchuyen: "Vận chuyển", t_bntt: "BN thanh toán", t_bhtt: "BH thanh toán",
    t_ngoaids: "Ngoài DS", ma_khoa: "Mã khoa", nam_qt: "Năm QT",
    thang_qt: "Tháng QT", ma_khuvuc: "Mã khu vực", ma_loaikcb: "Loại KCB",
    ma_cskcb: "Mã CSKCB", noi_ttoan: "Nơi thanh toán", giam_dinh: "Giám định",
    t_xuattoan: "Xuất toán", t_nguonkhac: "Nguồn khác",
    t_datuyen: "Đa tuyến", t_vuottran: "Vượt trần",
    _status: "Trạng thái", is_normalized: "Chuẩn hóa",
};

/** Money / amount columns → align right */
const RIGHT_ALIGN_COLS = new Set([
    "t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau", "t_pttt", "t_vtyt",
    "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle", "t_kham", "t_giuong",
    "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids", "t_xuattoan", "t_nguonkhac",
    "t_datuyen", "t_vuottran", "so_ngay_dtri",
]);

/** Center-aligned columns */
const CENTER_ALIGN_COLS = new Set([
    "stt", "ngay_sinh", "gioi_tinh", "ngay_vao", "ngay_ra", "ma_cskcb",
    "ma_dkbd", "ma_khoa", "ma_loaikcb", "ma_khuvuc", "nam_qt", "thang_qt",
    "ket_qua_dtri", "tinh_trang_rv", "ma_lydo_vvien", "noi_ttoan",
    "giam_dinh", "_status",
]);

/** Build full column list from schema + status column */
const ALL_COLS: Column[] = [
    ...SCHEMA_COLS.map((key) => ({
        key,
        label: COL_LABELS[key] || key,
        align: (RIGHT_ALIGN_COLS.has(key) ? "right" : CENTER_ALIGN_COLS.has(key) ? "center" : "left") as "left" | "center" | "right",
        ...(key === "stt" ? { width: 60 } : {}),
        ...(key === "gioi_tinh" ? { width: 40 } : {}),
    })),
    { key: "_status", label: "Trạng thái", align: "center", width: 80 },
    {
        key: "is_normalized", label: "Chuẩn hóa", align: "center", width: 70, render: (val) => {
            const v = val === true || val === "true" || val === 1 || val === "1";
            return v ? <span className="text-green-600 font-bold">x</span> : "";
        }
    },
];

/** Columns always visible and non-toggleable */
const PINNED_KEYS = new Set(["stt", "_status"]);

/** Default visible columns (compact view) */
const DEFAULT_VISIBLE_KEYS = new Set([
    "stt", "ma_bn", "ho_ten", "ngay_sinh", "gioi_tinh", "ma_cskcb",
    "ngay_vao", "ngay_ra", "t_tongchi", "t_bhtt", "_status", "is_normalized",
]);

/* ── Lookup types ── */

interface LoaiKCBEntry {
    ma_loaikcb: number;
    ml2: string;
}

interface CskcbEntry {
    ma_cskcb: string;
    ten_cskcb: string;
}

interface KhoaEntry {
    makhoa_xml: string;
    full_name: string;
}

interface CskcbInfo {
    ma: string;
    ten: string;
}

interface SectionPivot {
    pivotRows: Record<string, number | string>[];
    grandNgoai: number;
    grandNoi: number;
}

interface PivotSummary {
    ngoaiCskcb: CskcbInfo[];
    noiCskcb: CskcbInfo[];
    sections: { label: string; data: SectionPivot }[];
    total: SectionPivot;
}

export default function TabImport() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sheets, setSheets] = useState<SheetData[]>([]);
    const [selectedSheet, setSelectedSheet] = useState("");
    const [selectedTab, setSelectedTab] = useState<TabFilter>("valid");
    const [sheetUpdating, setSheetUpdating] = useState(false);
    const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set());
    const [removedRows, setRemovedRows] = useState<Set<number>>(new Set());
    const [searchKeyword, setSearchKeyword] = useState("");
    // Per sheet+tab upload messages: key = "sheetName:valid" or "sheetName:duplicate"
    const [uploadMsgs, setUploadMsgs] = useState<Map<string, string>>(new Map());
    // Tracks rows that have been successfully uploaded/overwritten (by original index)
    const [doneRows, setDoneRows] = useState<Set<number>>(new Set());

    // ── Normalize tab state ──
    const [normalizeData, setNormalizeData] = useState<NormalizeComparison[]>([]);
    const [normalizeChecked, setNormalizeChecked] = useState<Set<string>>(new Set());
    const [normalizeLoading, setNormalizeLoading] = useState(false);
    const [normalizeResults, setNormalizeResults] = useState<NormalizeResult[] | null>(null);
    const [normalizeError, setNormalizeError] = useState<string | null>(null);
    const [showNormalizeConfirm, setShowNormalizeConfirm] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const normalizeCompared = useRef(false);

    // Progress tracking
    const [uploadProgress, setUploadProgress] = useState<ProgressState | null>(null);
    const [normalizeProgress, setNormalizeProgress] = useState<ProgressState | null>(null);

    // Lookup tables for pivot summary
    const [loaiKCBMap, setLoaiKCBMap] = useState<Map<number, string>>(new Map());
    const [cskcbMap, setCskcbMap] = useState<Map<string, string>>(new Map());
    const [khoaMap, setKhoaMap] = useState<Map<string, string>>(new Map());
    const [doneMode, setDoneMode] = useState<Record<number, "new" | "overwrite">>({});
    // Per-sheet state caches (survive sheet switches)
    const sheetDoneRows = useRef<Map<string, Set<number>>>(new Map());
    const sheetDoneMode = useRef<Map<string, Record<number, "new" | "overwrite">>>(new Map());
    const sheetCheckedRows = useRef<Map<string, Set<number>>>(new Map());
    const sheetRemovedRows = useRef<Map<string, Set<number>>>(new Map());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const colMenuRef = useRef<HTMLDivElement>(null);
    // Cache parsed Excel rows per sheet (avoid re-reading file on upload)
    const parsedSheetRows = useRef<Map<string, Row[]>>(new Map());
    const LS_KEY = "import_visible_cols";
    const [colMode, setColMode] = useState<"all" | "custom">("custom");
    const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem(LS_KEY);
                if (saved) return new Set(JSON.parse(saved) as string[]);
            } catch { /* ignore */ }
        }
        return new Set(DEFAULT_VISIBLE_KEYS);
    });
    const [showColMenu, setShowColMenu] = useState(false);

    // Close column menu on outside click
    useEffect(() => {
        if (!showColMenu) return;
        const handler = (e: MouseEvent) => {
            if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
                setShowColMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showColMenu]);

    // Fetch lookup tables on mount
    useEffect(() => {
        Promise.all([
            fetch("/api/bq/lookup?table=lookup_loaikcb").then((r) => r.json()),
            fetch("/api/bq/lookup?table=lookup_cskcb").then((r) => r.json()),
            fetch("/api/bq/lookup?table=lookup_khoa").then((r) => r.json()),
        ]).then(([loaiRes, cskcbRes, khoaRes]) => {
            if (loaiRes.rows) {
                const map = new Map<number, string>();
                (loaiRes.rows as LoaiKCBEntry[]).forEach((r) => map.set(Number(r.ma_loaikcb), r.ml2));
                setLoaiKCBMap(map);
            }
            if (cskcbRes.rows) {
                const map = new Map<string, string>();
                (cskcbRes.rows as CskcbEntry[]).forEach((r) => map.set(String(r.ma_cskcb), r.ten_cskcb));
                setCskcbMap(map);
            }
            if (khoaRes.rows) {
                const map = new Map<string, string>();
                (khoaRes.rows as KhoaEntry[]).forEach((r) => map.set(String(r.makhoa_xml), r.full_name));
                setKhoaMap(map);
            }
        }).catch(() => { /* ignore lookup errors */ });
    }, []);

    const toggleCol = useCallback((key: string) => {
        setVisibleCols((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            // Auto-save and switch to custom mode on individual toggle
            try { localStorage.setItem(LS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
            return next;
        });
        setColMode("custom");
    }, []);

    /* ── Build pivot summary from rows (3 sections: hợp lệ, trùng, tổng) ── */
    const buildPivotSummary = useCallback((allRows: Row[]): PivotSummary | null => {
        if (allRows.length === 0) return null;

        // Classify ALL rows to discover all facilities
        const classifyRow = (row: Row) => {
            const ml = Number(row.ma_loaikcb);
            return loaiKCBMap.get(ml) || (ml === 1 ? "Nội trú" : "Ngoại trú");
        };

        // Get unique CSKCB facilities from ALL rows
        const getUniqueCskcb = (rowSet: Row[]): CskcbInfo[] => {
            const map = new Map<string, string>();
            for (const r of rowSet) {
                const ma = String(r.ma_cskcb || "");
                if (ma && !map.has(ma)) {
                    map.set(ma, cskcbMap.get(ma) || ma);
                }
            }
            return Array.from(map.entries())
                .map(([ma, ten]) => ({ ma, ten }))
                .sort((a, b) => a.ma.localeCompare(b.ma));
        };

        const allNgoai = allRows.filter((r) => classifyRow(r) === "Ngoại trú");
        const allNoi = allRows.filter((r) => classifyRow(r) === "Nội trú");
        const ngoaiCskcb = getUniqueCskcb(allNgoai);
        const noiCskcb = getUniqueCskcb(allNoi);

        // Get unique periods as "M/YYYY" strings
        const periodKeys = [...new Set(allRows.map((r) => {
            const t = Number(r.thang_qt) || 0;
            const n = Number(r.nam_qt) || 0;
            return t > 0 && n > 0 ? `${t}/${n}` : "";
        }))].filter(Boolean).sort((a, b) => {
            const [am, ay] = a.split("/").map(Number);
            const [bm, by] = b.split("/").map(Number);
            return ay !== by ? ay - by : am - bm;
        });

        // Build section pivot from a subset of rows
        const buildSection = (rows: Row[]): SectionPivot => {
            const ngoai = rows.filter((r) => classifyRow(r) === "Ngoại trú");
            const noi = rows.filter((r) => classifyRow(r) === "Nội trú");
            const pivotRows: Record<string, number | string>[] = [];
            let grandNgoai = 0, grandNoi = 0;

            for (const pk of periodKeys) {
                const [thang, nam] = pk.split("/").map(Number);
                const row: Record<string, number | string> = { thang: pk };

                let tongNgoai = 0;
                for (const cskcb of ngoaiCskcb) {
                    const count = ngoai.filter(
                        (r) => Number(r.thang_qt) === thang && Number(r.nam_qt) === nam && String(r.ma_cskcb) === cskcb.ma
                    ).length;
                    row[`ngoai_${cskcb.ma}`] = count;
                    tongNgoai += count;
                }
                row["ngoai_tong"] = tongNgoai;
                grandNgoai += tongNgoai;

                let tongNoi = 0;
                for (const cskcb of noiCskcb) {
                    const count = noi.filter(
                        (r) => Number(r.thang_qt) === thang && Number(r.nam_qt) === nam && String(r.ma_cskcb) === cskcb.ma
                    ).length;
                    row[`noi_${cskcb.ma}`] = count;
                    tongNoi += count;
                }
                row["noi_tong"] = tongNoi;
                grandNoi += tongNoi;

                row["tong_cong"] = tongNgoai + tongNoi;
                pivotRows.push(row);
            }
            return { pivotRows, grandNgoai, grandNoi };
        };

        const validRows = allRows.filter((r) => !r._isDuplicate);
        const dupRows = allRows.filter((r) => r._isDuplicate);

        const sections: { label: string; data: SectionPivot }[] = [
            { label: "BỆNH NHÂN MỚI", data: buildSection(validRows) },
            { label: "BỆNH NHÂN TRÙNG LẶP", data: buildSection(dupRows) },
        ];
        const total = buildSection(allRows);

        return { ngoaiCskcb, noiCskcb, sections, total };
    }, [loaiKCBMap, cskcbMap]);

    /* ── File handling ── */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setSheets([]);
            setUploadMsgs(new Map());
            setError(null);
            setCheckedRows(new Set());
            setRemovedRows(new Set());
            setDoneRows(new Set());
            setDoneMode({});
            // Clear per-sheet caches
            sheetDoneRows.current.clear();
            sheetDoneMode.current.clear();
            sheetCheckedRows.current.clear();
            sheetRemovedRows.current.clear();
            parsedSheetRows.current.clear();
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
            setFile(f);
            setSheets([]);
            setUploadMsgs(new Map());
            setError(null);
            setCheckedRows(new Set());
            setRemovedRows(new Set());
            setDoneRows(new Set());
            setDoneMode({});
            // Clear per-sheet caches
            sheetDoneRows.current.clear();
            sheetDoneMode.current.clear();
            sheetCheckedRows.current.clear();
            sheetRemovedRows.current.clear();
            parsedSheetRows.current.clear();
        }
    };

    /* ── Validate (POST) ── */
    const handleValidate = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        setSheets([]);

        try {
            // ── ALL processing on client (avoids Vercel 4.5 MB body limit) ──
            const workbook = await readExcelFile(file);
            const compatible = detectCompatibleSheets(workbook);
            if (compatible.length === 0) {
                throw new Error("Không tìm thấy sheet nào có đủ 14 cột bắt buộc.");
            }

            // Process each sheet client-side (transform, validate, summary)
            const processedSheets = compatible.map((s) => {
                const rawRows = extractSheetRows(workbook, s.sheetName, s.headerRowIndex);
                const processed = processSheet(
                    s.sheetName,
                    rawRows,
                    file.name,
                    s.matchedCols.length
                );
                // Cache transformed valid rows for later upload
                parsedSheetRows.current.set(s.sheetName, processed.validRows);
                return processed;
            });

            // POST only key columns for duplicate check (tiny payload: 5 cols × N rows)
            const allSheets: SheetData[] = [];
            for (const ps of processedSheets) {
                const keys = ps.validRows.map((row) => {
                    const k: Record<string, unknown> = {};
                    for (const col of ROW_KEY_COLS) k[col] = row[col] ?? null;
                    return k;
                });

                let dupIndices = new Set<number>();
                let normalizedStatus: Record<number, boolean> = {};
                try {
                    const res = await fetch("/api/bq/overview/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ keys }),
                    });
                    const d = await res.json();
                    if (d.error) throw new Error(d.error);
                    dupIndices = new Set<number>(d.duplicateIndices || []);
                    normalizedStatus = d.normalizedStatus || {};
                } catch {
                    // BQ unreachable — treat all as new
                }

                // Add _isDuplicate and is_normalized flags to display rows
                const displayRows = ps.validRows.map((row, i) => ({
                    ...row,
                    _isDuplicate: dupIndices.has(i),
                    is_normalized: !!normalizedStatus[i],
                }));

                allSheets.push({
                    sheetName: ps.sheetName,
                    matchedCols: ps.matchedCols,
                    validRows: displayRows,
                    invalidCount: ps.invalidCount,
                    dupCount: dupIndices.size,
                    newCount: ps.validRows.length - dupIndices.size,
                    issues: ps.issues,
                    summary: ps.summary,
                });
            }

            setSheets(allSheets);
            if (allSheets.length > 0) {
                setSelectedSheet(allSheets[0].sheetName);
                setSelectedTab("summary");
                const firstSheet = allSheets[0];
                const validIndices = new Set<number>();
                firstSheet.validRows.forEach((row, i) => {
                    if (!row._isDuplicate) validIndices.add(i);
                });
                setCheckedRows(validIndices);
                setRemovedRows(new Set());
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    /* ── Upload (PUT) — sends rows in chunks to stay under 4.5 MB ── */
    const handleUpload = async (mode: "new" | "overwrite") => {
        if (!file || !currentSheet) return;
        setLoading(true);
        setError(null);

        // Collect checked row original indices, filter removed, filter by type
        const activeRows = currentSheet.validRows.filter(
            (row, i) => !removedRows.has(i) && checkedRows.has(i) &&
                (mode === "new" ? !row._isDuplicate : row._isDuplicate)
        );

        if (activeRows.length === 0) {
            setError(mode === "new"
                ? "Không có dòng mới nào được chọn."
                : "Không có dòng trùng nào được chọn để ghi đè.");
            setLoading(false);
            return;
        }

        // Get the full transformed rows from cache
        const cachedRows = parsedSheetRows.current.get(selectedSheet) || [];
        // Map selected display rows back to cached transformed rows by _idx
        const rowsToSend = activeRows.map((row) => {
            const idx = row._idx as number;
            return cachedRows[idx] || row;
        });

        try {
            // ── Chunk rows: ~1500 rows per request ≈ 2-3 MB per chunk ──
            const CHUNK_SIZE = 1500;
            let totalUploaded = 0;
            let totalDeleted = 0;
            setUploadProgress({ current: 0, total: rowsToSend.length });

            for (let i = 0; i < rowsToSend.length; i += CHUNK_SIZE) {
                const chunk = rowsToSend.slice(i, i + CHUNK_SIZE);
                const res = await fetch("/api/bq/overview/import", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rows: chunk, mode }),
                });
                const d = await res.json();
                if (d.error) throw new Error(d.error);
                totalUploaded += d.uploaded || 0;
                totalDeleted += d.deleted || 0;
                setUploadProgress({ current: totalUploaded, total: rowsToSend.length });
            }

            // Mark uploaded rows as done
            const doneIndices = currentSheet.validRows
                .map((row, i) => ({ row, i }))
                .filter(({ i }) => !removedRows.has(i) && checkedRows.has(i) &&
                    (mode === "new" ? !currentSheet.validRows[i]._isDuplicate : currentSheet.validRows[i]._isDuplicate))
                .map(({ i }) => i);

            setDoneRows((prev) => {
                const next = new Set(prev);
                doneIndices.forEach((i) => next.add(i));
                return next;
            });
            setDoneMode((prev) => {
                const next = { ...prev };
                doneIndices.forEach((i) => { next[i] = mode; });
                return next;
            });
            setCheckedRows((prev) => {
                const next = new Set(prev);
                doneIndices.forEach((i) => next.delete(i));
                return next;
            });

            const msgKey = `${selectedSheet}:${selectedTab}`;
            if (mode === "overwrite") {
                setUploadMsgs((prev) => new Map(prev).set(msgKey, `✅ Đã ghi đè ${totalUploaded.toLocaleString()} dòng (xóa ${totalDeleted.toLocaleString()} bản ghi cũ).`));
            } else {
                setUploadMsgs((prev) => new Map(prev).set(msgKey, `✅ Đã tải lên ${totalUploaded.toLocaleString()} dòng mới thành công!`));
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    /* ── Delete selected rows (local only — scoped to current tab) ── */
    const handleLocalDelete = () => {
        const currentTabOrigIndices = new Set(
            filteredRows.map((r) => r._displayIdx as number)
        );
        setRemovedRows((prev) => {
            const next = new Set(prev);
            checkedRows.forEach((i) => {
                if (currentTabOrigIndices.has(i)) next.add(i);
            });
            return next;
        });
        // Only uncheck rows in current tab
        setCheckedRows((prev) => {
            const next = new Set(prev);
            currentTabOrigIndices.forEach((i) => next.delete(i));
            return next;
        });
    };

    /* ── Switch sheet ── */
    const handleSheetChange = (name: string) => {
        // Save current sheet state before switching
        if (selectedSheet) {
            sheetDoneRows.current.set(selectedSheet, new Set(doneRows));
            sheetDoneMode.current.set(selectedSheet, { ...doneMode });
            sheetCheckedRows.current.set(selectedSheet, new Set(checkedRows));
            sheetRemovedRows.current.set(selectedSheet, new Set(removedRows));
        }

        setSelectedSheet(name);
        // Keep current selectedTab — don't reset to "summary"
        setSearchKeyword("");
        // Reset normalize state so it re-fetches for the new sheet
        setNormalizeData([]);
        setNormalizeChecked(new Set());
        setNormalizeResults(null);
        setNormalizeError(null);
        setExpandedGroups(new Set());
        normalizeCompared.current = false;
        // Flash updating indicator on tabs
        setSheetUpdating(true);
        setTimeout(() => setSheetUpdating(false), 600);
        // uploadMsgs intentionally NOT cleared on sheet switch — persists per sheet+tab

        // Restore saved state for target sheet, or initialize defaults
        const savedDone = sheetDoneRows.current.get(name);
        const savedMode = sheetDoneMode.current.get(name);
        const savedChecked = sheetCheckedRows.current.get(name);
        const savedRemoved = sheetRemovedRows.current.get(name);

        if (savedDone && savedDone.size > 0) {
            // Restore previously saved state
            setDoneRows(savedDone);
            setDoneMode(savedMode || {});
            setCheckedRows(savedChecked || new Set());
            setRemovedRows(savedRemoved || new Set());
        } else {
            // First visit — auto-check all valid (non-duplicate) rows
            setDoneRows(new Set());
            setDoneMode({});
            setRemovedRows(new Set());
            const sheet = sheets.find((s) => s.sheetName === name);
            if (sheet) {
                const validIndices = new Set<number>();
                sheet.validRows.forEach((row, i) => {
                    if (!row._isDuplicate) validIndices.add(i);
                });
                setCheckedRows(validIndices);
            } else {
                setCheckedRows(new Set());
            }
        }
    };

    /* ── Derived data ── */
    const currentSheet = sheets.find((s) => s.sheetName === selectedSheet);

    const filteredRows = useMemo(() => {
        if (!currentSheet) return [];
        let rows: Record<string, unknown>[] = currentSheet.validRows
            .map((row, originalIdx) => ({ ...row, _displayIdx: originalIdx }))
            .filter((_, i) => !removedRows.has(i));

        // Tab filter
        if (selectedTab === "valid") {
            rows = rows.filter((r) => !r._isDuplicate);
        } else {
            rows = rows.filter((r) => r._isDuplicate);
        }

        // Search filter
        if (searchKeyword.trim()) {
            const kw = searchKeyword.toLowerCase();
            rows = rows.filter((r) =>
                Object.entries(r).some(
                    ([k, v]) =>
                        !k.startsWith("_") &&
                        String(v ?? "")
                            .toLowerCase()
                            .includes(kw)
                )
            );
        }

        // Add status badge based on done state
        return rows.map((r) => {
            const origIdx = r._displayIdx as number;
            let status = "Chưa tải lên";
            if (doneRows.has(origIdx)) {
                status = doneMode[origIdx] === "overwrite" ? "✅ Đã ghi đè" : "✅ Đã tải lên";
            }
            return { ...r, _status: status };
        });
    }, [currentSheet, removedRows, selectedTab, searchKeyword, doneRows, doneMode]) as Record<string, unknown>[];

    // Counts
    const validCount = currentSheet
        ? currentSheet.validRows.filter((_, i) => !removedRows.has(i) && !currentSheet.validRows[i]._isDuplicate).length
        : 0;
    const dupCount = currentSheet
        ? currentSheet.validRows.filter((_, i) => !removedRows.has(i) && currentSheet.validRows[i]._isDuplicate).length
        : 0;
    const checkedNewCount = currentSheet
        ? [...checkedRows].filter((i) => !removedRows.has(i) && !doneRows.has(i) && currentSheet.validRows[i] && !currentSheet.validRows[i]._isDuplicate).length
        : 0;
    const checkedDupCount = currentSheet
        ? [...checkedRows].filter((i) => !removedRows.has(i) && !doneRows.has(i) && currentSheet.validRows[i] && currentSheet.validRows[i]._isDuplicate).length
        : 0;

    // Map filtered row indices back to original for selection tracking
    const selectionAdapter = useMemo(() => {
        const displayToOriginal = new Map<number, number>();
        filteredRows.forEach((r, displayIdx) => {
            displayToOriginal.set(displayIdx, r._displayIdx as number);
        });
        return displayToOriginal;
    }, [filteredRows]);

    const displaySelectedRows = useMemo(() => {
        const set = new Set<number>();
        filteredRows.forEach((r, displayIdx) => {
            if (checkedRows.has(r._displayIdx as number)) set.add(displayIdx);
        });
        return set;
    }, [filteredRows, checkedRows]);

    // Disabled rows (already uploaded/overwritten) mapped to display indices
    const displayDisabledRows = useMemo(() => {
        const set = new Set<number>();
        filteredRows.forEach((r, displayIdx) => {
            if (doneRows.has(r._displayIdx as number)) set.add(displayIdx);
        });
        return set;
    }, [filteredRows, doneRows]);

    // Columns filtered by visibility setting
    const displayColumns = useMemo(
        () => ALL_COLS.filter((c) => PINNED_KEYS.has(c.key) || visibleCols.has(c.key)),
        [visibleCols]
    );

    // Count checked rows in current tab only (for delete button)
    const checkedInCurrentTab = useMemo(() => {
        const currentOrigIndices = new Set(filteredRows.map((r) => r._displayIdx as number));
        return [...checkedRows].filter((i) => currentOrigIndices.has(i) && !doneRows.has(i)).length;
    }, [filteredRows, checkedRows, doneRows]);

    // Validation warnings (computed once, used by tab badge + UI)
    const validationWarnings = useMemo(() => {
        if (!currentSheet) return [];
        const warnings: { type: "warn" | "error"; msg: string }[] = [];
        const allRows = currentSheet.validRows;
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;

        if (cskcbMap.size > 0) {
            const unknown = new Set<string>();
            for (const r of allRows) { const ma = String(r.ma_cskcb || "").trim(); if (ma && !cskcbMap.has(ma)) unknown.add(ma); }
            if (unknown.size > 0) warnings.push({ type: "warn", msg: `Mã CSKCB không có trong danh mục: ${[...unknown].join(", ")}` });
        }
        if (khoaMap.size > 0) {
            const unknown = new Set<string>();
            for (const r of allRows) { const ma = String(r.ma_khoa || "").trim(); if (ma && !khoaMap.has(ma)) unknown.add(ma); }
            if (unknown.size > 0) warnings.push({ type: "warn", msg: `Mã khoa không có trong danh mục: ${[...unknown].join(", ")}` });
        }
        if (loaiKCBMap.size > 0) {
            const unknown = new Set<string>();
            for (const r of allRows) { const ma = Number(r.ma_loaikcb); if (!isNaN(ma) && ma > 0 && !loaiKCBMap.has(ma)) unknown.add(String(ma)); }
            if (unknown.size > 0) warnings.push({ type: "warn", msg: `Mã loại KCB không có trong danh mục: ${[...unknown].join(", ")}` });
        }
        const futurePeriods = new Set<string>();
        for (const r of allRows) {
            const y = Number(r.nam_qt) || 0; const m = Number(r.thang_qt) || 0;
            if (y > 0 && m > 0 && (y > curYear || (y === curYear && m > curMonth))) futurePeriods.add(`${m}/${y}`);
        }
        if (futurePeriods.size > 0) warnings.push({ type: "error", msg: `Kỳ quyết toán vượt quá tháng hiện tại (${curMonth}/${curYear}): ${[...futurePeriods].join(", ")}` });
        return warnings;
    }, [currentSheet, cskcbMap, khoaMap, loaiKCBMap]);

    // Row className for done rows (green background)
    const getRowClassName = (displayIdx: number): string => {
        const origIdx = selectionAdapter.get(displayIdx);
        if (origIdx !== undefined && doneRows.has(origIdx)) return "row-done";
        // Green text for normalized rows
        const row = filteredRows[displayIdx];
        if (row) {
            const v = row.is_normalized;
            if (v === true || v === "true" || v === 1 || v === "1") return "text-blue-600";
        }
        return "";
    };

    const handleSelectionChange = (displayIndices: Set<number>) => {
        setCheckedRows((prev) => {
            const next = new Set(prev);
            // Uncheck all in current filtered view
            filteredRows.forEach((r) => {
                next.delete(r._displayIdx as number);
            });
            // Check selected ones
            displayIndices.forEach((di) => {
                const orig = selectionAdapter.get(di);
                if (orig !== undefined) next.add(orig);
            });
            return next;
        });
    };

    /* ── Normalize: compare ── */
    const handleNormalizeCompare = useCallback(async () => {
        if (!currentSheet || normalizeCompared.current) return;
        setNormalizeLoading(true);
        setNormalizeError(null);
        setNormalizeResults(null);

        try {
            const allRows = currentSheet.validRows;
            // Group rows by ma_cskcb + thang_qt + nam_qt
            const groupMap = new Map<string, { ma_cskcb: string; thang_qt: number; nam_qt: number; rows: Record<string, unknown>[]; keys: string[]; cost: number; subs: Map<string, { count: number; cost: number }> }>();
            for (const row of allRows) {
                const ma = String(row.ma_cskcb || "");
                const thang = Number(row.thang_qt) || 0;
                const nam = Number(row.nam_qt) || 0;
                if (!ma || !thang || !nam) continue;
                const gid = `${ma}|${thang}|${nam}`;
                if (!groupMap.has(gid)) {
                    groupMap.set(gid, { ma_cskcb: ma, thang_qt: thang, nam_qt: nam, rows: [], keys: [], cost: 0, subs: new Map() });
                }
                const g = groupMap.get(gid)!;
                g.rows.push(row);
                // Build composite key for duplicate detection
                const key = ["ma_cskcb", "ma_bn", "ma_loaikcb", "ngay_vao", "ngay_ra"]
                    .map((c) => String(row[c] ?? "")).join("|");
                g.keys.push(key);
                g.cost += Number(row.t_tongchi) || 0;
                // Track sub-breakdown by nội trú / ngoại trú
                const ml = Number(row.ma_loaikcb);
                const subLabel = loaiKCBMap.get(ml) || (ml === 1 ? "Nội trú" : "Ngoại trú");
                if (!g.subs.has(subLabel)) g.subs.set(subLabel, { count: 0, cost: 0 });
                const sub = g.subs.get(subLabel)!;
                sub.count++;
                sub.cost += Number(row.t_tongchi) || 0;
            }

            const groups = Array.from(groupMap.values()).map((g) => ({
                ma_cskcb: g.ma_cskcb, thang_qt: g.thang_qt, nam_qt: g.nam_qt,
            }));
            const excelKeys: Record<string, { keys: string[]; count: number; cost: number; subs: { label: string; count: number; cost: number }[] }> = {};
            for (const [gid, g] of groupMap) {
                excelKeys[gid] = {
                    keys: g.keys,
                    count: g.rows.length,
                    cost: g.cost,
                    subs: Array.from(g.subs.entries()).map(([label, v]) => ({ label, ...v })),
                };
            }

            const res = await fetch("/api/bq/overview/normalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "compare", groups, excelKeys }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const comparisons: NormalizeComparison[] = (data.comparisons || []).map(
                (c: NormalizeComparison) => ({
                    ...c,
                    ten_cskcb: cskcbMap.get(c.ma_cskcb) || c.ma_cskcb,
                })
            );
            setNormalizeData(comparisons);
            // Auto-check groups that have differences
            const autoChecked = new Set<string>();
            for (const c of comparisons) {
                if (c.diff !== 0 || c.bqOnlyCount > 0 || c.excelOnlyCount > 0) {
                    autoChecked.add(`${c.ma_cskcb}|${c.thang_qt}|${c.nam_qt}`);
                }
            }
            setNormalizeChecked(autoChecked);
            normalizeCompared.current = true;
        } catch (e: unknown) {
            setNormalizeError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setNormalizeLoading(false);
        }
    }, [currentSheet, cskcbMap]);

    /* ── Normalize: execute ── */
    const handleNormalizeExecute = async () => {
        if (!currentSheet || normalizeChecked.size === 0) return;
        setShowNormalizeConfirm(false);
        setNormalizeLoading(true);
        setNormalizeError(null);

        try {
            const allRows = currentSheet.validRows;
            // Get cached transformed rows for upload
            const cachedRows = parsedSheetRows.current.get(selectedSheet) || [];

            // Build groups with full row data
            const groups: { ma_cskcb: string; thang_qt: number; nam_qt: number; rows: Record<string, unknown>[] }[] = [];

            for (const gid of normalizeChecked) {
                const [ma, thang, nam] = gid.split("|");
                const groupRows = allRows
                    .filter((r) =>
                        String(r.ma_cskcb) === ma &&
                        Number(r.thang_qt) === Number(thang) &&
                        Number(r.nam_qt) === Number(nam)
                    )
                    .map((r) => {
                        const idx = r._idx as number;
                        return cachedRows[idx] || r;
                    });
                groups.push({ ma_cskcb: ma, thang_qt: Number(thang), nam_qt: Number(nam), rows: groupRows });
            }

            // Send in chunks per group (each group sent as a single request)
            const totalRows = groups.reduce((s, g) => s + g.rows.length, 0);
            let processedRows = 0;
            const allResults: NormalizeResult[] = [];
            for (const group of groups) {
                const CHUNK_SIZE = 1500;
                const chunks: Record<string, unknown>[][] = [];
                for (let i = 0; i < group.rows.length; i += CHUNK_SIZE) {
                    chunks.push(group.rows.slice(i, i + CHUNK_SIZE));
                }

                // First chunk does the DELETE + INSERT
                let totalInserted = 0;
                let totalDeleted = 0;
                for (let ci = 0; ci < chunks.length; ci++) {
                    if (ci === 0) {
                        setNormalizeProgress({ current: processedRows, total: totalRows, step: "Đang xóa hồ sơ cũ..." });
                    }
                    const payload = ci === 0
                        ? { action: "execute", groups: [{ ...group, rows: chunks[ci] }] }
                        : { action: "execute", groups: [{ ...group, rows: chunks[ci], skipDelete: true }] };
                    const res = await fetch("/api/bq/overview/normalize", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    if (data.results?.[0]) {
                        totalInserted += data.results[0].inserted || 0;
                        totalDeleted += data.results[0].deleted || 0;
                    }
                    processedRows += chunks[ci].length;
                    setNormalizeProgress({ current: processedRows, total: totalRows, step: "Đang thêm hồ sơ mới..." });
                }
                allResults.push({
                    ma_cskcb: group.ma_cskcb,
                    thang_qt: group.thang_qt,
                    nam_qt: group.nam_qt,
                    deleted: totalDeleted,
                    inserted: totalInserted,
                });
            }

            setNormalizeResults(allResults);
            // Refresh comparison data
            normalizeCompared.current = false;
        } catch (e: unknown) {
            setNormalizeError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setNormalizeLoading(false);
            setNormalizeProgress(null);
        }
    };

    // Auto-trigger compare when switching to normalize tab
    useEffect(() => {
        if (selectedTab === "normalize" && currentSheet && !normalizeCompared.current) {
            handleNormalizeCompare();
        }
    }, [selectedTab, currentSheet, handleNormalizeCompare]);

    /* ── Reset ── */
    const handleReset = () => {
        setFile(null);
        setSheets([]);
        setUploadMsgs(new Map());
        setError(null);
        setCheckedRows(new Set());
        setRemovedRows(new Set());
        setDoneRows(new Set());
        setDoneMode({});
        setSearchKeyword("");
        setNormalizeData([]);
        setNormalizeChecked(new Set());
        setNormalizeResults(null);
        setNormalizeError(null);
        normalizeCompared.current = false;
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Check unlock status from localStorage (shared with Settings page)
    // Must use focus + storage + custom event listeners because TabGroup keep-alive prevents remount
    const [isUnlocked, setIsUnlocked] = useState(false);
    useEffect(() => {
        const check = () => setIsUnlocked(localStorage.getItem("settings_unlocked") === "true");
        check();
        window.addEventListener("focus", check);
        window.addEventListener("storage", check);
        window.addEventListener("settings-unlock-change", check);
        return () => {
            window.removeEventListener("focus", check);
            window.removeEventListener("storage", check);
            window.removeEventListener("settings-unlock-change", check);
        };
    }, []);

    if (!isUnlocked) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-2">Chức năng Import bị khóa</h3>
                <p className="text-sm text-gray-500 max-w-md">
                    Vui lòng vào trang <a href="/settings" className="text-primary-600 font-semibold hover:underline">Cấu hình</a> và bấm <strong>Mở khóa</strong> để sử dụng chức năng import dữ liệu.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">

            <InfoBanner type="info">
                <span className="font-bold">Import dữ liệu từ file excel theo mẫu C79,80b-HD (CV3360) vào data lưu trên BigQuery.</span>
                <br />
                Hệ thống tự động phát hiện các sheet có định dạng phù hợp với file excel mẫu. Lần lượt chọn từng sheet (nếu hợp lệ), kiểm tra tổng quan số lượng nội trú, ngoại trú của từng cơ sở. Lựa chọn chức năng bổ sung mới, thay thế bản ghi trùng lặp hoặc thay thế theo tháng quyết toán (chức năng chuẩn hóa dữ liệu).
            </InfoBanner>

            {error && <InfoBanner type="error">❌ {error}</InfoBanner>}

            {/* ── Drop zone: no file selected ── */}
            {!file && (
                <div
                    className="file-upload-zone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileSelect}
                        style={{ display: "none" }}
                    />
                    <div className="upload-placeholder">
                        <span className="upload-icon">📤</span>
                        <p>Kéo thả hoặc click chọn file Excel theo mẫu C79,80b-HD (CV 3360)</p>
                        <small>.xlsx, .xls</small>
                    </div>
                </div>
            )}

            {/* Hidden file input for when file is already selected */}
            {file && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                />
            )}

            {/* ── File selected, not yet validated ── */}
            {file && sheets.length === 0 && doneRows.size === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700">
                        <span>📁</span>
                        <strong>{file.name}</strong>
                        <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                        onClick={handleValidate}
                        disabled={loading}
                    >
                        {loading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra...</>
                        ) : (
                            "🔍 Kiểm tra"
                        )}
                    </button>
                    <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer ml-auto"
                        onClick={handleReset}
                        title="Hủy file"
                    >
                        ✕ Hủy
                    </button>
                </div>
            )}

            {/* ── Results after validation ── */}
            {sheets.length > 0 && (
                <div className="flex flex-col gap-4">

                    {/* File info + Sheet selector — white card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {/* Sheet selector / label */}
                            {sheets.length > 1 ? (
                                <select
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-sm font-medium text-green-700 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors focus:ring-primary-500 focus:border-primary-500 pr-8"
                                    value={selectedSheet}
                                    onChange={(e) => handleSheetChange(e.target.value)}
                                >
                                    {sheets.map((s) => (
                                        <option key={s.sheetName} value={s.sheetName}>
                                            📄 {s.sheetName} ({s.matchedCols} cột, {s.validRows.length} dòng{s.invalidCount > 0 ? `, ${s.invalidCount} loại bỏ` : ""})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-sm font-medium text-green-700 border border-green-200">
                                    📄 {sheets[0].sheetName}
                                    <span className="opacity-75 text-xs font-normal">({sheets[0].matchedCols} cột, {sheets[0].validRows.length} dòng{sheets[0].invalidCount > 0 ? <span className="text-red-500 font-semibold">, {sheets[0].invalidCount} loại bỏ</span> : ""})</span>
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* File info badge */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700">
                                <span>📁</span>
                                {file!.name}
                                <span className="text-gray-400 text-xs">({(file!.size / 1024).toFixed(1)} KB)</span>
                                <button
                                    className="hover:text-red-500 ml-0.5 transition-colors text-gray-400"
                                    onClick={handleReset}
                                    title="Hủy file, xóa dữ liệu"
                                >
                                    ✕
                                </button>
                            </div>
                            <button
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                                onClick={handleReset}
                                title="Hủy file, quay về trạng thái ban đầu"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                Hủy
                            </button>
                        </div>
                    </div>

                    {/* Data card: tabs + table + footer */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">

                        {/* Tab bar + toolbar */}
                        <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Pill tabs */}
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg self-start">
                                <button
                                    onClick={() => setSelectedTab("summary")}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${selectedTab === "summary"
                                        ? "font-bold text-primary-600 bg-white shadow-sm"
                                        : "font-medium text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    📖 Xác thực dữ liệu{sheetUpdating && (<Loader2 className="w-3 h-3 animate-spin text-gray-400" />)}{!sheetUpdating && validationWarnings.length > 0 && (<span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-amber-400 text-white rounded-full leading-none">{validationWarnings.length}</span>)}
                                </button>
                                <button
                                    onClick={() => setSelectedTab("valid")}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${selectedTab === "valid"
                                        ? "font-bold text-primary-600 bg-white shadow-sm"
                                        : "font-medium text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    ✅ Bệnh nhân mới ({validCount}){sheetUpdating && (<Loader2 className="w-3 h-3 animate-spin text-gray-400" />)}
                                </button>
                                <button
                                    onClick={() => setSelectedTab("duplicate")}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${selectedTab === "duplicate"
                                        ? "font-bold text-amber-600 bg-white shadow-sm"
                                        : "font-medium text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    📋 Bệnh nhân trùng lặp ({dupCount}){sheetUpdating && (<Loader2 className="w-3 h-3 animate-spin text-gray-400" />)}
                                </button>
                                <button
                                    onClick={() => { setSelectedTab("normalize"); normalizeCompared.current = false; }}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${selectedTab === "normalize"
                                        ? "font-bold text-teal-600 bg-white shadow-sm"
                                        : "font-medium text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    🔄 Chuẩn hóa dữ liệu{(sheetUpdating || normalizeLoading) && (<Loader2 className="w-3 h-3 animate-spin text-gray-400" />)}
                                </button>
                            </div>

                            {/* Search + Column Config + Delete (data tabs only) */}
                            {selectedTab !== "summary" && selectedTab !== "normalize" && (
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:w-60">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                                        <input
                                            type="search"
                                            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                                            placeholder="Tìm kiếm bệnh nhân..."
                                            value={searchKeyword}
                                            onChange={(e) => setSearchKeyword(e.target.value)}
                                        />
                                    </div>

                                    {/* Column visibility config */}
                                    <div ref={colMenuRef} style={{ position: "relative" }}>
                                        <button
                                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
                                            onClick={() => setShowColMenu((v) => !v)}
                                            title="Cấu hình cột hiển thị"
                                        >
                                            ⚙️
                                        </button>
                                        {showColMenu && (
                                            <div className="col-config-dropdown">
                                                <div className="col-config-header">
                                                    <span>Hiển thị cột</span>
                                                    <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem" }}>
                                                        <button
                                                            className="col-config-action"
                                                            style={{ fontWeight: colMode === "all" ? 700 : 400 }}
                                                            onClick={() => {
                                                                setVisibleCols(new Set(ALL_COLS.map((c) => c.key)));
                                                                setColMode("all");
                                                            }}
                                                        >
                                                            {colMode === "all" ? "✓ " : ""}Tất cả
                                                        </button>
                                                        <button
                                                            className="col-config-action"
                                                            style={{ fontWeight: colMode === "custom" ? 700 : 400 }}
                                                            onClick={() => {
                                                                try {
                                                                    const saved = localStorage.getItem(LS_KEY);
                                                                    if (saved) {
                                                                        setVisibleCols(new Set(JSON.parse(saved) as string[]));
                                                                    } else {
                                                                        setVisibleCols(new Set(DEFAULT_VISIBLE_KEYS));
                                                                    }
                                                                } catch {
                                                                    setVisibleCols(new Set(DEFAULT_VISIBLE_KEYS));
                                                                }
                                                                setColMode("custom");
                                                            }}
                                                        >
                                                            {colMode === "custom" ? "✓ " : ""}Tùy chỉnh
                                                        </button>
                                                    </div>
                                                </div>
                                                {ALL_COLS.filter((c) => !PINNED_KEYS.has(c.key)).map((col) => (
                                                    <label key={col.key} className="col-config-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleCols.has(col.key)}
                                                            onChange={() => toggleCol(col.key)}
                                                        />
                                                        {col.label}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {checkedInCurrentTab > 0 && (
                                        <button
                                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                                            onClick={handleLocalDelete}
                                            title={`Xóa ${checkedInCurrentTab} dòng đã chọn`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedTab === "summary" && currentSheet && (() => {
                            const pivot = buildPivotSummary(currentSheet.validRows);
                            if (!pivot) return (
                                <div className="px-4 pb-4">
                                    {/* Re-validate button */}
                                    <div className="flex justify-end mb-3">
                                        <button
                                            onClick={handleValidate}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-md transition-colors shadow-sm cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                                            Xác thực lại
                                        </button>
                                    </div>

                                    {/* Invalid rows warning */}
                                    {currentSheet.invalidCount > 0 && (
                                        <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                                            <div className="flex items-center gap-2 font-semibold mb-1">
                                                <span className="text-base">🚫</span>
                                                Đã loại bỏ <strong>{currentSheet.invalidCount.toLocaleString()}</strong> dòng không hợp lệ
                                            </div>
                                            {currentSheet.issues.length > 0 && (
                                                <ul className="ml-6 mt-1 list-disc text-xs text-red-600 space-y-0.5">
                                                    {currentSheet.issues.map((iss) => (
                                                        <li key={iss.col}>
                                                            <strong>{COL_LABELS[iss.col] || iss.col}</strong> ({iss.col}): <strong>{iss.count}</strong> lỗi — {iss.reason}
                                                            {iss.samples.length > 0 && (
                                                                <span className="text-red-400"> (ví dụ: {iss.samples.map((s, i) => <code key={i} className="bg-red-100 px-1 rounded text-[11px]">{s}</code>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])})</span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}

                                    {/* Validation warnings */}
                                    {validationWarnings.length > 0 && (
                                        <div className="space-y-2">
                                            {validationWarnings.map((w, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${w.type === "error"
                                                        ? "bg-red-50 border border-red-200 text-red-700"
                                                        : "bg-amber-50 border border-amber-200 text-amber-700"
                                                        }`}
                                                >
                                                    <span className="text-base mt-0.5">{w.type === "error" ? "🚨" : "⚠️"}</span>
                                                    <span>{w.msg}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {currentSheet.invalidCount === 0 && validationWarnings.length === 0 && (
                                        <div className="py-8 text-center text-gray-400">Không có dữ liệu tóm tắt</div>
                                    )}
                                </div>
                            );
                            const dash = "—";
                            const fmtNum = (v: number) => v === 0 ? dash : v.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
                            const totalCols = 1
                                + (pivot.ngoaiCskcb.length > 0 ? pivot.ngoaiCskcb.length + 1 : 0)
                                + (pivot.noiCskcb.length > 0 ? pivot.noiCskcb.length + 1 : 0) + 1;

                            const renderDataRow = (row: Record<string, number | string>, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50/60 transition-colors border-b border-gray-100">
                                    <td className="py-2 px-3 text-left text-gray-700 font-medium sticky left-0 bg-white">
                                        {row.thang}
                                    </td>
                                    {pivot.ngoaiCskcb.map((c: CskcbInfo) => (
                                        <td key={`ngoai-${c.ma}`} className="py-2 px-3 text-right text-gray-600">
                                            {fmtNum(row[`ngoai_${c.ma}`] as number)}
                                        </td>
                                    ))}
                                    {pivot.ngoaiCskcb.length > 0 && (
                                        <td className="py-2 px-3 text-right font-bold text-indigo-600">
                                            {fmtNum(row["ngoai_tong"] as number)}
                                        </td>
                                    )}
                                    {pivot.noiCskcb.map((c: CskcbInfo) => (
                                        <td key={`noi-${c.ma}`} className="py-2 px-3 text-right text-gray-600">
                                            {fmtNum(row[`noi_${c.ma}`] as number)}
                                        </td>
                                    ))}
                                    {pivot.noiCskcb.length > 0 && (
                                        <td className="py-2 px-3 text-right font-bold text-indigo-600">
                                            {fmtNum(row["noi_tong"] as number)}
                                        </td>
                                    )}
                                    <td className="py-2 px-3 text-right font-bold text-gray-900">
                                        {fmtNum(row["tong_cong"] as number)}
                                    </td>
                                </tr>
                            );

                            const renderSubtotalRow = (label: string, section: SectionPivot) => (
                                <tr className="border-b border-gray-200 bg-white">
                                    <td className="py-2 px-3 text-left font-bold text-gray-900 sticky left-0 bg-white">
                                        {label}
                                    </td>
                                    {pivot.ngoaiCskcb.map((c: CskcbInfo) => {
                                        const total = section.pivotRows.reduce(
                                            (s: number, r: Record<string, number | string>) => s + ((r[`ngoai_${c.ma}`] as number) || 0), 0
                                        );
                                        return (
                                            <td key={`t-ngoai-${c.ma}`} className="py-2 px-3 text-right font-bold text-gray-800">
                                                {fmtNum(total)}
                                            </td>
                                        );
                                    })}
                                    {pivot.ngoaiCskcb.length > 0 && (
                                        <td className="py-2 px-3 text-right font-bold text-indigo-600">
                                            {fmtNum(section.grandNgoai)}
                                        </td>
                                    )}
                                    {pivot.noiCskcb.map((c: CskcbInfo) => {
                                        const total = section.pivotRows.reduce(
                                            (s: number, r: Record<string, number | string>) => s + ((r[`noi_${c.ma}`] as number) || 0), 0
                                        );
                                        return (
                                            <td key={`t-noi-${c.ma}`} className="py-2 px-3 text-right font-bold text-gray-800">
                                                {fmtNum(total)}
                                            </td>
                                        );
                                    })}
                                    {pivot.noiCskcb.length > 0 && (
                                        <td className="py-2 px-3 text-right font-bold text-indigo-600">
                                            {fmtNum(section.grandNoi)}
                                        </td>
                                    )}
                                    <td className="py-2 px-3 text-right font-bold text-gray-900">
                                        {fmtNum(section.grandNgoai + section.grandNoi)}
                                    </td>
                                </tr>
                            );

                            return (
                                <div className="px-4 pb-4">
                                    {/* Re-validate button */}
                                    <div className="flex justify-end mb-3">
                                        <button
                                            onClick={handleValidate}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-md transition-colors shadow-sm cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                                            Xác thực lại
                                        </button>
                                    </div>

                                    {/* Invalid rows warning */}
                                    {currentSheet.invalidCount > 0 && (
                                        <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                                            <div className="flex items-center gap-2 font-semibold mb-1">
                                                <span className="text-base">🚫</span>
                                                Đã loại bỏ <strong>{currentSheet.invalidCount.toLocaleString()}</strong> dòng không hợp lệ
                                            </div>
                                            {currentSheet.issues.length > 0 && (
                                                <ul className="ml-6 mt-1 list-disc text-xs text-red-600 space-y-0.5">
                                                    {currentSheet.issues.map((iss) => (
                                                        <li key={iss.col}>
                                                            <strong>{COL_LABELS[iss.col] || iss.col}</strong> ({iss.col}): <strong>{iss.count}</strong> lỗi — {iss.reason}
                                                            {iss.samples.length > 0 && (
                                                                <span className="text-red-400"> (ví dụ: {iss.samples.map((s, i) => <code key={i} className="bg-red-100 px-1 rounded text-[11px]">{s}</code>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])})</span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}

                                    {/* Table */}
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                        <table className="w-full border-collapse" style={{ fontVariantNumeric: "tabular-nums" }}>
                                            <thead>
                                                {/* Row 1: Group headers */}
                                                <tr className="text-[11px] font-bold uppercase tracking-wider text-center bg-primary-200">
                                                    <th className="py-2 px-3 text-left text-primary-800 sticky left-0 z-10 bg-primary-200">
                                                        Kỳ
                                                    </th>
                                                    {pivot.ngoaiCskcb.length > 0 && (
                                                        <th className="py-2 px-3 text-primary-800" colSpan={pivot.ngoaiCskcb.length + 1}>
                                                            Ngoại trú
                                                        </th>
                                                    )}
                                                    {pivot.noiCskcb.length > 0 && (
                                                        <th className="py-2 px-3 text-primary-800" colSpan={pivot.noiCskcb.length + 1}>
                                                            Nội trú
                                                        </th>
                                                    )}
                                                    <th className="py-2 px-3 text-primary-800 min-w-[80px]">
                                                        Tổng cộng
                                                    </th>
                                                </tr>
                                                {/* Row 2: Sub-headers */}
                                                <tr className="text-[11px] font-bold uppercase tracking-tight text-right text-gray-500 border-b border-gray-200 bg-primary-100">
                                                    <th className="py-2 px-3 text-left italic font-semibold text-gray-500 sticky left-0 bg-primary-100">
                                                        Cơ sở KCB
                                                    </th>
                                                    {pivot.ngoaiCskcb.map((c: CskcbInfo) => (
                                                        <th key={`h-ngoai-${c.ma}`} className="py-2 px-3 font-bold text-gray-700">{c.ten}</th>
                                                    ))}
                                                    {pivot.ngoaiCskcb.length > 0 && (
                                                        <th className="py-2 px-3 text-indigo-600 font-bold">Tổng</th>
                                                    )}
                                                    {pivot.noiCskcb.map((c: CskcbInfo) => (
                                                        <th key={`h-noi-${c.ma}`} className="py-2 px-3 font-bold text-gray-700">{c.ten}</th>
                                                    ))}
                                                    {pivot.noiCskcb.length > 0 && (
                                                        <th className="py-2 px-3 text-indigo-600 font-bold">Tổng</th>
                                                    )}
                                                    <th className="py-2 px-3 text-gray-700 font-bold">Toàn viện</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[13px]">
                                                {/* Section: Hợp lệ */}
                                                <tr style={{ background: "#e8f5e9" }}>
                                                    <td className="py-1.5 px-3 font-bold text-emerald-700 uppercase tracking-tight sticky left-0 text-[12px]" style={{ background: "#e8f5e9" }} colSpan={1}>
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                                                            Bệnh nhân mới
                                                        </span>
                                                    </td>
                                                    <td colSpan={totalCols - 1} style={{ background: "#e8f5e9" }} />
                                                </tr>
                                                {pivot.sections[0].data.pivotRows.map((row, idx) => renderDataRow(row, idx))}
                                                {renderSubtotalRow("TỔNG BN MỚI", pivot.sections[0].data)}

                                                {/* Section: Trùng lặp */}
                                                <tr style={{ background: "#fff3e0" }}>
                                                    <td className="py-1.5 px-3 font-bold text-amber-700 uppercase tracking-tight sticky left-0 text-[12px]" style={{ background: "#fff3e0" }} colSpan={1}>
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.5A2.5 2.5 0 014.5 2h6A2.5 2.5 0 0113 4.5V6h1.5A2.5 2.5 0 0117 8.5v7a2.5 2.5 0 01-2.5 2.5h-6A2.5 2.5 0 016 15.5V14H4.5A2.5 2.5 0 012 11.5v-7z" /></svg>
                                                            Bệnh nhân trùng lặp
                                                        </span>
                                                    </td>
                                                    <td colSpan={totalCols - 1} style={{ background: "#fff3e0" }} />
                                                </tr>
                                                {pivot.sections[1].data.pivotRows.map((row, idx) => renderDataRow(row, idx))}
                                                {renderSubtotalRow("TỔNG BN TRÙNG LẶP", pivot.sections[1].data)}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t-[3px] border-indigo-400" style={{ background: "#ede7f6" }}>
                                                    <td className="py-2.5 px-3 text-left font-bold text-indigo-700 text-sm sticky left-0" style={{ background: "#ede7f6" }}>
                                                        TỔNG CHUNG
                                                    </td>
                                                    {pivot.ngoaiCskcb.map((c: CskcbInfo) => {
                                                        const total = pivot.total.pivotRows.reduce(
                                                            (s: number, r: Record<string, number | string>) => s + ((r[`ngoai_${c.ma}`] as number) || 0), 0
                                                        );
                                                        return (
                                                            <td key={`gt-ngoai-${c.ma}`} className="py-2.5 px-3 text-right font-bold text-indigo-700 text-sm">
                                                                {fmtNum(total)}
                                                            </td>
                                                        );
                                                    })}
                                                    {pivot.ngoaiCskcb.length > 0 && (
                                                        <td className="py-2.5 px-3 text-right font-bold text-indigo-600 text-sm">
                                                            {fmtNum(pivot.total.grandNgoai)}
                                                        </td>
                                                    )}
                                                    {pivot.noiCskcb.map((c: CskcbInfo) => {
                                                        const total = pivot.total.pivotRows.reduce(
                                                            (s: number, r: Record<string, number | string>) => s + ((r[`noi_${c.ma}`] as number) || 0), 0
                                                        );
                                                        return (
                                                            <td key={`gt-noi-${c.ma}`} className="py-2.5 px-3 text-right font-bold text-indigo-700 text-sm">
                                                                {fmtNum(total)}
                                                            </td>
                                                        );
                                                    })}
                                                    {pivot.noiCskcb.length > 0 && (
                                                        <td className="py-2.5 px-3 text-right font-bold text-indigo-600 text-sm">
                                                            {fmtNum(pivot.total.grandNoi)}
                                                        </td>
                                                    )}
                                                    <td className="py-2.5 px-3 text-right font-extrabold text-indigo-700 text-sm">
                                                        {fmtNum(pivot.total.grandNgoai + pivot.total.grandNoi)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Validation warnings (inside px-4 wrapper) */}
                                    {validationWarnings.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {validationWarnings.map((w, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${w.type === "error"
                                                        ? "bg-red-50 border border-red-200 text-red-700"
                                                        : "bg-amber-50 border border-amber-200 text-amber-700"
                                                        }`}
                                                >
                                                    <span className="text-base mt-0.5">{w.type === "error" ? "🚨" : "⚠️"}</span>
                                                    <span>{w.msg}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* ── Tab content: Data tables (valid / duplicate) ── */}
                        {selectedTab !== "summary" && selectedTab !== "normalize" && (
                            <>
                                <DataTable
                                    columns={displayColumns}
                                    data={filteredRows}
                                    selectable
                                    selectedRows={displaySelectedRows}
                                    disabledRows={displayDisabledRows}
                                    onSelectionChange={handleSelectionChange}
                                    stickyHeader
                                    rowClassName={getRowClassName}
                                />

                                {/* Inline success message */}
                                {uploadMsgs.get(`${selectedSheet}:${selectedTab}`) && (
                                    <div className="mx-5 mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 font-semibold text-sm text-center">
                                        {uploadMsgs.get(`${selectedSheet}:${selectedTab}`)}
                                    </div>
                                )}

                                {/* Sticky action bar */}
                                <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-center gap-3 sticky bottom-0">
                                    {selectedTab === "duplicate" && dupCount > 0 && (
                                        <button
                                            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                            onClick={() => handleUpload("overwrite")}
                                            disabled={loading || checkedDupCount === 0}
                                        >
                                            {loading ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress ? `Đang ghi đè ${uploadProgress.current.toLocaleString()}/${uploadProgress.total.toLocaleString()} (${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)` : "Đang ghi đè..."}</>
                                            ) : (
                                                `🔄 Xác nhận ghi đè (${checkedDupCount})`
                                            )}
                                        </button>
                                    )}

                                    {selectedTab === "valid" && (
                                        <button
                                            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                            onClick={() => handleUpload("new")}
                                            disabled={loading || checkedNewCount === 0}
                                        >
                                            {loading ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> {uploadProgress ? `Đang tải lên ${uploadProgress.current.toLocaleString()}/${uploadProgress.total.toLocaleString()} (${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)` : "Đang tải lên..."}</>
                                            ) : (
                                                `☁️ Tải lên mới (${checkedNewCount})`
                                            )}
                                        </button>
                                    )}
                                </div>
                                {/* Progress bar */}
                                {uploadProgress && (
                                    <div className="px-5 pb-3 bg-gray-50 flex flex-col items-center gap-1.5">
                                        <div className="w-full max-w-md bg-gray-200 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-primary-500 h-full rounded-full transition-all duration-500 ease-out"
                                                style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {uploadProgress.current.toLocaleString()}/{uploadProgress.total.toLocaleString()} hồ sơ
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── Tab content: Normalize ── */}
                        {selectedTab === "normalize" && (
                            <div className="px-4 pb-4">
                                {normalizeLoading && !normalizeData.length && (
                                    <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Đang so sánh dữ liệu với BigQuery...</span>
                                    </div>
                                )}

                                {normalizeError && (
                                    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                        ❌ {normalizeError}
                                    </div>
                                )}

                                {/* Success results */}
                                {normalizeResults && (
                                    <div className="mb-4 space-y-2">
                                        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                                            <p className="font-bold text-green-700 text-sm mb-2">✅ Chuẩn hóa thành công!</p>
                                            {normalizeResults.map((r, i) => (
                                                <p key={i} className="text-green-600 text-sm">
                                                    • {r.ma_cskcb} — Kỳ {r.thang_qt}/{r.nam_qt}: Xóa {r.deleted.toLocaleString()}, thêm {r.inserted.toLocaleString()} bản ghi
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Comparison table */}
                                {normalizeData.length > 0 && (
                                    <>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm text-gray-500">So sánh số liệu Excel với BigQuery theo CSKCB và kỳ quyết toán</p>
                                            <button
                                                onClick={() => { normalizeCompared.current = false; handleNormalizeCompare(); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-md transition-colors shadow-sm cursor-pointer"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                                                So sánh lại
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                            <table className="w-full border-collapse" style={{ fontVariantNumeric: "tabular-nums" }}>
                                                <thead>
                                                    <tr className="text-[11px] font-bold uppercase tracking-wider text-center bg-teal-100">
                                                        <th className="py-2 px-3 text-left text-teal-800 w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={normalizeData.length > 0 && normalizeChecked.size === normalizeData.length}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setNormalizeChecked(new Set(normalizeData.map((c) => `${c.ma_cskcb}|${c.thang_qt}|${c.nam_qt}`)));
                                                                    } else {
                                                                        setNormalizeChecked(new Set());
                                                                    }
                                                                }}
                                                            />
                                                        </th>
                                                        <th className="py-2 px-2 text-left text-teal-800 whitespace-nowrap w-[1%]">CSKCB</th>
                                                        <th className="py-2 px-3 text-left text-teal-800 whitespace-nowrap min-w-[160px]">Tên CSKCB</th>
                                                        <th className="py-2 px-2 text-teal-800 whitespace-nowrap w-[1%]">Kỳ QT</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">Data lưu</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">Excel mới</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">Trùng</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">Chỉ Data lưu</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">Chỉ Excel</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">Chênh lệch</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">CP Data lưu</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">CP Excel</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">Chuẩn hóa</th>
                                                        <th className="py-2 px-3 text-right text-teal-800 whitespace-nowrap">Chưa chuẩn hóa</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-[13px]">
                                                    {normalizeData.map((c, i) => {
                                                        const gid = `${c.ma_cskcb}|${c.thang_qt}|${c.nam_qt}`;
                                                        const isChecked = normalizeChecked.has(gid);
                                                        const isExpanded = expandedGroups.has(gid);
                                                        // Merge sub labels from both BQ and Excel
                                                        const allLabels = new Set([
                                                            ...(c.bqSubs || []).map((s) => s.label),
                                                            ...(c.excelSubs || []).map((s) => s.label),
                                                        ]);
                                                        const subLabels = ["Nội trú", "Ngoại trú"].filter((l) => allLabels.has(l));
                                                        return (
                                                            <Fragment key={i}>
                                                                <tr className={`border-b border-gray-100 transition-colors ${isChecked ? "bg-teal-50" : "hover:bg-gray-50/60"}`}>
                                                                    <td className="py-2 px-3">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={() => {
                                                                                setNormalizeChecked((prev) => {
                                                                                    const next = new Set(prev);
                                                                                    if (next.has(gid)) next.delete(gid);
                                                                                    else next.add(gid);
                                                                                    return next;
                                                                                });
                                                                            }}
                                                                        />
                                                                    </td>
                                                                    <td className="py-2 px-2 text-gray-700 font-mono text-xs whitespace-nowrap">{c.ma_cskcb}</td>
                                                                    <td
                                                                        className="py-2 px-3 text-gray-700 font-medium cursor-pointer select-none"
                                                                        onClick={() => {
                                                                            setExpandedGroups((prev) => {
                                                                                const next = new Set(prev);
                                                                                if (next.has(gid)) next.delete(gid);
                                                                                else next.add(gid);
                                                                                return next;
                                                                            });
                                                                        }}
                                                                    >
                                                                        <span className="inline-flex items-center gap-1.5">
                                                                            <span className={`text-[10px] text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                                                                            {c.ten_cskcb}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-2 text-center text-gray-700 font-medium whitespace-nowrap">{c.thang_qt}/{c.nam_qt}</td>
                                                                    <td className="py-2 px-3 text-right text-gray-600">{c.bqCount.toLocaleString()}</td>
                                                                    <td className="py-2 px-3 text-right text-gray-600">{c.excelCount.toLocaleString()}</td>
                                                                    <td className="py-2 px-3 text-right text-gray-500">{c.dupCount.toLocaleString()}</td>
                                                                    <td className="py-2 px-3 text-right text-red-500 font-medium">{c.bqOnlyCount > 0 ? `-${c.bqOnlyCount.toLocaleString()}` : "—"}</td>
                                                                    <td className="py-2 px-3 text-right text-emerald-600 font-medium">{c.excelOnlyCount > 0 ? `+${c.excelOnlyCount.toLocaleString()}` : "—"}</td>
                                                                    <td className={`py-2 px-3 text-right font-bold ${c.diff > 0 ? "text-emerald-600" : c.diff < 0 ? "text-red-500" : "text-gray-400"}`}>
                                                                        {c.diff > 0 ? `+${c.diff.toLocaleString()}` : c.diff === 0 ? "—" : c.diff.toLocaleString()}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right text-gray-600 text-xs font-mono">{c.bqCost ? Math.round(c.bqCost).toLocaleString() : "—"}</td>
                                                                    <td className="py-2 px-3 text-right text-gray-600 text-xs font-mono">{c.excelCost ? Math.round(c.excelCost).toLocaleString() : "—"}</td>
                                                                    <td className="py-2 px-3 text-right text-blue-600 text-xs font-medium">{c.bqNormalized > 0 ? c.bqNormalized.toLocaleString() : "—"}</td>
                                                                    <td className="py-2 px-3 text-right text-orange-500 text-xs font-medium">{c.bqRaw > 0 ? c.bqRaw.toLocaleString() : "—"}</td>
                                                                </tr>
                                                                {isExpanded && subLabels.map((label) => {
                                                                    const bqSub = (c.bqSubs || []).find((s) => s.label === label);
                                                                    const excelSub = (c.excelSubs || []).find((s) => s.label === label);
                                                                    const bqC = bqSub?.count || 0;
                                                                    const exC = excelSub?.count || 0;
                                                                    const subDiff = exC - bqC;
                                                                    return (
                                                                        <tr key={`${gid}-${label}`} className="bg-gray-50/50 border-b border-gray-50">
                                                                            <td className="py-1.5 px-3" />
                                                                            <td className="py-1.5 px-3" />
                                                                            <td className="py-1.5 px-3 text-gray-500 text-xs pl-10">
                                                                                {label === "Nội trú" ? "🏥" : "🚶"} {label}
                                                                            </td>
                                                                            <td className="py-1.5 px-3" />
                                                                            <td className="py-1.5 px-3 text-right text-gray-500 text-xs">{bqC.toLocaleString()}</td>
                                                                            <td className="py-1.5 px-3 text-right text-gray-500 text-xs">{exC.toLocaleString()}</td>
                                                                            <td className="py-1.5 px-3" />
                                                                            <td className="py-1.5 px-3" />
                                                                            <td className="py-1.5 px-3" />
                                                                            <td className={`py-1.5 px-3 text-right text-xs font-medium ${subDiff > 0 ? "text-emerald-500" : subDiff < 0 ? "text-red-400" : "text-gray-400"}`}>
                                                                                {subDiff > 0 ? `+${subDiff.toLocaleString()}` : subDiff === 0 ? "—" : subDiff.toLocaleString()}
                                                                            </td>
                                                                            <td className="py-1.5 px-3 text-right text-gray-500 text-[11px] font-mono">{bqSub?.cost ? Math.round(bqSub.cost).toLocaleString() : "—"}</td>
                                                                            <td className="py-1.5 px-3 text-right text-gray-500 text-[11px] font-mono">{excelSub?.cost ? Math.round(excelSub.cost).toLocaleString() : "—"}</td>
                                                                            <td className="py-1.5 px-3" />
                                                                            <td className="py-1.5 px-3" />
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                                {normalizeData.length > 1 && (
                                                    <tfoot>
                                                        <tr className="border-t-2 border-teal-300 bg-teal-50 font-bold text-[13px]">
                                                            <td className="py-2 px-3" />
                                                            <td className="py-2 px-3 text-teal-800">TỔNG</td>
                                                            <td className="py-2 px-3 text-teal-800">{new Set(normalizeData.map(c => c.ma_cskcb)).size} CSKCB</td>
                                                            <td className="py-2 px-3 text-right text-teal-800">{new Set(normalizeData.map(c => `${c.thang_qt}/${c.nam_qt}`)).size} kỳ</td>
                                                            <td className="py-2 px-3 text-right text-teal-800">{normalizeData.reduce((s, c) => s + c.bqCount, 0).toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-right text-teal-800">{normalizeData.reduce((s, c) => s + c.excelCount, 0).toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-right text-teal-700">{normalizeData.reduce((s, c) => s + c.dupCount, 0).toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-right text-red-500">
                                                                {(() => { const v = normalizeData.reduce((s, c) => s + c.bqOnlyCount, 0); return v > 0 ? `-${v.toLocaleString()}` : "—"; })()}
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-emerald-600">
                                                                {(() => { const v = normalizeData.reduce((s, c) => s + c.excelOnlyCount, 0); return v > 0 ? `+${v.toLocaleString()}` : "—"; })()}
                                                            </td>
                                                            <td className={`py-2 px-3 text-right ${(() => { const d = normalizeData.reduce((s, c) => s + c.diff, 0); return d > 0 ? "text-emerald-600" : d < 0 ? "text-red-500" : "text-gray-400"; })()}`}>
                                                                {(() => { const d = normalizeData.reduce((s, c) => s + c.diff, 0); return d > 0 ? `+${d.toLocaleString()}` : d === 0 ? "—" : d.toLocaleString(); })()}
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-teal-800 text-xs font-mono">{Math.round(normalizeData.reduce((s, c) => s + c.bqCost, 0)).toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-right text-teal-800 text-xs font-mono">{Math.round(normalizeData.reduce((s, c) => s + c.excelCost, 0)).toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-right text-blue-600 text-xs font-bold">{normalizeData.reduce((s, c) => s + c.bqNormalized, 0).toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-right text-orange-500 text-xs font-bold">{normalizeData.reduce((s, c) => s + c.bqRaw, 0).toLocaleString()}</td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>

                                        {/* Normalize action bar */}
                                        <div className="mt-4 flex items-center justify-center">
                                            <button
                                                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                                onClick={() => setShowNormalizeConfirm(true)}
                                                disabled={normalizeLoading || normalizeChecked.size === 0}
                                            >
                                                {normalizeLoading ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> {normalizeProgress ? `${normalizeProgress.step || "Đang xử lý..."} ${normalizeProgress.current.toLocaleString()}/${normalizeProgress.total.toLocaleString()} (${Math.round((normalizeProgress.current / normalizeProgress.total) * 100)}%)` : "Đang xử lý..."}</>
                                                ) : (
                                                    `🔄 Chuẩn hóa (${normalizeChecked.size} kỳ)`
                                                )}
                                            </button>
                                        </div>
                                        {/* Normalize progress bar */}
                                        {normalizeProgress && (
                                            <div className="mt-3 flex flex-col items-center gap-1.5 w-full max-w-md mx-auto">
                                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="bg-teal-500 h-full rounded-full transition-all duration-500 ease-out"
                                                        style={{ width: `${Math.round((normalizeProgress.current / normalizeProgress.total) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {normalizeProgress.current.toLocaleString()}/{normalizeProgress.total.toLocaleString()} hồ sơ
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}

                                {!normalizeLoading && normalizeData.length === 0 && !normalizeError && (
                                    <div className="py-12 text-center text-gray-400">
                                        Không có dữ liệu để so sánh. Hãy đảm bảo file Excel đã được xác thực.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Normalize confirmation dialog ── */}
                        {showNormalizeConfirm && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNormalizeConfirm(false)}>
                                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                    <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
                                        <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2">
                                            ⚠️ Xác nhận chuẩn hóa dữ liệu
                                        </h3>
                                    </div>
                                    <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
                                        <p className="text-sm text-gray-600">Bạn sắp thay thế dữ liệu cho:</p>
                                        {normalizeData
                                            .filter((c) => normalizeChecked.has(`${c.ma_cskcb}|${c.thang_qt}|${c.nam_qt}`))
                                            .map((c, i) => (
                                                <div key={i} className="px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                                                    <p className="font-bold text-gray-800">{c.ma_cskcb} — {c.ten_cskcb}, kỳ {c.thang_qt}/{c.nam_qt}</p>
                                                    <p className="text-gray-600">→ Xóa <span className="text-red-500 font-bold">{c.bqCount.toLocaleString()}</span> bản ghi cũ, thêm <span className="text-emerald-600 font-bold">{c.excelCount.toLocaleString()}</span> bản ghi mới</p>
                                                </div>
                                            ))}
                                        <div className="pt-2 border-t border-gray-200">
                                            <p className="font-bold text-gray-800 text-sm">
                                                Tổng: Xóa {normalizeData.filter((c) => normalizeChecked.has(`${c.ma_cskcb}|${c.thang_qt}|${c.nam_qt}`)).reduce((s, c) => s + c.bqCount, 0).toLocaleString()} → Thêm {normalizeData.filter((c) => normalizeChecked.has(`${c.ma_cskcb}|${c.thang_qt}|${c.nam_qt}`)).reduce((s, c) => s + c.excelCount, 0).toLocaleString()} bản ghi
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                                        <button
                                            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                                            onClick={() => setShowNormalizeConfirm(false)}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            className="px-5 py-2 text-sm font-bold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
                                            onClick={handleNormalizeExecute}
                                        >
                                            Xác nhận chuẩn hóa
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
