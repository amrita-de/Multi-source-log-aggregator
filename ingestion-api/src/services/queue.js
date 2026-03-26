/**
 * Redis Queue Service
 * Wraps ioredis for pub/sub queue operations on the log_queue list.
 */
const Redis = require('ioredis');

const QUEUE_KEY = 'log_queue';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const isUpstash = redisUrl.includes('upstash.io');

const redisOptions = {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  ...(isUpstash && { tls: { rejectUnauthorized: false } }),
};

// Publisher client (used by ingestion API)
const publisher = new Redis(redisUrl, redisOptions);

// Subscriber/consumer client (used by worker - blocking pop needs separate connection)
const consumer = new Redis(redisUrl, {
  ...redisOptions,
  maxRetriesPerRequest: null, // retry forever for the blocking consumer
});

publisher.on('connect', () => console.log('[Queue] Publisher connected to Redis'));
publisher.on('error', (err) => console.error('[Queue] Publisher error:', err.message));

consumer.on('connect', () => console.log('[Queue] Consumer connected to Redis'));
consumer.on('error', (err) => console.error('[Queue] Consumer error:', err.message));

/**
 * Push a log entry onto the queue.
 * @param {Object} log - The raw log object from a producer
 */
async function push(log) {
  await publisher.lpush(QUEUE_KEY, JSON.stringify(log));
}

/**
 * Blocking pop — waits until a message is available (used by worker).
 * Returns parsed log object or null on timeout.
 * @param {number} timeoutSeconds - How long to block (0 = forever)
 */
async function pop(timeoutSeconds = 0) {
  const result = await consumer.brpop(QUEUE_KEY, timeoutSeconds);
  if (!result) return null;
  // result = [key, value]
  return JSON.parse(result[1]);
}

/**
 * Get current queue length (for monitoring)
 */
async function length() {
  return publisher.llen(QUEUE_KEY);
}

/**
 * Connect both clients (called at startup)
 */
async function connect() {
  await publisher.connect();
  await consumer.connect();
}

module.exports = { push, pop, length, connect, publisher, consumer };
