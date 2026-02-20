const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config({ path: '.env.local' });

const bq = new BigQuery();
async function run() {
    console.log("Testing raw table:");
    try {
        const [rows] = await bq.query('SELECT nam_qt, COUNT(*) as c FROM `cpbq-487004.cpbq_data.thanh_toan_bhyt` GROUP BY nam_qt ORDER BY nam_qt DESC LIMIT 10');
        console.table(rows);
    } catch (e) { console.error(e.message); }

    console.log("\nTesting view:");
    try {
        const [rows] = await bq.query('SELECT nam_qt, COUNT(*) as c FROM `cpbq-487004.cpbq_data.v_thanh_toan` GROUP BY nam_qt ORDER BY nam_qt DESC LIMIT 10');
        console.table(rows);
    } catch (e) { console.error(e.message); }
}
run();
