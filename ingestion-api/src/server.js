/**
 * Multi-Source Log Aggregator — Ingestion API Server
 * Handles log intake, queries, and real-time WebSocket broadcasting.
 */
require('dotenv').config();
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const { Server } = require('socket.io');

const { connectDB } = require('./services/db');
const queue         = require('./services/queue');
const ingestRoutes  = require('./routes/ingest');
const logsRoutes    = require('./routes/logs');
const demoRoutes    = require('./routes/demo');

const PORT = process.env.PORT || 4000;

// --- CORS Origins ---
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

// --- Express App ---
const app    = express();
const server = http.createServer(app);

// --- Socket.io ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in routes via req.app.get('io')
app.set('io', io);

// --- Middleware ---
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- Routes ---
app.use('/api/ingest', ingestRoutes);
app.use('/api/logs',   logsRoutes);
app.use('/api/demo',   demoRoutes);

// Internal endpoint for worker to emit Socket.io events
app.post('/api/internal/emit', (req, res) => {
  const key = req.headers['x-internal-key'];
  if (key !== (process.env.INTERNAL_KEY || 'worker-secret')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { event, payload } = req.body;
  if (event && payload) {
    io.emit(event, payload);
    // Also emit to app-specific room
    if (payload.app_name) {
      io.to(`app:${payload.app_name}`).emit(event, payload);
    }
  }
  res.status(200).json({ ok: true });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const queueLen = await queue.length();
    res.json({
      status: 'ok',
      service: 'log-aggregator-ingestion-api',
      queue_length: queueLen,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// --- Socket.io Connection Handling ---
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });

  // Allow clients to subscribe to a specific app's logs
  socket.on('subscribe', (appName) => {
    socket.join(`app:${appName}`);
    console.log(`[Socket] ${socket.id} subscribed to app:${appName}`);
  });
});

// --- Embedded Worker (for single-process deployment) ---
async function startEmbeddedWorker() {
  const { v4: uuidv4 } = require('uuid');
  const { Log }        = require('./services/db');
  const s3             = require('./services/s3');

  console.log('[Worker] ✅ Embedded worker started — consuming from Redis queue\n');

  while (true) {
    try {
      const raw = await queue.pop(5);
      if (!raw) continue;

      const now  = new Date();
      const tsMs = raw.timestamp * 1000;
      const doc  = {
        app_name:       String(raw.app_name),
        level:          String(raw.level).toUpperCase(),
        message:        String(raw.message),
        timestamp_unix: Number(raw.timestamp),
        timestamp_iso:  new Date(tsMs),
        ingested_at:    now,
        environment:    raw.environment || 'production',
        metadata:       raw.metadata || {},
        s3_key:         null,
      };

      const id    = uuidv4();
      const s3Key = s3.buildKey(doc.timestamp_iso, id);
      const uploadedKey = await s3.uploadLog(s3Key, { ...doc, _id: id });
      if (uploadedKey) doc.s3_key = uploadedKey;

      const savedLog = await Log.create(doc);
      io.emit('new_log', savedLog.toObject());
    } catch (err) {
      console.error('[Worker] Error:', err.message);
    }
  }
}

// --- Startup ---
async function start() {
  try {
    // Connect MongoDB
    await connectDB();

    // Connect Redis queue
    await queue.connect();
    console.log(`[Server] Queue ready, current depth: ${await queue.length()}`);

    // Start HTTP + WebSocket server
    server.listen(PORT, () => {
      console.log(`\n[Server] ✅ Ingestion API running on port ${PORT}`);
      console.log(`[Server]    Health:  /api/health`);
      console.log(`[Server]    Ingest:  POST /api/ingest`);
      console.log(`[Server]    Logs:    GET  /api/logs`);
      console.log(`[Server]    Stats:   GET  /api/logs/stats\n`);
    });

    // Start embedded worker if RUN_WORKER=true (for single-process deploy)
    if (process.env.RUN_WORKER === 'true') {
      startEmbeddedWorker();
    }
  } catch (err) {
    console.error('[Server] Startup failed:', err.message);
    process.exit(1);
  }
}

start();

module.exports = { app, io, server };
