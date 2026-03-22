/**
 * GET /api/logs   - Paginated log query with filters
 * GET /api/logs/stats - Aggregated stats
 * GET /api/logs/:id   - Single log detail
 */
const express = require('express');
const router  = express.Router();
const { Log } = require('../services/db');
const { getStats } = require('../services/alert');

/**
 * GET /api/logs
 * Query params:
 *   app_name  - filter by service name
 *   level     - filter by log level (INFO|WARN|ERROR|DEBUG)
 *   search    - text search in message field
 *   startDate - ISO date string (gte)
 *   endDate   - ISO date string (lte)
 *   page      - page number (default: 1)
 *   pageSize  - results per page (default: 50, max: 200)
 */
router.get('/', async (req, res) => {
  try {
    const {
      app_name,
      level,
      search,
      startDate,
      endDate,
      page     = 1,
      pageSize = 50,
    } = req.query;

    // Build MongoDB filter
    const filter = {};
    if (app_name) filter.app_name = app_name;
    if (level)    filter.level    = level.toUpperCase();

    if (startDate || endDate) {
      filter.timestamp_iso = {};
      if (startDate) filter.timestamp_iso.$gte = new Date(startDate);
      if (endDate)   filter.timestamp_iso.$lte = new Date(endDate);
    }

    if (search) {
      filter.message = { $regex: search, $options: 'i' };
    }

    const skip  = (Math.max(parseInt(page), 1) - 1) * Math.min(parseInt(pageSize), 200);
    const limit = Math.min(parseInt(pageSize), 200);

    const [logs, total] = await Promise.all([
      Log.find(filter)
        .sort({ timestamp_iso: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Log.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page:        parseInt(page),
        pageSize:    limit,
        totalPages:  Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Logs] GET /logs error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/logs/stats
 * Returns aggregated counts by level and app_name.
 * Optional query: startDate, endDate
 */
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp_iso = {};
      if (startDate) matchStage.timestamp_iso.$gte = new Date(startDate);
      if (endDate)   matchStage.timestamp_iso.$lte = new Date(endDate);
    }

    const [byLevel, byApp, total, recentErrors] = await Promise.all([
      Log.aggregate([
        { $match: matchStage },
        { $group: { _id: '$level', count: { $sum: 1 } } },
      ]),
      Log.aggregate([
        { $match: matchStage },
        { $group: { _id: '$app_name', count: { $sum: 1 } } },
      ]),
      Log.countDocuments(matchStage),
      // Last 24h error count
      Log.countDocuments({
        level: 'ERROR',
        timestamp_iso: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Convert aggregation results to plain objects
    const levelMap = Object.fromEntries(byLevel.map((r) => [r._id, r.count]));
    const appMap   = Object.fromEntries(byApp.map((r) => [r._id, r.count]));

    const alertStats = getStats();

    res.json({
      success: true,
      data: {
        total,
        recentErrors24h: recentErrors,
        byLevel:  levelMap,
        byApp:    appMap,
        alert:    alertStats,
      },
    });
  } catch (err) {
    console.error('[Logs] GET /stats error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/logs/:id
 * Returns a single log document by MongoDB _id.
 */
router.get('/:id', async (req, res) => {
  try {
    const log = await Log.findById(req.params.id).lean();
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }
    res.json({ success: true, data: log });
  } catch (err) {
    // CastError = invalid ObjectId format
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid log ID format' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
