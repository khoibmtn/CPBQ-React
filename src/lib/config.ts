// config.ts - BigQuery configuration for CPBQ project
// ====================================================

// GCP Project
export const PROJECT_ID = "cpbq-487004";

// BigQuery Dataset & Table
export const DATASET_ID = "cpbq_data";
export const TABLE_ID = "thanh_toan_bhyt";
export const FULL_TABLE_ID = `${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}`;

// Lookup tables
export const LOOKUP_LOAIKCB_TABLE = "lookup_loaikcb";
export const LOOKUP_CSKCB_TABLE = "lookup_cskcb";
export const LOOKUP_KHOA_TABLE = "lookup_khoa";
export const LOOKUP_PROFILES_TABLE = "lookup_profiles";
export const LOOKUP_KHOA_MERGE_TABLE = "lookup_khoa_merge";

// VIEW (enriched data)
export const VIEW_ID = "v_thanh_toan";

// Dataset location (asia-southeast1 = Singapore, closest to Vietnam)
export const LOCATION = "asia-southeast1";

// Helper
export function getFullTableId(tableName: string): string {
    return `${PROJECT_ID}.${DATASET_ID}.${tableName}`;
}
