/**
 * bigquery.ts – Server-side BigQuery client
 * ==========================================
 * Uses service account credentials from environment variables.
 * This file should ONLY be imported in API routes (server-side).
 */

import { BigQuery } from "@google-cloud/bigquery";
import { PROJECT_ID, LOCATION } from "./config";

let _client: BigQuery | null = null;

/**
 * Get a singleton BigQuery client.
 * Credentials are loaded from:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var (path to JSON file), OR
 *   - BQ_CLIENT_EMAIL + BQ_PRIVATE_KEY env vars (for Vercel deployment)
 */
export function getBqClient(): BigQuery {
    if (_client) return _client;

    const clientEmail = process.env.BQ_CLIENT_EMAIL;
    const privateKey = process.env.BQ_PRIVATE_KEY;

    if (clientEmail && privateKey) {
        // Vercel deployment: credentials from env vars
        _client = new BigQuery({
            projectId: PROJECT_ID,
            location: LOCATION,
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, "\n"),
            },
        });
    } else {
        // Local development: relies on GOOGLE_APPLICATION_CREDENTIALS
        _client = new BigQuery({
            projectId: PROJECT_ID,
            location: LOCATION,
        });
    }

    return _client;
}

/**
 * Run a SQL query and return rows as plain objects.
 */
export async function runQuery<T = Record<string, unknown>>(
    sql: string
): Promise<T[]> {
    const client = getBqClient();
    const [rows] = await client.query({ query: sql });
    return rows as T[];
}
