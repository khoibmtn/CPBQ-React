/**
 * Lookup table CRUD API
 * GET ?table=lookup_loaikcb  → Load table data
 * PUT { table, data }       → Save (WRITE_TRUNCATE)
 */

import { NextRequest, NextResponse } from "next/server";
import { runQuery, getBqClient } from "@/lib/bigquery";
import { getFullTableId } from "@/lib/config";

const ALLOWED_TABLES = ["lookup_loaikcb", "lookup_cskcb", "lookup_khoa"];

export async function GET(req: NextRequest) {
    try {
        const table = req.nextUrl.searchParams.get("table");
        if (!table || !ALLOWED_TABLES.includes(table)) {
            return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
        }
        const fullId = getFullTableId(table);
        const rows = await runQuery(`SELECT * FROM \`${fullId}\` ORDER BY 1`);
        return NextResponse.json({ rows });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { table, rows } = await req.json();
        if (!table || !ALLOWED_TABLES.includes(table)) {
            return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
        }
        if (!Array.isArray(rows)) {
            return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
        }

        const client = getBqClient();
        const fullId = getFullTableId(table);

        // Delete all + insert new rows
        await client.query({ query: `DELETE FROM \`${fullId}\` WHERE TRUE` });

        if (rows.length > 0) {
            // Build insert query
            const columns = Object.keys(rows[0]);
            const values = rows.map((row) => {
                const vals = columns.map((col) => {
                    const v = row[col];
                    if (v === null || v === undefined || v === "") return "NULL";
                    if (typeof v === "number") return String(v);
                    return `'${String(v).replace(/'/g, "\\'")}'`;
                });
                return `(${vals.join(", ")})`;
            });

            const insertSql = `INSERT INTO \`${fullId}\` (${columns.join(", ")}) VALUES ${values.join(", ")}`;
            await client.query({ query: insertSql });
        }

        return NextResponse.json({ success: true, count: rows.length });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}
