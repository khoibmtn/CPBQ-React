"use client";

import { Plus, Trash2, Search, Loader2 } from "lucide-react";

export interface SearchCondition {
    field: string;
    keyword: string;
    operator: "AND" | "OR";
}

interface SearchBuilderProps {
    columns: string[];
    conditions: SearchCondition[];
    onConditionsChange: (conditions: SearchCondition[]) => void;
    onSearch: () => void;
    loading?: boolean;
    extraButtons?: React.ReactNode;
}

export default function SearchBuilder({
    columns,
    conditions,
    onConditionsChange,
    onSearch,
    loading = false,
    extraButtons,
}: SearchBuilderProps) {
    const updateCondition = (
        index: number,
        field: keyof SearchCondition,
        value: string
    ) => {
        const updated = [...conditions];
        updated[index] = { ...updated[index], [field]: value };
        onConditionsChange(updated);
    };

    const addCondition = () => {
        onConditionsChange([
            ...conditions,
            { field: columns[0] || "", keyword: "", operator: "AND" },
        ]);
    };

    const removeCondition = (index: number) => {
        if (conditions.length <= 1) return;
        onConditionsChange(conditions.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            onSearch();
        }
    };

    const selectClasses = "rounded-lg border-gray-300 text-sm py-2 px-3 focus:border-primary-500 focus:ring-primary-500 w-[180px] shrink-0";
    const inputClasses = "rounded-lg border-gray-300 text-sm py-2 px-3 focus:border-primary-500 focus:ring-primary-500 flex-1";

    return (
        <div className="mb-3">
            {conditions.map((cond, i) => (
                <div key={i} className="mb-2">
                    {i >= 1 && (
                        <div className="flex gap-4 mb-1 pl-1">
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 cursor-pointer">
                                <input
                                    type="radio"
                                    name={`op-${i}`}
                                    value="AND"
                                    checked={cond.operator === "AND"}
                                    onChange={() =>
                                        updateCondition(i, "operator", "AND")
                                    }
                                    className="accent-primary-600"
                                />
                                AND
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 cursor-pointer">
                                <input
                                    type="radio"
                                    name={`op-${i}`}
                                    value="OR"
                                    checked={cond.operator === "OR"}
                                    onChange={() =>
                                        updateCondition(i, "operator", "OR")
                                    }
                                    className="accent-primary-600"
                                />
                                OR
                            </label>
                        </div>
                    )}

                    <div className="flex gap-2 items-center">
                        <select
                            className={selectClasses}
                            value={cond.field}
                            onChange={(e) =>
                                updateCondition(i, "field", e.target.value)
                            }
                        >
                            {columns.map((col) => (
                                <option key={col} value={col}>
                                    {col}
                                </option>
                            ))}
                        </select>

                        <input
                            type="search"
                            className={inputClasses}
                            value={cond.keyword}
                            placeholder={`Tìm trong "${cond.field}"...`}
                            onChange={(e) =>
                                updateCondition(i, "keyword", e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                        />

                        <div className="flex gap-1 shrink-0">
                            {i === conditions.length - 1 && (
                                <button
                                    className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
                                    onClick={addCondition}
                                    title="Thêm điều kiện"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            )}
                            {i >= 1 && (
                                <button
                                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                    onClick={() => removeCondition(i)}
                                    title="Xóa điều kiện"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            <div className="flex items-center gap-3 mt-3">
                <button
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                    onClick={onSearch}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Đang tìm...
                        </>
                    ) : (
                        <>
                            <Search className="w-4 h-4" /> Tìm kiếm
                        </>
                    )}
                </button>
                {extraButtons}
            </div>
        </div>
    );
}
