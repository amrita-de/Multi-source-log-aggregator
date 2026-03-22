/**
 * Auth Service - Dummy Log Producer
 * Simulates an authentication/authorization service emitting logs
 */
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const INGESTION_URL = process.env.INGEST_URL || 'http://localhost:4000/api/ingest';
const APP_NAME = 'Auth-Service';
const INTERVAL_MS = 4000;

// Weighted level distribution: 60% INFO, 25% WARN, 15% ERROR
const LEVELS = [
  'INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO',
  'WARN', 'WARN', 'WARN',
  'ERROR', 'ERROR',
  'DEBUG'
];

const INFO_MESSAGES = [
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
];

const WARN_MESSAGES = [
  'Failed login attempt (wrong password)',
  'Login attempt from unusual location',
  'JWT token nearing expiration',
  'Multiple failed logins detected',
  'Suspicious IP address flagged',
  'Account temporarily locked after 5 failed attempts',
];

const ERROR_MESSAGES = [
  'JWT secret key rotation failed',
  'Database connection lost during auth check',
  'OAuth provider returned 500',
  'Token verification failed: signature mismatch',
  'Redis session store unreachable',
  'Critical: Admin account login from unknown device',
];

const DEBUG_MESSAGES = [
  'Token payload decoded successfully',
  'RBAC check passed for resource',
  'Rate limiter counter incremented',
];

const MESSAGES = {
  INFO: INFO_MESSAGES,
  WARN: WARN_MESSAGES,
  ERROR: ERROR_MESSAGES,
  DEBUG: DEBUG_MESSAGES,
};

const USERS = ['user_1001', 'user_1042', 'user_2087', 'user_3001', 'admin_001'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLog() {
  const level = randomItem(LEVELS);
  const messages = MESSAGES[level] || MESSAGES.INFO;
  const userId = randomItem(USERS);

  return {
    app_name: APP_NAME,
    level,
    message: randomItem(messages),
    timestamp: Math.floor(Date.now() / 1000),
    environment: 'production',
    metadata: {
      request_id: uuidv4(),
      user_id: userId,
      ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      user_agent: randomItem([
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        'PostmanRuntime/7.36.0',
      ]),
      auth_method: randomItem(['password', 'oauth_google', 'api_key', '2fa']),
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
