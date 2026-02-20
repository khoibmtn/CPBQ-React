/**
 * Profiles CRUD API
 * GET                  → List profile names
 * GET ?name=xxx        → Load profile data
 * POST { name, items } → Save profile (delete + insert)
 * DELETE ?name=xxx     → Delete profile
 */

import { NextRequest, NextResponse } from "next/server";
import { runQuery, getBqClient } from "@/lib/bigquery";
import { getFullTableId, LOOKUP_PROFILES_TABLE } from "@/lib/config";

const FULL_ID = getFullTableId(LOOKUP_PROFILES_TABLE);

async function ensureTable() {
    const client = getBqClient();
    const sql = `
        CREATE TABLE IF NOT EXISTS \`${FULL_ID}\` (
            profile_name STRING NOT NULL,
            metric_key STRING NOT NULL,
            thu_tu INT64,
            visible BOOL
        )
    `;
    await client.query({ query: sql });
}

export async function GET(req: NextRequest) {
    try {
        await ensureTable();
        const name = req.nextUrl.searchParams.get("name");

        if (name) {
            // Load specific profile
            const rows = await runQuery(
                `SELECT metric_key, thu_tu, visible FROM \`${FULL_ID}\` WHERE profile_name = '${name}' ORDER BY thu_tu`
            );
            return NextResponse.json({ items: rows });
        }

        // List profile names
        const rows = await runQuery(
            `SELECT DISTINCT profile_name FROM \`${FULL_ID}\` ORDER BY profile_name`
        );
        const names = rows.map((r: Record<string, unknown>) => r.profile_name as string);
        return NextResponse.json({ names });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        await ensureTable();
        const { name, items } = await req.json();
        if (!name || !Array.isArray(items)) {
            return NextResponse.json({ error: "name and items required" }, { status: 400 });
        }

        const client = getBqClient();

        // Delete existing
        await client.query({
            query: `DELETE FROM \`${FULL_ID}\` WHERE profile_name = '${name}'`,
        });

        // Insert new
        if (items.length > 0) {
            const values = items.map(
                (it: { metric_key: string; thu_tu: number; visible: boolean }) =>
                    `('${name}', '${it.metric_key}', ${it.thu_tu}, ${it.visible})`
            );
            await client.query({
                query: `INSERT INTO \`${FULL_ID}\` (profile_name, metric_key, thu_tu, visible) VALUES ${values.join(", ")}`,
            });
        }

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const name = req.nextUrl.searchParams.get("name");
        if (!name) {
            return NextResponse.json({ error: "name required" }, { status: 400 });
        }

        const client = getBqClient();
        await client.query({
            query: `DELETE FROM \`${FULL_ID}\` WHERE profile_name = '${name}'`,
        });

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}
