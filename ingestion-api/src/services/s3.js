/**
 * AWS S3 Service
 * Handles uploading raw log JSON files to S3.
 */
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const BUCKET = process.env.S3_BUCKET || 'log-archive-demo';

/**
 * Upload a single log entry as a .json file to S3.
 * Key pattern: logs/YYYY/MM/DD/<uuid>.json
 * @param {string} key - S3 object key
 * @param {Object} log - The transformed log object
 * @returns {string} The S3 key on success, null if upload fails or AWS not configured
 */
async function uploadLog(key, log) {
  // Skip if AWS credentials not configured (local dev without AWS)
  if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === 'your_access_key_here') {
    return null;
  }

  try {
    await s3
      .putObject({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(log, null, 2),
        ContentType: 'application/json',
        StorageClass: 'STANDARD_IA', // cheaper for infrequent access
      })
      .promise();
    return key;
  } catch (err) {
    console.error(`[S3] Failed to upload ${key}:`, err.message);
    return null;
  }
}

/**
 * Build the S3 key from a date and uuid.
 * @param {Date} date
 * @param {string} id - unique identifier (uuid)
 */
function buildKey(date, id) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `logs/${yyyy}/${mm}/${dd}/${id}.json`;
}

/**
 * List all S3 objects under a given prefix.
 */
async function listObjects(prefix) {
  const result = await s3
    .listObjectsV2({ Bucket: BUCKET, Prefix: prefix })
    .promise();
  return result.Contents || [];
}

/**
 * Get an object from S3.
 */
async function getObject(key) {
  const result = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();
  return result.Body;
}

/**
 * Put a raw buffer/string to S3.
 */
async function putObject(key, body, contentType = 'application/octet-stream') {
  await s3.putObject({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }).promise();
}

/**
 * Delete an object from S3.
 */
async function deleteObject(key) {
  await s3.deleteObject({ Bucket: BUCKET, Key: key }).promise();
}

module.exports = { uploadLog, buildKey, listObjects, getObject, putObject, deleteObject };
