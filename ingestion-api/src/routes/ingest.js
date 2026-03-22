/**
 * POST /api/ingest
 * Receives logs from producers, validates, and pushes to Redis queue.
 */
const express = require('express');
const router = express.Router();
const queue = require('../services/queue');
const { checkErrorRate } = require('../services/alert');

const VALID_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
const VALID_APPS   = ['Payment-Service', 'Auth-Service', 'Inventory-Service'];

/**
 * POST /api/ingest
 * Body: { app_name, level, message, timestamp, environment?, metadata? }
 */
router.post('/', async (req, res) => {
  // Attach io from app for alert emission
  const io = req.app.get('io');

  const { app_name, level, message, timestamp, environment, metadata } = req.body;

  // --- Validation ---
  const errors = [];
  if (!app_name)   errors.push('app_name is required');
  if (!level)      errors.push('level is required');
  if (!message)    errors.push('message is required');
  if (!timestamp)  errors.push('timestamp is required');

  if (level && !VALID_LEVELS.includes(level.toUpperCase())) {
    errors.push(`level must be one of: ${VALID_LEVELS.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // --- Build normalized log payload ---
  const log = {
    app_name: String(app_name),
    level: level.toUpperCase(),
    message: String(message),
    timestamp: Number(timestamp),
    environment: environment || 'production',
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    received_at: Date.now(),
  };

  try {
    // Push to Redis queue (fire-and-forget processing)
    await queue.push(log);

    // Trigger alert check for ERROR logs
    if (log.level === 'ERROR') {
      checkErrorRate(io, log);
    }

    return res.status(202).json({
      success: true,
      message: 'Log accepted',
      queued_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Ingest] Failed to queue log:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to queue log' });
  }
});

/**
 * GET /api/ingest/health
 * Quick health check for the ingest endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const queueLength = await queue.length();
    res.json({
      status: 'ok',
      queue_length: queueLength,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

module.exports = router;
