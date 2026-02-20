"use client";

import { useState, useMemo } from "react";

export interface Column {
    key: string;
    label: string;
    align?: "left" | "center" | "right";
    width?: number;
    render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface DataTableProps {
    columns: Column[];
    data: Record<string, unknown>[];
    pageSize?: number;
    pageSizeOptions?: number[];
    selectable?: boolean;
    selectedRows?: Set<number>;
    disabledRows?: Set<number>;
    onSelectionChange?: (selected: Set<number>) => void;
    emptyMessage?: string;
    stickyHeader?: boolean;
    rowClassName?: (globalIdx: number) => string;
}

export default function DataTable({
    columns,
    data,
    pageSize: initialPageSize = 20,
    pageSizeOptions = [10, 20, 30, 50, 100],
    selectable = false,
    selectedRows,
    disabledRows,
    onSelectionChange,
    emptyMessage = "Không có dữ liệu",
    stickyHeader = false,
    rowClassName,
}: DataTableProps) {
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [currentPage, setCurrentPage] = useState(0);

    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

    // Reset page if out of bounds
    const safePage = Math.min(currentPage, totalPages - 1);
    if (safePage !== currentPage) setCurrentPage(safePage);

    const startIdx = safePage * pageSize;
    const endIdx = Math.min(startIdx + pageSize, data.length);
    const pageData = useMemo(
        () => data.slice(startIdx, endIdx),
        [data, startIdx, endIdx]
    );

    // Selectable rows on this page (excluding disabled)
    const selectablePageIndices = useMemo(() => {
        const indices: number[] = [];
        for (let i = startIdx; i < endIdx; i++) {
            if (!disabledRows?.has(i)) indices.push(i);
        }
        return indices;
    }, [startIdx, endIdx, disabledRows]);

    const allPageSelected =
        selectable &&
        selectablePageIndices.length > 0 &&
        selectablePageIndices.every((i) => selectedRows?.has(i));

    const handleSelectAll = () => {
        if (!onSelectionChange) return;
        const newSet = new Set(selectedRows);
        if (allPageSelected) {
            for (const i of selectablePageIndices) newSet.delete(i);
        } else {
            for (const i of selectablePageIndices) newSet.add(i);
        }
        onSelectionChange(newSet);
    };

    const handleSelectRow = (globalIdx: number) => {
        if (!onSelectionChange) return;
        const newSet = new Set(selectedRows);
        if (newSet.has(globalIdx)) {
            newSet.delete(globalIdx);
        } else {
            newSet.add(globalIdx);
        }
        onSelectionChange(newSet);
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(0);
    };

    if (data.length === 0) {
        return (
            <div className="data-table-empty">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="data-table-container">
            <div className={`data-table-wrapper ${stickyHeader ? "sticky-header" : ""}`}>
                <table className="data-table data-table-compact">
                    <thead>
                        <tr>
                            {selectable && (
                                <th style={{ width: 40, textAlign: "center" }}>
                                    <input
                                        type="checkbox"
                                        checked={allPageSelected}
                                        onChange={handleSelectAll}
                                        title="Chọn tất cả trang này"
                                    />
                                </th>
                            )}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    style={{
                                        textAlign: col.align || "left",
                                        width: col.width,
                                    }}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pageData.map((row, localIdx) => {
                            const globalIdx = startIdx + localIdx;
                            const isSelected = selectedRows?.has(globalIdx);
                            const isDisabled = disabledRows?.has(globalIdx);
                            const extraClass = rowClassName ? rowClassName(globalIdx) : "";
                            return (
                                <tr
                                    key={globalIdx}
                                    className={`${localIdx % 2 === 0 ? "row-even" : "row-odd"} ${isSelected ? "row-selected" : ""} ${extraClass}`}
                                >
                                    {selectable && (
                                        <td style={{ textAlign: "center" }}>
                                            <input
                                                type="checkbox"
                                                checked={!!isSelected}
                                                disabled={!!isDisabled}
                                                onChange={() =>
                                                    handleSelectRow(globalIdx)
                                                }
                                            />
                                        </td>
                                    )}
                                    {columns.map((col) => {
                                        const val = row[col.key];
                                        return (
                                            <td
                                                key={col.key}
                                                style={{
                                                    textAlign:
                                                        col.align || "left",
                                                }}
                                            >
                                                {col.render
                                                    ? col.render(val, row)
                                                    : val != null
                                                        ? (typeof val === "object" && val !== null && "value" in (val as Record<string, unknown>))
                                                            ? String((val as Record<string, unknown>).value)
                                                            : String(val)
                                                        : ""}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="pagination-bar">
                <div className="pagination-size">
                    <select
                        value={pageSize}
                        onChange={(e) =>
                            handlePageSizeChange(+e.target.value)
                        }
                        className="form-select form-select-sm"
                    >
                        {pageSizeOptions.map((s) => (
                            <option key={s} value={s}>
                                {s} dòng
                            </option>
                        ))}
                    </select>
                </div>

                <div className="pagination-nav">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                    >
                        ◀
                    </button>
                    <span className="pagination-info">
                        Trang <strong>{safePage + 1}</strong> / {totalPages}
                    </span>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                            setCurrentPage((p) =>
                                Math.min(totalPages - 1, p + 1)
                            )
                        }
                        disabled={safePage >= totalPages - 1}
                    >
                        ▶
                    </button>
                </div>

                <div className="pagination-summary">
                    {startIdx + 1}–{endIdx} / {data.length.toLocaleString()} dòng
                    {selectable && selectedRows && selectedRows.size > 0 && (
                        <span className="pagination-selected">
                            {" · "}Đã chọn <strong>{selectedRows.size}</strong>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
