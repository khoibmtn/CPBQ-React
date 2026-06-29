/**
 * Import ICD-10 data from icd10.xlsx into BigQuery table `lookup_icd10`
 *
 * Usage: node scripts/import-icd10.mjs
 */

import XLSX from "xlsx";
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_ID = "cpbq-487004";
const DATASET_ID = "cpbq_data";
const TABLE_ID = "lookup_icd10";
const FULL_TABLE_ID = `${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}`;

// Map Excel headers → snake_case field names
const HEADER_MAP = {
    "STT": "stt",
    "STT CHƯƠNG": "stt_chuong",
    "PHẠM VI MÃ NHÓM BỆNH": "pham_vi_ma",
    "CHAPTER NAME": "chapter_name",
    "TÊN CHƯƠNG": "ten_chuong",
    "MÃ KHỐI": "ma_khoi",
    "BLOCK NAME": "block_name",
    "TÊN KHỐI": "ten_khoi",
    "MÃ TIỂU KHỐI CẤP 1": "ma_tieu_khoi_1",
    "FIRST SUB-DIVISION NAME": "ten_tieu_khoi_1_en",
    "TÊN TIỂU KHỐI CẤP 1": "ten_tieu_khoi_1",
    "MÃ TIỂU KHỐI CẤP 2": "ma_tieu_khoi_2",
    "SECOND SUB-DIVISION NAME": "ten_tieu_khoi_2_en",
    "TÊN TIỂU KHỐI CẤP 2": "ten_tieu_khoi_2",
    "MÃ NHÓM BỆNH 3 KÝ TỰ": "ma_nhom_3kt",
    "3-CHARACTER SUB-CATEGORY NAME": "ten_nhom_3kt_en",
    "TÊN NHÓM BỆNH 3 KÝ TỰ": "ten_nhom_3kt",
    "MÃ BỆNH": "ma_benh",
    "MÃ BỆNH KHÔNG DẤU": "ma_benh_ko_dau",
    "DISEASE NAME WHO 2019 (ENGLISH)": "ten_benh_en",
    "ADDITIONAL CODING GUIDANCE WHO 2019 (ENGLISH)": "huong_dan_en",
    "TÊN BỆNH": "ten_benh",
    "HƯỚNG DẪN MÃ HÓA BỔ SUNG CỦA WHO 2019": "huong_dan_vn",
    "MÃ KHÔNG ĐƯỢC DÙNG LÀ BỆNH CHÍNH": "khong_benh_chinh",
    "MÃ KHÔNG KHUYẾN KHÍCH DÙNG LÀ BỆNH CHÍNH": "khong_khuyen_khich",
    "MÃ KHÔNG ĐƯỢC SỬ DỤNG VÌ CÓ MÃ 4 HOẶC 5 KÝ TỰ CỤ THỂ HƠN": "co_ma_cu_the_hon",
    "CHỈ SỬ DỤNG MÃ HÓA NGUYÊN NHÂN TỬ VONG": "chi_tu_vong",
    "CÁC MÃ BỆNH CHỈ CÓ HOẶC CHỦ YẾU CÓ Ở NỮ GIỚI": "ma_nu",
    "CÁC MÃ BỆNH CHỈ CÓ HOẶC CHỦ YẾU CÓ Ở NAM GIỚI": "ma_nam",
};

// BigQuery schema
const SCHEMA = Object.values(HEADER_MAP).map((field) => ({
    name: field,
    type: field === "stt" ? "INTEGER" : "STRING",
    mode: "NULLABLE",
}));

async function main() {
    console.log("📖 Reading icd10.xlsx...");
    const xlsxPath = path.resolve(__dirname, "..", "icd10.xlsx");
    const wb = XLSX.readFile(xlsxPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Row 0 = headers, Row 1 = numeric indices (skip), Row 2+ = data
    const headers = rawData[0];
    const dataRows = rawData.slice(2); // Skip header + index row

    console.log(`📊 Found ${dataRows.length} data rows, ${headers.length} columns`);

    // Map rows to objects
    const rows = [];
    for (const raw of dataRows) {
        const row = {};
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const field = HEADER_MAP[header];
            if (!field) continue;
            let val = raw[i];
            if (val === undefined || val === null) {
                row[field] = null;
            } else if (field === "stt") {
                row[field] = typeof val === "number" ? val : parseInt(String(val), 10) || null;
            } else {
                val = String(val).trim();
                row[field] = val === "" ? null : val;
            }
        }
        rows.push(row);
    }

    console.log(`✅ Mapped ${rows.length} rows`);
    console.log("Sample row:", JSON.stringify(rows[0], null, 2));

    // BigQuery client
    const bq = new BigQuery({ projectId: PROJECT_ID });
    const dataset = bq.dataset(DATASET_ID);
    const table = dataset.table(TABLE_ID);

    // Create or recreate table
    console.log(`🗑️  Deleting existing table ${FULL_TABLE_ID} (if exists)...`);
    try {
        await table.delete();
        console.log("   Deleted.");
    } catch (e) {
        if (e.code === 404) console.log("   Table doesn't exist yet.");
        else throw e;
    }

    console.log(`📦 Creating table ${FULL_TABLE_ID}...`);
    await dataset.createTable(TABLE_ID, {
        schema: { fields: SCHEMA },
        location: "asia-southeast1",
    });
    console.log("   Created.");

    // Batch insert
    const BATCH_SIZE = 500;
    const total = rows.length;
    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await table.insert(batch, { raw: false });
        const end = Math.min(i + BATCH_SIZE, total);
        console.log(`   Inserted ${end} / ${total} rows (${((end / total) * 100).toFixed(1)}%)`);
    }

    console.log(`\n🎉 Done! Imported ${total} rows into ${FULL_TABLE_ID}`);
}

main().catch((err) => {
    console.error("❌ Error:", err.message || err);
    if (err.errors) console.error("Details:", JSON.stringify(err.errors.slice(0, 3), null, 2));
    process.exit(1);
});
