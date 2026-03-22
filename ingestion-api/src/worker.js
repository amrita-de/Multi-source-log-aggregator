/**
 * Log Worker — Queue Consumer & Transformer
 *
 * This is the local equivalent of AWS Lambda.
 * Runs as a separate process: `node src/worker.js`
 *
 * Pipeline per log:
 *   1. Pop from Redis queue (blocking)
 *   2. Transform (normalize timestamps, add metadata)
 *   3. Save to AWS S3 (raw .json file)
 *   4. Save to MongoDB (indexed document)
 *   5. Emit via Socket.io to dashboard
 *   6. Loop
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { connectDB, Log } = require('./services/db');
const queue  = require('./services/queue');
const s3     = require('./services/s3');

// Socket.io client to emit events to the already-running server
// We use a lightweight HTTP call instead to keep worker independent
const http = require('http');

const SERVER_URL = `http://localhost:${process.env.PORT || 4000}`;

let isRunning = true;
let processedCount = 0;
let errorCount = 0;

// --- Transform a raw log into a normalized DB document ---
function transformLog(raw) {
  const now = new Date();
  const tsMs = raw.timestamp * 1000;

  return {
    app_name:       String(raw.app_name),
    level:          String(raw.level).toUpperCase(),
    message:        String(raw.message),
    timestamp_unix: Number(raw.timestamp),
    timestamp_iso:  new Date(tsMs),
    ingested_at:    now,
    environment:    raw.environment || 'production',
    metadata:       raw.metadata || {},
    s3_key:         null, // filled after S3 upload
  };
}

// --- Emit new_log event to Socket.io server via internal HTTP ---
function emitToSocketServer(log) {
  const data = JSON.stringify({ event: 'new_log', payload: log });
  const options = {
    hostname: 'localhost',
    port: process.env.PORT || 4000,
    path: '/api/internal/emit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'x-internal-key': process.env.INTERNAL_KEY || 'worker-secret',
    },
  };

  const req = http.request(options, () => {});
  req.on('error', () => {}); // ignore emit errors silently
  req.write(data);
  req.end();
}

// --- Process a single log ---
async function processLog(raw) {
  const doc = transformLog(raw);
  const id  = uuidv4();

  // 1. Build S3 key
  const s3Key = s3.buildKey(doc.timestamp_iso, id);

  // 2. Upload to S3 (non-blocking failure — just skip)
  const uploadedKey = await s3.uploadLog(s3Key, { ...doc, _id: id });
  if (uploadedKey) {
    doc.s3_key = uploadedKey;
  }

  // 3. Save to MongoDB
  const savedLog = await Log.create(doc);

  // 4. Emit to WebSocket clients via internal endpoint
  emitToSocketServer(savedLog.toObject());

  processedCount++;
  if (processedCount % 10 === 0) {
    console.log(`[Worker] Processed ${processedCount} logs (errors: ${errorCount})`);
  }

  return savedLog;
}

// --- Main processing loop ---
async function run() {
  console.log('[Worker] Starting...');
  await connectDB();
  await queue.connect();
  console.log(`[Worker] ✅ Ready — consuming from Redis queue\n`);

  while (isRunning) {
    try {
      // Blocking pop — waits up to 5s then loops (allows graceful shutdown check)
      const raw = await queue.pop(5);
      if (!raw) continue; // timeout, try again

      await processLog(raw);
    } catch (err) {
      errorCount++;
      console.error(`[Worker] Error processing log:`, err.message);
      // Don't crash the worker — continue processing
    }
  }

  console.log('[Worker] Shutting down gracefully');
  process.exit(0);
}

// --- Graceful shutdown ---
process.on('SIGINT',  () => { isRunning = false; });
process.on('SIGTERM', () => { isRunning = false; });

run().catch((err) => {
  console.error('[Worker] Fatal startup error:', err.message);
  process.exit(1);
});
