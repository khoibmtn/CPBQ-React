"use client";

import { useState, useEffect, useCallback } from "react";

interface Column {
    key: string;
    label: string;
    type: "text" | "number";
    help?: string;
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

    const handleCellChange = (rowIdx: number, colKey: string, value: string) => {
        setRows((prev) => {
            const updated = [...prev];
            const col = columns.find((c) => c.key === colKey);
            updated[rowIdx] = {
                ...updated[rowIdx],
                [colKey]: col?.type === "number" ? (value === "" ? null : Number(value)) : value,
            };
            return updated;
        });
    };

    const addRow = () => {
        const newRow: Record<string, unknown> = {};
        columns.forEach((col) => {
            newRow[col.key] = col.type === "number" ? null : "";
        });
        setRows((prev) => [...prev, newRow]);
    };

    const deleteRow = (idx: number) => {
        setRows((prev) => prev.filter((_, i) => i !== idx));
    };

    const saveData = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/bq/lookup", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ table: tableName, rows }),
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

    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="spinner" /> Đang tải dữ liệu...
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    <code>{tableName}</code> · {rows.length} dòng
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn btn-primary btn-sm" onClick={saveData} disabled={saving}>
                        {saving ? "⏳ Đang lưu..." : "💾 Lưu"}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={loadData}>
                        🔄 Tải lại
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={addRow}>
                        ➕ Thêm dòng
                    </button>
                </div>
            </div>

            {error && <div className="info-banner error" style={{ marginBottom: "0.75rem" }}>❌ {error}</div>}
            {success && <div className="info-banner success" style={{ marginBottom: "0.75rem" }}>{success}</div>}

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40, textAlign: "center" }}>#</th>
                            {columns.map((col) => (
                                <th key={col.key} title={col.help}>{col.label}</th>
                            ))}
                            <th style={{ width: 50 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? "row-even" : "row-odd"}>
                                <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>{ri + 1}</td>
                                {columns.map((col) => (
                                    <td key={col.key} style={{ padding: "2px 4px" }}>
                                        <input
                                            className="form-input"
                                            type={col.type === "number" ? "number" : "text"}
                                            value={row[col.key] === null || row[col.key] === undefined ? "" : String(row[col.key])}
                                            onChange={(e) => handleCellChange(ri, col.key, e.target.value)}
                                            style={{ width: "100%", padding: "4px 8px", fontSize: "0.8rem" }}
                                        />
                                    </td>
                                ))}
                                <td style={{ textAlign: "center" }}>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => deleteRow(ri)}
                                        title="Xóa dòng"
                                        style={{ padding: "2px 6px", fontSize: "0.75rem", color: "var(--error)", background: "transparent", border: "none" }}
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={columns.length + 2} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
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
