/**
 * Log Rotation / Archiving Script
 *
 * Run manually or via cron: node src/scripts/archiveLogs.js
 *
 * What it does:
 *   1. Lists all .json files in S3 under logs/YYYY/MM/DD/ older than 7 days
 *   2. Groups them by date
 *   3. For each date group: downloads all files, concatenates to NDJSON, gzips it
 *   4. Uploads archive to archive/YYYY/MM/DD.json.gz in S3
 *   5. Deletes the original individual .json files
 *
 * This is standard Data Engineering practice — reduces S3 object count
 * and storage costs (Glacier/S3-IA is priced per object + per GB).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const s3 = require('../services/s3');

const ARCHIVE_AFTER_DAYS = parseInt(process.env.ARCHIVE_AFTER_DAYS) || 7;

async function run() {
  console.log(`[Archive] Starting log rotation (archiving logs older than ${ARCHIVE_AFTER_DAYS} days)`);

  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'your_access_key_here') {
    console.log('[Archive] AWS not configured — skipping S3 archival');
    console.log('[Archive] To enable, set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET in .env');
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS);

  // --- List all objects under logs/ prefix ---
  console.log('[Archive] Listing S3 objects...');
  const objects = await s3.listObjects('logs/');
  console.log(`[Archive] Found ${objects.length} total log files in S3`);

  // --- Filter objects older than cutoff ---
  const toArchive = objects.filter((obj) => obj.LastModified < cutoffDate);
  console.log(`[Archive] ${toArchive.length} files are older than ${ARCHIVE_AFTER_DAYS} days`);

  if (toArchive.length === 0) {
    console.log('[Archive] Nothing to archive. Exiting.');
    return;
  }

  // --- Group by date prefix: logs/YYYY/MM/DD/ ---
  const byDate = {};
  for (const obj of toArchive) {
    const parts = obj.Key.split('/');
    // Key pattern: logs/YYYY/MM/DD/uuid.json
    if (parts.length >= 5) {
      const dateKey = `${parts[1]}/${parts[2]}/${parts[3]}`; // YYYY/MM/DD
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(obj.Key);
    }
  }

  const dates = Object.keys(byDate);
  console.log(`[Archive] Processing ${dates.length} date groups: ${dates.join(', ')}`);

  // --- Process each date group ---
  let totalArchived = 0;
  let totalDeleted  = 0;

  for (const dateKey of dates) {
    const keys = byDate[dateKey];
    console.log(`\n[Archive] Processing ${dateKey}: ${keys.length} files`);

    try {
      // Download all files for this date
      const lines = [];
      for (const key of keys) {
        try {
          const body = await s3.getObject(key);
          const data = JSON.parse(body.toString());
          lines.push(JSON.stringify(data)); // NDJSON line
        } catch (err) {
          console.error(`[Archive] Failed to read ${key}:`, err.message);
        }
      }

      if (lines.length === 0) {
        console.log(`[Archive] No readable files for ${dateKey}, skipping`);
        continue;
      }

      // Concatenate to NDJSON (newline-delimited JSON)
      const ndjson = lines.join('\n');

      // Gzip compress
      const compressed = await gzip(Buffer.from(ndjson, 'utf-8'));

      // Upload archive
      const archiveKey = `archive/${dateKey}.json.gz`;
      await s3.putObject(archiveKey, compressed, 'application/gzip');
      console.log(`[Archive] ✅ Uploaded archive: s3://${process.env.S3_BUCKET}/${archiveKey} (${(compressed.length / 1024).toFixed(1)} KB)`);
      totalArchived++;

      // Delete original files
      let deleted = 0;
      for (const key of keys) {
        try {
          await s3.deleteObject(key);
          deleted++;
        } catch (err) {
          console.error(`[Archive] Failed to delete ${key}:`, err.message);
        }
      }
      console.log(`[Archive] Deleted ${deleted}/${keys.length} original files for ${dateKey}`);
      totalDeleted += deleted;
    } catch (err) {
      console.error(`[Archive] Error processing date group ${dateKey}:`, err.message);
    }
  }

  console.log(`\n[Archive] ✅ Done: ${totalArchived} archives created, ${totalDeleted} files deleted`);
}

run().catch((err) => {
  console.error('[Archive] Fatal error:', err.message);
  process.exit(1);
});
