/**
 * bigquery.ts – Server-side BigQuery client
 * ==========================================
 * Supports multiple auth methods for flexibility.
 * This file should ONLY be imported in API routes (server-side).
 */

import { BigQuery } from "@google-cloud/bigquery";
import { PROJECT_ID, LOCATION } from "./config";

let _client: BigQuery | null = null;

/**
 * Get a singleton BigQuery client.
 * Credentials are loaded in this priority order:
 *   1. BQ_CREDENTIALS_JSON env var (full JSON credentials string — for Vercel)
 *   2. BQ_CLIENT_EMAIL + BQ_PRIVATE_KEY env vars (service account on Vercel)
 *   3. GOOGLE_APPLICATION_CREDENTIALS env var / ADC (local development)
 */
export function getBqClient(): BigQuery {
    if (_client) return _client;

    const credentialsJson = process.env.BQ_CREDENTIALS_JSON;
    const clientEmail = process.env.BQ_CLIENT_EMAIL;
    const privateKey = process.env.BQ_PRIVATE_KEY;

    if (credentialsJson) {
        // Option 1: Full credentials JSON (OAuth2 or service account)
        const creds = JSON.parse(credentialsJson);
        _client = new BigQuery({
            projectId: PROJECT_ID,
            location: LOCATION,
            credentials: creds,
        });
    } else if (clientEmail && privateKey) {
        // Option 2: Service account email + private key
        _client = new BigQuery({
            projectId: PROJECT_ID,
            location: LOCATION,
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, "\n"),
            },
        });
    } else {
        // Option 3: ADC / GOOGLE_APPLICATION_CREDENTIALS (local dev)
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
