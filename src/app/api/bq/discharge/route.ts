import { NextResponse } from "next/server";
import { getBqClient } from "@/lib/bigquery";
import { FULL_TABLE_ID } from "@/lib/config";

export const maxDuration = 30;

/* ═══════════════════════════════════════════════════════════════════════════════
   POST /api/bq/discharge — read-only discharge lookup by mã KCB (ma_bn)
   Body:    { ids: string[] }   (max 200)
   Returns: { discharge: { [ma_bn]: { ngayRa, thangQt, namQt } } }

   Consumed by Initial-SurgicalDataPro (payment lists). Protected by an optional
   shared key (env DISCHARGE_API_KEY) sent as header "x-api-key".
   ═══════════════════════════════════════════════════════════════════════════════ */

const MAX_IDS = 200;

const CORS = {
    "Access-Control-Allow-Origin": process.env.DISCHARGE_ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

function scalar(val: unknown): string {
    if (val == null) return "";
    if (typeof val === "object" && "value" in (val as Record<string, unknown>)) {
        return String((val as Record<string, unknown>).value ?? "");
    }
    return String(val);
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
    const requiredKey = process.env.DISCHARGE_API_KEY;
    if (requiredKey && request.headers.get("x-api-key") !== requiredKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    }

    try {
        const body = await request.json();
        const ids: string[] = [...new Set<string>((body.ids || []).map((v: unknown) => String(v).trim()).filter(Boolean))]
            .slice(0, MAX_IDS);
        if (!ids.length) return NextResponse.json({ discharge: {} }, { headers: CORS });

        const client = getBqClient();
        const query = `
            SELECT ma_bn, MAX(ngay_ra) AS ngay_ra, MAX(thang_qt) AS thang_qt, MAX(nam_qt) AS nam_qt
            FROM \`${FULL_TABLE_ID}\`
            WHERE ma_bn IN UNNEST(@ids)
            GROUP BY ma_bn`;
        const [rows] = await client.query({ query, params: { ids } });

        const discharge: Record<string, { ngayRa: string; thangQt: string; namQt: string }> = {};
        for (const r of rows as Record<string, unknown>[]) {
            discharge[scalar(r.ma_bn)] = {
                ngayRa: scalar(r.ngay_ra),
                thangQt: scalar(r.thang_qt),
                namQt: scalar(r.nam_qt),
            };
        }
        return NextResponse.json({ discharge }, { headers: CORS });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500, headers: CORS });
    }
}
