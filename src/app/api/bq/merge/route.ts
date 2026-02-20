/**
 * Merge Groups CRUD API
 * GET  → Load merge groups + khoa options
 * PUT  → Save merge groups (DELETE + INSERT)
 */

import { NextRequest, NextResponse } from "next/server";
import { runQuery, getBqClient } from "@/lib/bigquery";
import { getFullTableId, LOOKUP_KHOA_MERGE_TABLE, LOOKUP_KHOA_TABLE } from "@/lib/config";

const MERGE_ID = getFullTableId(LOOKUP_KHOA_MERGE_TABLE);

async function ensureTable() {
    const client = getBqClient();
    const sql = `
        CREATE TABLE IF NOT EXISTS \`${MERGE_ID}\` (
            target_khoa STRING NOT NULL,
            source_khoa STRING NOT NULL
        )
    `;
    await client.query({ query: sql });
}

export async function GET() {
    try {
        await ensureTable();

        // Load merge groups
        const mergeRows = await runQuery<{
            target_khoa: string;
            source_khoa: string;
        }>(`SELECT target_khoa, source_khoa FROM \`${MERGE_ID}\` ORDER BY target_khoa, source_khoa`);

        const groupMap: Record<string, string[]> = {};
        for (const row of mergeRows) {
            if (!groupMap[row.target_khoa]) groupMap[row.target_khoa] = [];
            groupMap[row.target_khoa].push(row.source_khoa);
        }
        const groups = Object.entries(groupMap).map(([target_khoa, sources]) => ({
            target_khoa,
            sources,
        }));

        // Load khoa options for dropdowns
        const khoaFullId = getFullTableId(LOOKUP_KHOA_TABLE);
        const khoaRows = await runQuery<{
            makhoa_xml: string;
            short_name: string;
            valid_from: number | null;
            valid_to: number | null;
            thu_tu: number | null;
        }>(
            `SELECT makhoa_xml, short_name, valid_from, valid_to, thu_tu FROM \`${khoaFullId}\` ORDER BY short_name, makhoa_xml, valid_from`
        );

        const khoaOptions = khoaRows.map((row) => {
            const vf = row.valid_from;
            const vt = row.valid_to;
            const vfStr = vf
                ? `${String(Math.floor((vf % 10000) / 100)).padStart(2, "0")}/${String(vf).slice(2, 4)}`
                : "?";
            const vtStr = vt
                ? `${String(Math.floor((vt % 10000) / 100)).padStart(2, "0")}/${String(vt).slice(2, 4)}`
                : "...";
            return {
                short_name: row.short_name,
                makhoa: row.makhoa_xml,
                display: `${row.makhoa_xml} ${row.short_name} (${vfStr} → ${vtStr})`,
                valid_from: vf,
                valid_to: vt,
                thu_tu: row.thu_tu,
            };
        });

        return NextResponse.json({ groups, khoaOptions });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        await ensureTable();
        const { groups } = await req.json();
        if (!Array.isArray(groups)) {
            return NextResponse.json({ error: "groups must be an array" }, { status: 400 });
        }

        const client = getBqClient();

        // Delete all
        await client.query({ query: `DELETE FROM \`${MERGE_ID}\` WHERE TRUE` });

        // Insert new
        const allRows: string[] = [];
        for (const g of groups) {
            for (const src of g.sources) {
                allRows.push(`('${g.target_khoa}', '${src}')`);
            }
        }

        if (allRows.length > 0) {
            await client.query({
                query: `INSERT INTO \`${MERGE_ID}\` (target_khoa, source_khoa) VALUES ${allRows.join(", ")}`,
            });
        }

        return NextResponse.json({ success: true, count: groups.length });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}
