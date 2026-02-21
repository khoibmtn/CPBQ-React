"use client";
import { Loader2, Pencil, Trash2, Check, X } from "lucide-react";

import { useState, useEffect, useCallback } from "react";

interface Column {
    key: string;
    label: string;
    type: "text" | "number";
    help?: string;
    width?: string;
}

interface LookupEditorProps {
    tableName: string;
    columns: Column[];
}

export default function LookupEditor({ tableName, columns }: LookupEditorProps) {
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [editingIdx, setEditingIdx] = useState<number>(-1);
    const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/bq/lookup?table=${tableName}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setRows(data.rows || []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
        } finally {
            setLoading(false);
        }
    }, [tableName]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const startEdit = (idx: number) => {
        setEditingIdx(idx);
        setEditDraft({ ...rows[idx] });
    };

    const cancelEdit = () => {
        if (editingIdx >= 0 && editDraft.__isNew) {
            setRows((prev) => prev.filter((_, i) => i !== editingIdx));
        }
        setEditingIdx(-1);
        setEditDraft({});
    };

    const confirmEdit = () => {
        if (editingIdx < 0) return;
        setRows((prev) => {
            const updated = [...prev];
            const { __isNew, ...cleanDraft } = editDraft as Record<string, unknown> & { __isNew?: boolean };
            void __isNew;
            updated[editingIdx] = cleanDraft;
            return updated;
        });
        setEditingIdx(-1);
        setEditDraft({});
    };

    const handleDraftChange = (colKey: string, value: string) => {
        const col = columns.find((c) => c.key === colKey);
        setEditDraft((prev) => ({
            ...prev,
            [colKey]: col?.type === "number" ? (value === "" ? null : Number(value)) : value,
        }));
    };

    const addRow = () => {
        const newRow: Record<string, unknown> = { __isNew: true };
        columns.forEach((col) => {
            newRow[col.key] = col.type === "number" ? null : "";
        });
        setRows((prev) => [...prev, newRow]);
        setEditingIdx(rows.length);
        setEditDraft({ ...newRow });
    };

    const deleteRow = (idx: number) => {
        setRows((prev) => prev.filter((_, i) => i !== idx));
        if (editingIdx === idx) {
            setEditingIdx(-1);
            setEditDraft({});
        }
    };

    const saveData = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const cleanRows = rows.map((r) => {
                const { __isNew, ...rest } = r as Record<string, unknown> & { __isNew?: boolean };
                void __isNew;
                return rest;
            });
            const res = await fetch("/api/bq/lookup", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ table: tableName, rows: cleanRows }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSuccess(`✅ Đã lưu ${data.count} dòng vào ${tableName}!`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi lưu dữ liệu");
        } finally {
            setSaving(false);
        }
    };

    const fmtCell = (value: unknown): string => {
        if (value === null || value === undefined || value === "") return "—";
        return String(value);
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dữ liệu...
            </div>
        );
    }

    /* ── Styles ── */
    const tableStyle: React.CSSProperties = {
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        fontSize: "0.85rem",
    };

    const thStyle: React.CSSProperties = {
        backgroundColor: "#f8fafc",
        borderTop: "1px solid #e2e8f0",
        borderBottom: "2px solid #e2e8f0",
        padding: "10px 12px",
        fontWeight: 600,
        fontSize: "0.8rem",
        color: "#475569",
        textAlign: "left",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
    };

    const tdStyle = (ri: number): React.CSSProperties => ({
        padding: "10px 12px",
        borderBottom: "1px solid #f1f5f9",
        backgroundColor: ri % 2 === 0 ? "#ffffff" : "#f8fafc",
        verticalAlign: "middle",
    });

    const editTdStyle = (ri: number): React.CSSProperties => ({
        ...tdStyle(ri),
        padding: "6px 8px",
        backgroundColor: ri % 2 === 0 ? "#fffbeb" : "#fef9e7",
    });

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "5px 8px",
        fontSize: "0.85rem",
        border: "1px solid #d1d5db",
        borderRadius: "6px",
        outline: "none",
        backgroundColor: "#fff",
        boxSizing: "border-box",
    };

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    <code>{tableName}</code> · {rows.length} dòng
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer" onClick={saveData} disabled={saving}>
                        {saving ? "⏳ Đang lưu..." : "💾 Lưu"}
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer" onClick={loadData}>
                        🔄 Tải lại
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer" onClick={addRow} disabled={editingIdx >= 0}>
                        ➕ Thêm dòng
                    </button>
                </div>
            </div>

            {error && <div className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-700 text-sm" style={{ marginBottom: "0.75rem" }}>❌ {error}</div>}
            {success && <div className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-700 text-sm" style={{ marginBottom: "0.75rem" }}>{success}</div>}

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                <table style={tableStyle}>
                    <colgroup>
                        <col style={{ width: "48px" }} />
                        {columns.map((col) => (
                            <col key={col.key} style={col.width ? { width: col.width } : undefined} />
                        ))}
                        <col style={{ width: "90px" }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, textAlign: "center", width: "48px" }}>#</th>
                            {columns.map((col) => (
                                <th key={col.key} style={thStyle} title={col.help}>{col.label}</th>
                            ))}
                            <th style={{ ...thStyle, textAlign: "center", width: "90px" }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => {
                            const isEditing = editingIdx === ri;
                            const cellStyle = isEditing ? editTdStyle(ri) : tdStyle(ri);

                            return (
                                <tr
                                    key={ri}
                                    style={{ transition: "background-color 0.15s" }}
                                    onMouseEnter={(e) => { if (!isEditing) (e.currentTarget.style.backgroundColor = "#f0f4ff"); }}
                                    onMouseLeave={(e) => { if (!isEditing) (e.currentTarget.style.backgroundColor = ""); }}
                                >
                                    <td style={{ ...cellStyle, textAlign: "center", color: "#94a3b8", fontWeight: 500 }}>{ri + 1}</td>

                                    {columns.map((col) => (
                                        <td key={col.key} style={cellStyle}>
                                            {isEditing ? (
                                                <input
                                                    type={col.type === "number" ? "number" : "text"}
                                                    value={editDraft[col.key] === null || editDraft[col.key] === undefined ? "" : String(editDraft[col.key])}
                                                    onChange={(e) => handleDraftChange(col.key, e.target.value)}
                                                    style={inputStyle}
                                                    autoFocus={col === columns[0]}
                                                />
                                            ) : (
                                                <span style={{ color: row[col.key] ? "#1e293b" : "#cbd5e1" }}>
                                                    {fmtCell(row[col.key])}
                                                </span>
                                            )}
                                        </td>
                                    ))}

                                    <td style={{ ...cellStyle, textAlign: "center" }}>
                                        {isEditing ? (
                                            <div style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
                                                <button
                                                    onClick={confirmEdit}
                                                    title="Xác nhận"
                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    title="Hủy"
                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
                                                <button
                                                    onClick={() => startEdit(ri)}
                                                    title="Sửa"
                                                    disabled={editingIdx >= 0}
                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteRow(ri)}
                                                    title="Xóa"
                                                    disabled={editingIdx >= 0}
                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={columns.length + 2} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                                    Chưa có dữ liệu. Nhấn &quot;➕ Thêm dòng&quot; để bắt đầu.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
