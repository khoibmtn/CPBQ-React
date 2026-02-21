"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    const [pageInputValue, setPageInputValue] = useState("1");

    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

    const safePage = Math.min(currentPage, totalPages - 1);
    if (safePage !== currentPage) setCurrentPage(safePage);

    useEffect(() => {
        setPageInputValue(String(safePage + 1));
    }, [safePage]);

    const startIdx = safePage * pageSize;
    const endIdx = Math.min(startIdx + pageSize, data.length);
    const pageData = useMemo(
        () => data.slice(startIdx, endIdx),
        [data, startIdx, endIdx]
    );

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
            <div className="text-center py-8 text-gray-400 text-sm">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="data-table-container">
            <div className={`data-table-wrapper ${stickyHeader ? "sticky-header" : ""}`}>
                <table className="data-table data-table-compact w-full text-sm border-collapse">
                    <thead>
                        <tr>
                            {selectable && (
                                <th className="w-10 text-center border px-2 py-2" style={{ background: 'var(--color-primary-200)', borderColor: 'var(--color-primary-300)' }}>
                                    <input
                                        type="checkbox"
                                        checked={allPageSelected}
                                        onChange={handleSelectAll}
                                        title="Chọn tất cả trang này"
                                        className="accent-primary-600"
                                    />
                                </th>
                            )}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className="font-semibold text-xs uppercase tracking-wider border px-2.5 py-2"
                                    style={{
                                        background: 'var(--color-primary-200)',
                                        color: 'var(--color-primary-900)',
                                        borderColor: 'var(--color-primary-300)',
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
                                    className={`
                                        ${localIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                                        ${isSelected ? "row-selected" : ""}
                                        ${extraClass}
                                        hover:bg-gray-50 transition-colors
                                    `}
                                >
                                    {selectable && (
                                        <td className="text-center border border-gray-100 px-2 py-1.5">
                                            <input
                                                type="checkbox"
                                                checked={!!isSelected}
                                                disabled={!!isDisabled}
                                                onChange={() =>
                                                    handleSelectRow(globalIdx)
                                                }
                                                className="accent-primary-600"
                                            />
                                        </td>
                                    )}
                                    {columns.map((col) => {
                                        const val = row[col.key];
                                        return (
                                            <td
                                                key={col.key}
                                                className="border border-gray-100 px-2.5 py-1.5 text-gray-700"
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
            <div className="flex items-center gap-4 px-3 py-2 mt-2 rounded-lg bg-white border border-gray-200 text-xs text-gray-500">
                <div className="flex items-center gap-1.5 shrink-0">
                    <span>Hiển thị</span>
                    <select
                        value={pageSize}
                        onChange={(e) =>
                            handlePageSizeChange(+e.target.value)
                        }
                        className="rounded-md border-gray-300 text-xs py-1 pl-1.5 pr-7 focus:border-primary-500 focus:ring-primary-500"
                    >
                        {pageSizeOptions.map((s) => (
                            <option key={s} value={s}>
                                {s} dòng
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors cursor-pointer"
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="flex items-center gap-1">
                        Trang{" "}
                        <input
                            type="text"
                            inputMode="numeric"
                            className="w-8 text-center py-0.5 px-1 border border-gray-300 rounded text-xs font-bold focus:border-primary-500 focus:ring-primary-500"
                            value={pageInputValue}
                            onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, "");
                                setPageInputValue(raw);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    const num = parseInt(pageInputValue, 10);
                                    if (!isNaN(num)) {
                                        const clamped = Math.max(1, Math.min(totalPages, num));
                                        setCurrentPage(clamped - 1);
                                        setPageInputValue(String(clamped));
                                    }
                                }
                            }}
                            onBlur={() => setPageInputValue(String(safePage + 1))}
                        />
                        {" "}/ {totalPages}
                    </span>
                    <button
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors cursor-pointer"
                        onClick={() =>
                            setCurrentPage((p) =>
                                Math.min(totalPages - 1, p + 1)
                            )
                        }
                        disabled={safePage >= totalPages - 1}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="ml-auto whitespace-nowrap text-gray-400 text-[11px]">
                    {startIdx + 1}–{endIdx} / {data.length.toLocaleString()} dòng
                    {selectable && selectedRows && selectedRows.size > 0 && (
                        <span className="text-primary-600 font-semibold">
                            {" · "}Đã chọn <strong>{selectedRows.size}</strong>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
