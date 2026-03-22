/**
 * MongoDB Connection & Log Model
 */
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    app_name:      { type: String, required: true, index: true },
    level:         { type: String, required: true, enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'], index: true },
    message:       { type: String, required: true },
    timestamp_unix:{ type: Number, required: true },
    timestamp_iso: { type: Date,   required: true, index: true },
    ingested_at:   { type: Date,   default: Date.now, index: true },
    environment:   { type: String, default: 'production' },
    metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
    s3_key:        { type: String, default: null },
  },
  {
    collection: 'logs',
    timestamps: false,
  }
);

// TTL index: auto-delete logs older than 7 days (604800 seconds)
logSchema.index({ ingested_at: 1 }, { expireAfterSeconds: 604800 });

// Compound index for common query patterns
logSchema.index({ app_name: 1, level: 1, timestamp_iso: -1 });

const Log = mongoose.model('Log', logSchema);

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('[DB] MongoDB connected:', mongoose.connection.host);
}

module.exports = { connectDB, Log };
