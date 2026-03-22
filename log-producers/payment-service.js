/**
 * Payment Service - Dummy Log Producer
 * Simulates a real payment processing service emitting logs
 */
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const INGESTION_URL = process.env.INGEST_URL || 'http://localhost:4000/api/ingest';
const APP_NAME = 'Payment-Service';
const INTERVAL_MS = 3000;

// Weighted level distribution: 65% INFO, 25% WARN, 10% ERROR
const LEVELS = [
  'INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO',
  'WARN', 'WARN', 'WARN',
  'ERROR'
];

const INFO_MESSAGES = [
  'Payment processed successfully',
  'Transaction initiated for order',
  'Payment gateway connected',
  'Payment confirmation sent to customer',
  'Refund initiated successfully',
  'Payment method validated',
  'Invoice generated for order',
  'Payment receipt dispatched',
  'Webhook notification sent',
  'Transaction record saved to DB',
];

const WARN_MESSAGES = [
  'Payment retry attempt 1 of 3',
  'Slow response from payment gateway (>2s)',
  'Card validation took longer than expected',
  'Duplicate transaction detected, skipping',
  'Payment method about to expire',
  'Rate limit approaching on gateway API',
];

const ERROR_MESSAGES = [
  'Payment gateway timeout after 30s',
  'Transaction declined: insufficient funds',
  'Invalid card number format received',
  'Payment gateway returned 503',
  'Database write failed for transaction record',
  'Webhook delivery failed after 3 retries',
];

const MESSAGES = { INFO: INFO_MESSAGES, WARN: WARN_MESSAGES, ERROR: ERROR_MESSAGES };

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLog() {
  const level = randomItem(LEVELS);
  const messages = MESSAGES[level] || MESSAGES.INFO;
  const orderId = `ORD-${Math.floor(Math.random() * 90000 + 10000)}`;
  const amount = (Math.random() * 5000 + 100).toFixed(2);

  return {
    app_name: APP_NAME,
    level,
    message: `${randomItem(messages)} [${orderId}]`,
    timestamp: Math.floor(Date.now() / 1000),
    environment: 'production',
    metadata: {
      request_id: uuidv4(),
      order_id: orderId,
      amount: parseFloat(amount),
      currency: 'INR',
      gateway: randomItem(['Razorpay', 'Stripe', 'PayU']),
      duration_ms: Math.floor(Math.random() * 2000 + 50),
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
sendLog(); // send immediately on startup
setInterval(sendLog, INTERVAL_MS);
