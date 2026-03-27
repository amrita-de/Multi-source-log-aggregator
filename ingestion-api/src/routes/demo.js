/**
 * Demo Mode — Server-side log generator for portfolio demos.
 * Reuses the same Redis → Worker → MongoDB pipeline as real producers.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const queue = require('../services/queue');

const router = express.Router();

let intervals = [];
let isActive = false;

// --- Helpers ---
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Service Definitions (mirrored from log-producers/) ---
const SERVICES = [
  {
    app_name: 'Payment-Service',
    intervalMs: 3000,
    levels: ['INFO','INFO','INFO','INFO','INFO','INFO','INFO','WARN','WARN','WARN','ERROR'],
    messages: {
      INFO: [
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
      ],
      WARN: [
        'Payment retry attempt 1 of 3',
        'Slow response from payment gateway (>2s)',
        'Card validation took longer than expected',
        'Duplicate transaction detected, skipping',
        'Payment method about to expire',
        'Rate limit approaching on gateway API',
      ],
      ERROR: [
        'Payment gateway timeout after 30s',
        'Transaction declined: insufficient funds',
        'Invalid card number format received',
        'Payment gateway returned 503',
        'Database write failed for transaction record',
        'Webhook delivery failed after 3 retries',
      ],
    },
    generateMetadata: () => {
      const orderId = `ORD-${Math.floor(Math.random() * 90000 + 10000)}`;
      return {
        request_id: uuidv4(),
        order_id: orderId,
        amount: parseFloat((Math.random() * 5000 + 100).toFixed(2)),
        currency: 'INR',
        gateway: randomItem(['Razorpay', 'Stripe', 'PayU']),
        duration_ms: Math.floor(Math.random() * 2000 + 50),
      };
    },
    formatMessage: (msg, meta) => `${msg} [${meta.order_id}]`,
  },
  {
    app_name: 'Auth-Service',
    intervalMs: 4000,
    levels: ['INFO','INFO','INFO','INFO','INFO','INFO','WARN','WARN','WARN','ERROR','ERROR','DEBUG'],
    messages: {
      INFO: [
        'User login successful',
        'JWT token issued',
        'Session refreshed successfully',
        'User logout completed',
        'Password reset link sent',
        'Two-factor authentication passed',
        'New user registered',
        'Role assigned to user',
        'OAuth token validated',
        'API key authenticated',
      ],
      WARN: [
        'Failed login attempt (wrong password)',
        'Login attempt from unusual location',
        'JWT token nearing expiration',
        'Multiple failed logins detected',
        'Suspicious IP address flagged',
        'Account temporarily locked after 5 failed attempts',
      ],
      ERROR: [
        'JWT secret key rotation failed',
        'Database connection lost during auth check',
        'OAuth provider returned 500',
        'Token verification failed: signature mismatch',
        'Redis session store unreachable',
        'Critical: Admin account login from unknown device',
      ],
      DEBUG: [
        'Token payload decoded successfully',
        'RBAC check passed for resource',
        'Rate limiter counter incremented',
      ],
    },
    generateMetadata: () => ({
      request_id: uuidv4(),
      user_id: randomItem(['user_1001', 'user_1042', 'user_2087', 'user_3001', 'admin_001']),
      ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      user_agent: randomItem([
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        'PostmanRuntime/7.36.0',
      ]),
      auth_method: randomItem(['password', 'oauth_google', 'api_key', '2fa']),
    }),
    formatMessage: (msg) => msg,
  },
  {
    app_name: 'Inventory-Service',
    intervalMs: 5000,
    levels: ['INFO','INFO','INFO','INFO','INFO','INFO','INFO','WARN','WARN','ERROR','DEBUG'],
    messages: {
      INFO: [
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
      ],
      WARN: [
        'Low stock alert: item below reorder threshold',
        'Slow sync with warehouse system',
        'Duplicate item SKU detected',
        'Stock discrepancy found in audit',
        'Supplier lead time exceeded',
      ],
      ERROR: [
        'Failed to sync with warehouse management system',
        'Stock update conflict: concurrent modification',
        'Database deadlock on inventory table',
        'S3 sync for inventory export failed',
        'Barcode scanner API connection refused',
      ],
      DEBUG: [
        'Cache invalidated for inventory list',
        'Elasticsearch index updated for item',
        'Webhook payload prepared for stock update',
      ],
    },
    generateMetadata: () => {
      const sku = randomItem(['SKU-1001', 'SKU-2034', 'SKU-3087', 'SKU-4012', 'SKU-5099']);
      return {
        request_id: uuidv4(),
        sku,
        quantity: Math.floor(Math.random() * 500 + 1),
        warehouse: randomItem(['WH-Mumbai', 'WH-Delhi', 'WH-Bangalore', 'WH-Hyderabad']),
        operation: randomItem(['UPDATE', 'INSERT', 'RESERVE', 'RELEASE', 'AUDIT']),
        duration_ms: Math.floor(Math.random() * 500 + 10),
      };
    },
    formatMessage: (msg, meta) => `${msg} [${meta.sku}]`,
  },
];

function generateLog(service) {
  const level = randomItem(service.levels);
  const msgs = service.messages[level] || service.messages.INFO;
  const metadata = service.generateMetadata();
  return {
    app_name: service.app_name,
    level,
    message: service.formatMessage(randomItem(msgs), metadata),
    timestamp: Math.floor(Date.now() / 1000),
    environment: 'production',
    metadata,
  };
}

async function pushLog(service) {
  try {
    await queue.push(generateLog(service));
  } catch (err) {
    console.error(`[Demo] Failed to push log for ${service.app_name}:`, err.message);
  }
}

// --- Routes ---

router.post('/start', async (req, res) => {
  if (isActive) {
    return res.json({ success: true, message: 'Demo already running' });
  }

  isActive = true;

  // Push one log per service immediately
  for (const service of SERVICES) {
    pushLog(service);
  }

  // Start intervals
  for (const service of SERVICES) {
    intervals.push(setInterval(() => pushLog(service), service.intervalMs));
  }

  console.log('[Demo] Started — generating logs for all services');
  res.json({ success: true, message: 'Demo started' });
});

router.post('/stop', (req, res) => {
  intervals.forEach(clearInterval);
  intervals = [];
  isActive = false;

  console.log('[Demo] Stopped');
  res.json({ success: true, message: 'Demo stopped' });
});

router.get('/status', (req, res) => {
  res.json({ active: isActive });
});

module.exports = router;
