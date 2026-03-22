/**
 * Alerting Service
 * Sliding-window error rate monitor.
 * If >= THRESHOLD ERROR logs arrive within WINDOW_MS → fire alert.
 */
const AWS = require('aws-sdk');

const THRESHOLD = parseInt(process.env.ERROR_ALERT_THRESHOLD) || 10;
const WINDOW_MS  = parseInt(process.env.ERROR_ALERT_WINDOW_MS) || 60000;

// In-memory sliding window of ERROR timestamps
const errorWindow = [];

// Cooldown: don't fire more than once per window period
let lastAlertAt = 0;

/**
 * Check if current error rate exceeds the threshold.
 * Call this every time an ERROR log is received.
 * @param {Object} io - Socket.io server instance
 * @param {Object} log - The log that triggered the check
 */
function checkErrorRate(io, log) {
  const now = Date.now();
  errorWindow.push(now);

  // Remove entries older than the window
  while (errorWindow.length > 0 && errorWindow[0] < now - WINDOW_MS) {
    errorWindow.shift();
  }

  const errorCount = errorWindow.length;

  if (errorCount >= THRESHOLD && now - lastAlertAt > WINDOW_MS) {
    lastAlertAt = now;
    const alertPayload = {
      type: 'HIGH_ERROR_RATE',
      message: `High error rate detected: ${errorCount} errors in the last ${WINDOW_MS / 1000}s`,
      count: errorCount,
      threshold: THRESHOLD,
      window_seconds: WINDOW_MS / 1000,
      triggered_at: new Date().toISOString(),
      app_name: log.app_name,
    };

    console.warn('[Alert] 🚨', alertPayload.message);

    // Emit to all connected dashboard clients via WebSocket
    if (io) {
      io.emit('alert', alertPayload);
    }

    // Send AWS SNS notification (if configured)
    sendSNSAlert(alertPayload).catch((err) =>
      console.error('[Alert] SNS send failed:', err.message)
    );
  }
}

/**
 * Send an alert notification via AWS SNS.
 */
async function sendSNSAlert(payload) {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn || topicArn.includes('123456789')) {
    // Not configured — skip
    return;
  }

  const sns = new AWS.SNS({ region: process.env.AWS_REGION || 'us-east-1' });

  await sns
    .publish({
      TopicArn: topicArn,
      Subject: `[LOG ALERT] High error rate in ${payload.app_name}`,
      Message: JSON.stringify(payload, null, 2),
    })
    .promise();

  console.log('[Alert] SNS notification sent');
}

/**
 * Get current error window stats (for monitoring endpoint)
 */
function getStats() {
  const now = Date.now();
  const recent = errorWindow.filter((t) => t > now - WINDOW_MS);
  return {
    errorsInWindow: recent.length,
    threshold: THRESHOLD,
    windowSeconds: WINDOW_MS / 1000,
    alertActive: recent.length >= THRESHOLD,
  };
}

module.exports = { checkErrorRate, getStats };
