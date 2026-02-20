import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { FULL_TABLE_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Get recent uploads by timestamp
        const query = `
            SELECT upload_timestamp, source_file, COUNT(*) as row_count,
                   ARRAY_AGG(DISTINCT nam_qt ORDER BY nam_qt) as years,
                   ARRAY_AGG(DISTINCT thang_qt ORDER BY thang_qt) as months,
                   ARRAY_AGG(DISTINCT ma_cskcb ORDER BY ma_cskcb) as cskcb_list
            FROM \`${FULL_TABLE_ID}\`
            GROUP BY upload_timestamp, source_file
            ORDER BY upload_timestamp DESC
            LIMIT 20
        `;
        const rows = await runQuery(query);

        // Also get sample rows from latest upload
        const latestQuery = `
            SELECT stt, ma_bn, ho_ten, nam_qt, thang_qt, ma_cskcb, upload_timestamp
            FROM \`${FULL_TABLE_ID}\`
            ORDER BY upload_timestamp DESC
            LIMIT 20
        `;
        const latestRows = await runQuery(latestQuery);

        return NextResponse.json({ uploads: rows, latestRows });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
