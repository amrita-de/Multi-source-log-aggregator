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

const PORT = process.env.PORT || 4000;

// --- Express App ---
const app    = express();
const server = http.createServer(app);

// --- Socket.io ---
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in routes via req.app.get('io')
app.set('io', io);

// --- Middleware ---
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
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
      console.log(`\n[Server] ✅ Ingestion API running on http://localhost:${PORT}`);
      console.log(`[Server]    Health:  http://localhost:${PORT}/api/health`);
      console.log(`[Server]    Ingest:  POST http://localhost:${PORT}/api/ingest`);
      console.log(`[Server]    Logs:    GET  http://localhost:${PORT}/api/logs`);
      console.log(`[Server]    Stats:   GET  http://localhost:${PORT}/api/logs/stats\n`);
    });
  } catch (err) {
    console.error('[Server] Startup failed:', err.message);
    process.exit(1);
  }
}

start();

module.exports = { app, io, server };
