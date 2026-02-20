"use client";

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

    return (
        <div className="search-builder">
            {conditions.map((cond, i) => (
                <div key={i} className="search-condition-row">
                    {/* AND/OR operator (between conditions) */}
                    {i >= 1 && (
                        <div className="search-operator">
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name={`op-${i}`}
                                    value="AND"
                                    checked={cond.operator === "AND"}
                                    onChange={() =>
                                        updateCondition(i, "operator", "AND")
                                    }
                                />
                                AND
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name={`op-${i}`}
                                    value="OR"
                                    checked={cond.operator === "OR"}
                                    onChange={() =>
                                        updateCondition(i, "operator", "OR")
                                    }
                                />
                                OR
                            </label>
                        </div>
                    )}

                    <div className="search-fields">
                        {/* Field dropdown */}
                        <select
                            className="form-select"
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

                        {/* Keyword input */}
                        <input
                            type="search"
                            className="form-input"
                            value={cond.keyword}
                            placeholder={`Tìm trong "${cond.field}"...`}
                            onChange={(e) =>
                                updateCondition(i, "keyword", e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                        />

                        {/* Action buttons */}
                        <div className="search-actions">
                            {i === conditions.length - 1 && (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={addCondition}
                                    title="Thêm điều kiện"
                                >
                                    ➕
                                </button>
                            )}
                            {i >= 1 && (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => removeCondition(i)}
                                    title="Xóa điều kiện"
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
                <button
                    className="btn btn-primary"
                    onClick={onSearch}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="spinner" /> Đang tìm...
                        </>
                    ) : (
                        "🔍 Tìm kiếm"
                    )}
                </button>
                {extraButtons}
            </div>
        </div>
    );
}
