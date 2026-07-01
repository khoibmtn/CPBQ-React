import { NextRequest, NextResponse } from "next/server";
import { runQuery, getBqClient } from "@/lib/bigquery";
import { getFullTableId, APP_SETTINGS_TABLE } from "@/lib/config";

const FULL_ID = getFullTableId(APP_SETTINGS_TABLE);

async function ensureTable() {
    const client = getBqClient();
    const sql = `
        CREATE TABLE IF NOT EXISTS \`${FULL_ID}\` (
            setting_key STRING NOT NULL,
            setting_value STRING NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
        )
    `;
    await client.query({ query: sql });
}

export async function GET(req: NextRequest) {
    try {
        await ensureTable();
        const key = req.nextUrl.searchParams.get("key");

        if (!key) {
            return NextResponse.json({ error: "key required" }, { status: 400 });
        }

        const rows = await runQuery(
            `SELECT setting_value FROM \`${FULL_ID}\` WHERE setting_key = '${key}' ORDER BY updated_at DESC LIMIT 1`
        );

        if (rows.length === 0) {
            return NextResponse.json({ value: null });
        }

        let parsedValue = rows[0].setting_value as string;
        try {
            parsedValue = JSON.parse(rows[0].setting_value as string);
        } catch {
            // keep as string if not JSON
        }

        return NextResponse.json({ value: parsedValue });
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
        const { key, value } = await req.json();

        if (!key) {
            return NextResponse.json({ error: "key required" }, { status: 400 });
        }

        const client = getBqClient();
        const stringValue = typeof value === "string" ? value : JSON.stringify(value);
        
        // Escape quotes
        const safeValue = stringValue.replace(/'/g, "\\'");

        // Delete existing key
        await client.query({
            query: `DELETE FROM \`${FULL_ID}\` WHERE setting_key = '${key}'`,
        });

        // Insert new
        await client.query({
            query: `INSERT INTO \`${FULL_ID}\` (setting_key, setting_value, updated_at) VALUES ('${key}', '${safeValue}', CURRENT_TIMESTAMP())`,
        });

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}
