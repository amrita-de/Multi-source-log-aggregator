# Multi-Source Log Aggregator

A production-style Data Engineering project that aggregates logs from multiple services through a streaming pipeline into dual storage (MongoDB + AWS S3) with a real-time React dashboard.

## Architecture

```
[Payment-Service] ──┐
[Auth-Service]    ──┼──► POST /api/ingest ──► Redis Queue ──► Worker
[Inventory-Svc]   ──┘                                           │
                                                         ┌──────┴──────┐
                                                         ▼             ▼
                                                      AWS S3       MongoDB
                                                   (raw .json)  (indexed docs)
                                                                      │
                                                 WebSocket ◄──────────┘
                                                      │
                                               React Dashboard
                                           (filter, search, alerts)
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for Redis) OR Redis installed locally
- MongoDB Atlas account (free tier)

### Step 1 — Start Redis

```bash
docker-compose up -d
```

### Step 2 — Configure MongoDB

1. Create a free cluster at https://cloud.mongodb.com
2. Copy your connection string
3. Edit `ingestion-api/.env`:
   ```
   MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@cluster.mongodb.net/logaggregator
   ```

### Step 3 — Start the Ingestion API

```bash
cd ingestion-api
npm install
npm start
# API running at http://localhost:4000
```

### Step 4 — Start the Worker (in a separate terminal)

```bash
cd ingestion-api
npm run worker
# Worker consuming from Redis queue
```

### Step 5 — Start Log Producers (in separate terminals)

```bash
cd log-producers
npm install

# Terminal 1:
node payment-service.js

# Terminal 2:
node auth-service.js

# Terminal 3:
node inventory-service.js
```

### Step 6 — Start the Dashboard

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

## Project Structure

```
multi-source-log-aggregator/
├── log-producers/               # 3 dummy service log generators
│   ├── payment-service.js       # Sends payment logs every 3s
│   ├── auth-service.js          # Sends auth logs every 4s
│   └── inventory-service.js     # Sends inventory logs every 5s
├── ingestion-api/               # Node.js + Express backend
│   ├── src/
│   │   ├── server.js            # Express + Socket.io server
│   │   ├── worker.js            # Queue consumer + transformer
│   │   ├── routes/
│   │   │   ├── ingest.js        # POST /api/ingest
│   │   │   └── logs.js          # GET /api/logs, /stats, /:id
│   │   ├── services/
│   │   │   ├── queue.js         # Redis pub/sub wrapper
│   │   │   ├── db.js            # MongoDB + Mongoose model
│   │   │   ├── s3.js            # AWS S3 upload/list/delete
│   │   │   └── alert.js         # Error rate sliding window
│   │   └── scripts/
│   │       └── archiveLogs.js   # S3 log rotation script
│   └── .env                     # Configuration
├── lambda/
│   └── processor.js             # AWS Lambda handler (production)
├── frontend/                    # React + Vite + Tailwind
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── StatsCards.jsx
│       │   ├── LogFilters.jsx
│       │   ├── LogTable.jsx
│       │   ├── LogDetailModal.jsx
│       │   └── AlertBanner.jsx
│       ├── services/api.js
│       └── hooks/useSocket.js
└── docker-compose.yml           # Redis
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ingest` | Accept a log from a producer |
| GET | `/api/logs` | Query logs (filters + pagination) |
| GET | `/api/logs/stats` | Aggregate counts by level/app |
| GET | `/api/logs/:id` | Single log detail |
| GET | `/api/health` | Server health + queue depth |

### Query params for GET /api/logs:
- `app_name` — `Payment-Service` | `Auth-Service` | `Inventory-Service`
- `level` — `INFO` | `WARN` | `ERROR` | `DEBUG`
- `search` — text search in message field
- `startDate` / `endDate` — ISO date strings
- `page` / `pageSize` — pagination

## Log Schema

```json
{
  "app_name":    "Payment-Service",
  "level":       "ERROR",
  "message":     "Payment gateway timeout after 30s",
  "timestamp":   1711123200,
  "environment": "production",
  "metadata": {
    "request_id": "abc-123",
    "order_id":   "ORD-12345",
    "amount":     1500.00,
    "duration_ms": 30000
  }
}
```

## AWS Setup (Optional)

If you want S3 archival and SNS alerting:

1. Create an S3 bucket: `aws s3 mb s3://log-archive-demo`
2. Create an SNS topic and subscribe your email
3. Set credentials in `ingestion-api/.env`

### Deploy Lambda (production replacement for worker):
```bash
cd lambda
npm install
zip -r lambda.zip .
aws lambda create-function \
  --function-name log-aggregator-processor \
  --runtime nodejs18.x \
  --handler processor.handler \
  --zip-file fileb://lambda.zip \
  --role arn:aws:iam::ACCOUNT:role/lambda-role
```

Then configure an SQS trigger on the Lambda.

## Log Rotation

Archive logs older than 7 days from S3 (compresses daily batches to .gz):

```bash
cd ingestion-api
npm run archive
```

## Alerting

The system fires an alert when ≥10 ERROR logs are received within 60 seconds:
- WebSocket `alert` event → red banner on dashboard
- AWS SNS notification → email (if configured)

Thresholds configurable in `.env`:
```
ERROR_ALERT_THRESHOLD=10
ERROR_ALERT_WINDOW_MS=60000
```

## Resume Highlights

- **Streaming pipeline**: Redis-buffered ingestion handles traffic spikes without DB overload
- **Dual storage**: Raw files in S3 (data lake) + indexed MongoDB documents (query layer)
- **Real-time**: Socket.io WebSocket pushes new logs to dashboard instantly
- **AWS Lambda**: Serverless processor triggered by SQS (production architecture)
- **Log rotation**: S3 archival script with gzip compression (standard DE practice)
- **TTL indexes**: MongoDB auto-expires logs after 7 days
- **Alerting**: Sliding-window error rate detection with SNS notifications
