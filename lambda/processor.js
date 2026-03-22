/**
 * AWS Lambda — Log Processor
 *
 * Triggered by AWS SQS events.
 * Performs the same transform → S3 → MongoDB pipeline as worker.js,
 * but runs serverlessly on AWS.
 *
 * Deployment:
 *   cd lambda && npm install
 *   zip -r lambda.zip .
 *   aws lambda update-function-code \
 *     --function-name log-aggregator-processor \
 *     --zip-file fileb://lambda.zip
 *
 * Required Lambda environment variables:
 *   MONGODB_URI, AWS_REGION, S3_BUCKET
 */
const AWS      = require('aws-sdk');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// --- MongoDB setup (connection reused across warm invocations) ---
let mongoConnection = null;

const logSchema = new mongoose.Schema({
  app_name:       { type: String, required: true },
  level:          { type: String, required: true },
  message:        { type: String, required: true },
  timestamp_unix: { type: Number, required: true },
  timestamp_iso:  { type: Date,   required: true },
  ingested_at:    { type: Date,   default: Date.now },
  environment:    { type: String, default: 'production' },
  metadata:       { type: mongoose.Schema.Types.Mixed, default: {} },
  s3_key:         { type: String, default: null },
}, { collection: 'logs' });

let Log;

async function getMongoConnection() {
  if (mongoConnection && mongoose.connection.readyState === 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  mongoConnection = mongoose.connection;
  Log = mongoose.model('Log', logSchema);
}

// --- S3 client ---
const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.S3_BUCKET || 'log-archive-demo';

// --- Transform raw log ---
function transformLog(raw) {
  const tsMs = Number(raw.timestamp) * 1000;
  return {
    app_name:       String(raw.app_name),
    level:          String(raw.level).toUpperCase(),
    message:        String(raw.message),
    timestamp_unix: Number(raw.timestamp),
    timestamp_iso:  new Date(tsMs),
    ingested_at:    new Date(),
    environment:    raw.environment || 'production',
    metadata:       raw.metadata || {},
    s3_key:         null,
  };
}

// --- Build S3 key ---
function buildS3Key(date, id) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `logs/${yyyy}/${mm}/${dd}/${id}.json`;
}

// --- Process a single log record ---
async function processRecord(body) {
  const raw = typeof body === 'string' ? JSON.parse(body) : body;
  const doc = transformLog(raw);
  const id  = uuidv4();

  // Upload to S3
  const s3Key = buildS3Key(doc.timestamp_iso, id);
  try {
    await s3.putObject({
      Bucket: BUCKET,
      Key: s3Key,
      Body: JSON.stringify({ ...doc, _id: id }, null, 2),
      ContentType: 'application/json',
      StorageClass: 'STANDARD_IA',
    }).promise();
    doc.s3_key = s3Key;
    console.log(`[Lambda] S3 upload: s3://${BUCKET}/${s3Key}`);
  } catch (err) {
    console.error(`[Lambda] S3 upload failed: ${err.message}`);
    // Continue — don't fail the record just because S3 failed
  }

  // Save to MongoDB
  const saved = await Log.create(doc);
  console.log(`[Lambda] MongoDB insert: ${saved._id} [${doc.level}] ${doc.app_name}`);

  return saved;
}

// --- Lambda handler ---
exports.handler = async (event) => {
  console.log(`[Lambda] Processing ${event.Records.length} records`);

  // Connect to MongoDB (reuses existing connection on warm start)
  await getMongoConnection();

  const results = [];
  const failures = [];

  for (const record of event.Records) {
    try {
      const result = await processRecord(record.body);
      results.push({ messageId: record.messageId, logId: result._id });
    } catch (err) {
      console.error(`[Lambda] Failed to process record ${record.messageId}:`, err.message);
      failures.push({ messageId: record.messageId, error: err.message });
      // Return failed messageIds to SQS for retry
    }
  }

  console.log(`[Lambda] Done: ${results.length} success, ${failures.length} failures`);

  // Return batch item failures so SQS only retries failed records
  return {
    batchItemFailures: failures.map((f) => ({ itemIdentifier: f.messageId })),
  };
};
