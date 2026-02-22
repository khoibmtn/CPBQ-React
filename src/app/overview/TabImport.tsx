"use client";
import { Loader2, Trash2 } from "lucide-react";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
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
    issues: { col: string; count: number }[];
    summary: { period: string; maCSKCB: string; rows: number; tongChi: string }[];
}

type TabFilter = "summary" | "valid" | "duplicate";

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
    _status: "Trạng thái",
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
];

/** Columns always visible and non-toggleable */
const PINNED_KEYS = new Set(["stt", "_status"]);

/** Default visible columns (compact view) */
const DEFAULT_VISIBLE_KEYS = new Set([
    "stt", "ma_bn", "ho_ten", "ngay_sinh", "gioi_tinh", "ma_cskcb",
    "ngay_vao", "ngay_ra", "t_tongchi", "t_bhtt", "_status",
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

interface CskcbInfo {
    ma: string;
    ten: string;
}

interface PivotSummary {
    ngoaiCskcb: CskcbInfo[];
    noiCskcb: CskcbInfo[];
    pivotRows: Record<string, number | string>[];
    grandNgoai: number;
    grandNoi: number;
}

export default function TabImport() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sheets, setSheets] = useState<SheetData[]>([]);
    const [selectedSheet, setSelectedSheet] = useState("");
    const [selectedTab, setSelectedTab] = useState<TabFilter>("valid");
    const [checkedRows, setCheckedRows] = useState<Set<number>>(new Set());
    const [removedRows, setRemovedRows] = useState<Set<number>>(new Set());
    const [searchKeyword, setSearchKeyword] = useState("");
    // Per sheet+tab upload messages: key = "sheetName:valid" or "sheetName:duplicate"
    const [uploadMsgs, setUploadMsgs] = useState<Map<string, string>>(new Map());
    // Tracks rows that have been successfully uploaded/overwritten (by original index)
    const [doneRows, setDoneRows] = useState<Set<number>>(new Set());

    // Lookup tables for pivot summary
    const [loaiKCBMap, setLoaiKCBMap] = useState<Map<number, string>>(new Map());
    const [cskcbMap, setCskcbMap] = useState<Map<string, string>>(new Map());
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
        ]).then(([loaiRes, cskcbRes]) => {
            if (loaiRes.data) {
                const map = new Map<number, string>();
                (loaiRes.data as LoaiKCBEntry[]).forEach((r) => map.set(Number(r.ma_loaikcb), r.ml2));
                setLoaiKCBMap(map);
            }
            if (cskcbRes.data) {
                const map = new Map<string, string>();
                (cskcbRes.data as CskcbEntry[]).forEach((r) => map.set(String(r.ma_cskcb), r.ten_cskcb));
                setCskcbMap(map);
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

    /* ── Build pivot summary from valid rows ── */
    const buildPivotSummary = useCallback((rows: Row[]): PivotSummary | null => {
        if (rows.length === 0) return null;

        // Classify rows into ngoại trú / nội trú using lookup
        const ngoaiRows: Row[] = [];
        const noiRows: Row[] = [];
        for (const row of rows) {
            const ml = Number(row.ma_loaikcb);
            const ml2 = loaiKCBMap.get(ml) || (ml === 1 ? "Nội trú" : "Ngoại trú");
            if (ml2 === "Nội trú") noiRows.push(row);
            else ngoaiRows.push(row);
        }

        // Get unique CSKCB facilities
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

        const ngoaiCskcb = getUniqueCskcb(ngoaiRows);
        const noiCskcb = getUniqueCskcb(noiRows);

        // Get unique periods (thang_qt values)
        const periods = [...new Set(rows.map((r) => Number(r.thang_qt) || 0))]
            .filter((t) => t > 0)
            .sort((a, b) => a - b);

        // Build pivot rows
        const pivotRows: Record<string, number | string>[] = [];
        let grandNgoai = 0, grandNoi = 0;

        for (const thang of periods) {
            const row: Record<string, number | string> = {
                thang: `Tháng ${String(thang).padStart(2, "0")}`,
            };

            let tongNgoai = 0;
            for (const cskcb of ngoaiCskcb) {
                const count = ngoaiRows.filter(
                    (r) => Number(r.thang_qt) === thang && String(r.ma_cskcb) === cskcb.ma
                ).length;
                row[`ngoai_${cskcb.ma}`] = count;
                tongNgoai += count;
            }
            row["ngoai_tong"] = tongNgoai;
            grandNgoai += tongNgoai;

            let tongNoi = 0;
            for (const cskcb of noiCskcb) {
                const count = noiRows.filter(
                    (r) => Number(r.thang_qt) === thang && String(r.ma_cskcb) === cskcb.ma
                ).length;
                row[`noi_${cskcb.ma}`] = count;
                tongNoi += count;
            }
            row["noi_tong"] = tongNoi;
            grandNoi += tongNoi;

            row["tong_cong"] = tongNgoai + tongNoi;
            pivotRows.push(row);
        }

        return { ngoaiCskcb, noiCskcb, pivotRows, grandNgoai, grandNoi };
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
                const rawRows = extractSheetRows(workbook, s.sheetName);
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
                try {
                    const res = await fetch("/api/bq/overview/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ keys }),
                    });
                    const d = await res.json();
                    if (d.error) throw new Error(d.error);
                    dupIndices = new Set<number>(d.duplicateIndices || []);
                } catch {
                    // BQ unreachable — treat all as new
                }

                // Add _isDuplicate flag to display rows
                const displayRows = ps.validRows.map((row, i) => ({
                    ...row,
                    _isDuplicate: dupIndices.has(i),
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
        setSelectedTab("summary");
        setSearchKeyword("");
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

    // Row className for done rows (green background)
    const getRowClassName = (displayIdx: number): string => {
        const origIdx = selectionAdapter.get(displayIdx);
        if (origIdx !== undefined && doneRows.has(origIdx)) return "row-done";
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
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="flex flex-col gap-6">
            <SectionTitle icon="📥">Import dữ liệu Excel lên BigQuery</SectionTitle>

            <InfoBanner type="info">
                Upload file Excel chứa dữ liệu thanh toán BHYT. Hệ thống sẽ tự động
                phát hiện sheet, kiểm tra cấu trúc, xác nhận trùng lặp trước khi tải lên.
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
                        <p>Kéo thả file Excel hoặc click để chọn</p>
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
                                            📄 {s.sheetName} ({s.matchedCols} cột, {s.validRows.length} dòng)
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-sm font-medium text-green-700 border border-green-200">
                                    📄 {sheets[0].sheetName}
                                    <span className="opacity-75 text-xs font-normal">({sheets[0].matchedCols} cột, {sheets[0].validRows.length} dòng)</span>
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
                                    📖 Tóm tắt dữ liệu
                                </button>
                                <button
                                    onClick={() => setSelectedTab("valid")}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${selectedTab === "valid"
                                        ? "font-bold text-primary-600 bg-white shadow-sm"
                                        : "font-medium text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    ✅ Hợp lệ ({validCount})
                                </button>
                                <button
                                    onClick={() => setSelectedTab("duplicate")}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${selectedTab === "duplicate"
                                        ? "font-bold text-amber-600 bg-white shadow-sm"
                                        : "font-medium text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    📋 Trùng lặp ({dupCount})
                                </button>
                            </div>

                            {/* Search + Column Config + Delete (data tabs only) */}
                            {selectedTab !== "summary" && (
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
                                <div className="px-5 py-8 text-center text-gray-400">Không có dữ liệu tóm tắt</div>
                            );
                            const fmtNum = (v: number) => v === 0 ? "" : v.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
                            return (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse" style={{ fontVariantNumeric: "tabular-nums" }}>
                                        <thead>
                                            {/* Row 1: Group headers */}
                                            <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-center">
                                                <th className="p-3 text-left border border-gray-200 bg-slate-200 sticky left-0 z-10 text-slate-700">
                                                    Tháng
                                                </th>
                                                {pivot.ngoaiCskcb.length > 0 && (
                                                    <th className="p-2 border border-gray-200 text-blue-700 bg-blue-50/80" colSpan={pivot.ngoaiCskcb.length + 1}>
                                                        Ngoại trú
                                                    </th>
                                                )}
                                                {pivot.noiCskcb.length > 0 && (
                                                    <th className="p-2 border border-gray-200 text-orange-700 bg-orange-50/80" colSpan={pivot.noiCskcb.length + 1}>
                                                        Nội trú
                                                    </th>
                                                )}
                                                <th className="p-3 border border-gray-200 text-slate-900 bg-slate-200 min-w-[100px]">
                                                    Tổng cộng
                                                </th>
                                            </tr>
                                            {/* Row 2: Sub-headers */}
                                            <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-tight text-right text-slate-600">
                                                <th className="p-3 border border-gray-200 text-left sticky left-0 bg-slate-50 shadow-[1px_0_0_0_#e5e7eb]">
                                                    Cơ sở KCB
                                                </th>
                                                {pivot.ngoaiCskcb.map((c) => (
                                                    <th key={`h-ngoai-${c.ma}`} className="p-2 border border-gray-200">{c.ten}</th>
                                                ))}
                                                {pivot.ngoaiCskcb.length > 0 && (
                                                    <th className="p-2 border border-gray-200 bg-blue-100/50 text-blue-700">Tổng</th>
                                                )}
                                                {pivot.noiCskcb.map((c) => (
                                                    <th key={`h-noi-${c.ma}`} className="p-2 border border-gray-200">{c.ten}</th>
                                                ))}
                                                {pivot.noiCskcb.length > 0 && (
                                                    <th className="p-2 border border-gray-200 bg-orange-100/50 text-orange-700">Tổng</th>
                                                )}
                                                <th className="p-2 border border-gray-200 text-slate-800 bg-slate-100/50">Toàn viện</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {pivot.pivotRows.map((row, idx) => {
                                                const isEven = idx % 2 === 0;
                                                const bgClass = isEven ? "bg-white" : "bg-slate-50/40";
                                                const stickyBg = isEven ? "bg-white" : "bg-[#f9fafb]";
                                                return (
                                                    <tr key={idx} className={`${bgClass} hover:bg-slate-50 transition-colors`}>
                                                        <td className={`p-3 px-4 text-left font-semibold text-slate-700 sticky left-0 ${stickyBg} border border-gray-200 shadow-[1px_0_0_0_#e5e7eb]`}>
                                                            {row.thang}
                                                        </td>
                                                        {pivot.ngoaiCskcb.map((c) => (
                                                            <td key={`ngoai-${c.ma}`} className="p-3 text-right text-slate-600 border border-gray-200">
                                                                {fmtNum(row[`ngoai_${c.ma}`] as number)}
                                                            </td>
                                                        ))}
                                                        {pivot.ngoaiCskcb.length > 0 && (
                                                            <td className="p-3 text-right font-bold text-blue-800 bg-blue-50/40 border border-gray-200">
                                                                {fmtNum(row["ngoai_tong"] as number)}
                                                            </td>
                                                        )}
                                                        {pivot.noiCskcb.map((c) => (
                                                            <td key={`noi-${c.ma}`} className="p-3 text-right text-slate-600 border border-gray-200">
                                                                {fmtNum(row[`noi_${c.ma}`] as number)}
                                                            </td>
                                                        ))}
                                                        {pivot.noiCskcb.length > 0 && (
                                                            <td className="p-3 text-right font-bold text-orange-800 bg-orange-50/40 border border-gray-200">
                                                                {fmtNum(row["noi_tong"] as number)}
                                                            </td>
                                                        )}
                                                        <td className="p-3 text-right font-bold text-slate-900 bg-slate-50/80 border border-gray-200">
                                                            {fmtNum(row["tong_cong"] as number)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-indigo-50/80 text-slate-800 text-sm">
                                            <tr className="font-medium border-t-2 border-slate-300">
                                                <td className="p-4 px-4 sticky left-0 bg-indigo-50 border border-gray-200 font-bold shadow-[1px_0_0_0_#e5e7eb]">
                                                    TỔNG
                                                </td>
                                                {pivot.ngoaiCskcb.map((c) => {
                                                    const total = pivot.pivotRows.reduce(
                                                        (s, r) => s + ((r[`ngoai_${c.ma}`] as number) || 0), 0
                                                    );
                                                    return (
                                                        <td key={`t-ngoai-${c.ma}`} className="p-4 text-right border border-gray-200">
                                                            {fmtNum(total)}
                                                        </td>
                                                    );
                                                })}
                                                {pivot.ngoaiCskcb.length > 0 && (
                                                    <td className="p-4 text-right border border-gray-200 bg-blue-100/40 font-bold">
                                                        {fmtNum(pivot.grandNgoai)}
                                                    </td>
                                                )}
                                                {pivot.noiCskcb.map((c) => {
                                                    const total = pivot.pivotRows.reduce(
                                                        (s, r) => s + ((r[`noi_${c.ma}`] as number) || 0), 0
                                                    );
                                                    return (
                                                        <td key={`t-noi-${c.ma}`} className="p-4 text-right border border-gray-200">
                                                            {fmtNum(total)}
                                                        </td>
                                                    );
                                                })}
                                                {pivot.noiCskcb.length > 0 && (
                                                    <td className="p-4 text-right border border-gray-200 bg-orange-100/40 font-bold">
                                                        {fmtNum(pivot.grandNoi)}
                                                    </td>
                                                )}
                                                <td className="p-4 text-right bg-indigo-100 border border-gray-200 font-bold">
                                                    {fmtNum(pivot.grandNgoai + pivot.grandNoi)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            );
                        })()}

                        {/* ── Tab content: Data tables (valid / duplicate) ── */}
                        {selectedTab !== "summary" && (
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
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang ghi đè...</>
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
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang tải lên...</>
                                            ) : (
                                                `☁️ Tải lên mới (${checkedNewCount})`
                                            )}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
