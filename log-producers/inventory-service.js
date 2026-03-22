/**
 * Inventory Service - Dummy Log Producer
 * Simulates an inventory management service emitting logs
 */
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const INGESTION_URL = process.env.INGEST_URL || 'http://localhost:4000/api/ingest';
const APP_NAME = 'Inventory-Service';
const INTERVAL_MS = 5000;

// Weighted level distribution: 70% INFO, 20% WARN, 10% ERROR
const LEVELS = [
  'INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO',
  'WARN', 'WARN',
  'ERROR',
  'DEBUG'
];

const INFO_MESSAGES = [
  'Stock level updated for item',
  'New inventory item added to catalog',
  'Warehouse sync completed successfully',
  'Stock reservation created for order',
  'Item dispatched from warehouse',
  'Goods received from supplier',
  'Inventory audit completed',
  'Stock transfer between warehouses completed',
  'Reorder triggered for low-stock item',
  'Batch import of items completed',
];

const WARN_MESSAGES = [
  'Low stock alert: item below reorder threshold',
  'Slow sync with warehouse system',
  'Duplicate item SKU detected',
  'Stock discrepancy found in audit',
  'Supplier lead time exceeded',
];

const ERROR_MESSAGES = [
  'Failed to sync with warehouse management system',
  'Stock update conflict: concurrent modification',
  'Database deadlock on inventory table',
  'S3 sync for inventory export failed',
  'Barcode scanner API connection refused',
];

const DEBUG_MESSAGES = [
  'Cache invalidated for inventory list',
  'Elasticsearch index updated for item',
  'Webhook payload prepared for stock update',
];

const MESSAGES = {
  INFO: INFO_MESSAGES,
  WARN: WARN_MESSAGES,
  ERROR: ERROR_MESSAGES,
  DEBUG: DEBUG_MESSAGES,
};

const ITEMS = ['SKU-1001', 'SKU-2034', 'SKU-3087', 'SKU-4012', 'SKU-5099'];
const WAREHOUSES = ['WH-Mumbai', 'WH-Delhi', 'WH-Bangalore', 'WH-Hyderabad'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLog() {
  const level = randomItem(LEVELS);
  const messages = MESSAGES[level] || MESSAGES.INFO;
  const sku = randomItem(ITEMS);
  const quantity = Math.floor(Math.random() * 500 + 1);

  return {
    app_name: APP_NAME,
    level,
    message: `${randomItem(messages)} [${sku}]`,
    timestamp: Math.floor(Date.now() / 1000),
    environment: 'production',
    metadata: {
      request_id: uuidv4(),
      sku,
      quantity,
      warehouse: randomItem(WAREHOUSES),
      operation: randomItem(['UPDATE', 'INSERT', 'RESERVE', 'RELEASE', 'AUDIT']),
      duration_ms: Math.floor(Math.random() * 500 + 10),
    },
  };
}

async function sendLog() {
  const log = generateLog();
  try {
    await axios.post(INGESTION_URL, log, { timeout: 5000 });
    console.log(`[${APP_NAME}] [${log.level}] ${log.message}`);
  } catch (err) {
    console.error(`[${APP_NAME}] Failed to send log: ${err.message}`);
  }
}

console.log(`[${APP_NAME}] Starting log producer → ${INGESTION_URL}`);
sendLog();
setInterval(sendLog, INTERVAL_MS);
