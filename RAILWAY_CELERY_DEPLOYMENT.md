# Railway Celery Worker Deployment Guide

This guide explains how to deploy the Celery worker on Railway to handle background tasks (grading, email, RAG ingestion).

---

## Why Railway for Celery?

- **Render** hosts the main FastAPI web service
- **Railway** hosts the Celery worker (separate service)
- Both connect to the same **Upstash Redis** and **Neon PostgreSQL**

This separation allows independent scaling of web and worker processes.

---

## Prerequisites

1. **Railway Account**: [railway.app](https://railway.app)
2. **GitHub Repository**: Your backend code must be in a GitHub repo
3. **Upstash Redis URL**: From your Upstash dashboard (format: `rediss://default:password@host:port`)
4. **Neon Database URL**: From your Neon dashboard

---

## Step 1: Create Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub repo**
3. Select your `scira-backend` repository
4. Railway will detect the Dockerfile

---

## Step 2: Configure Build Settings

Railway will use the `railway.json` configuration:

```json
{
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "docker/Dockerfile.worker"
    },
    "deploy": {
        "startCommand": "celery -A app.core.celery_app worker -Q grading,celery --loglevel=info --concurrency=1 --max-tasks-per-child=1000",
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 10
    }
}
```

This tells Railway to:
- Build using `docker/Dockerfile.worker`
- Start the Celery worker with grading and celery queues
- Auto-restart on failure

---

## Step 3: Set Environment Variables

In Railway dashboard → **Variables** tab, add:

### Required Variables

```env
# Database (Neon)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Redis (Upstash) - CRITICAL: Free tier only supports DB 0
CELERY_BROKER_URL=rediss://default:password@host:port/0
CELERY_RESULT_BACKEND=rediss://default:password@host:port/0

# App Settings
ENVIRONMENT=production
DEBUG=false

# Security
SECRET_KEY=your-secret-key-here

# LLM (OpenAI)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
LLM_PROVIDER=openai
LLM_TYPE=gpt-4o

# TTS/STT
DEEPGRAM_API_KEY=your-deepgram-key
TTS_PROVIDER=openai
STT_PROVIDER=deepgram

# AWS S3 (for snapshots)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=scira-media-dev
S3_SNAPSHOT_PREFIX=snapshots/

# Email (Resend)
EMAIL_SENDER=noreply@scire.in
RESEND_API_KEY=re_...

# Frontend URL (for email links)
FRONTEND_URL=https://scire.in
```

### Important Notes

1. **Upstash Free Tier Limitation**: 
   - Upstash free tier **only supports database 0** (`/0`)
   - Both `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` must use `/0`
   - The code uses key prefixes (`celery-results:`) to separate broker and result data
   - Main app cache also uses `/0` but with different key patterns

2. **SSL Configuration**: The code handles `rediss://` URLs with `ssl.CERT_NONE`

3. **Same Credentials**: Use the **same** Upstash Redis and Neon DB as your Render web service

---

## Step 4: Deploy

1. Click **Deploy** in Railway
2. Monitor the build logs
3. Check for successful startup:
   ```
   [2026-02-03 00:00:00,000: INFO/MainProcess] Connected to rediss://...
   [2026-02-03 00:00:00,000: INFO/MainProcess] celery@worker ready.
   ```

---

## Step 5: Verify Connection

From your Render web service logs, you should see:
```
INFO: Celery worker is reachable
```

Test by triggering a grading task from the frontend.

---

## Troubleshooting

### Error: `ValueError: Port could not be cast to integer value as 'port'`

**Cause**: `CELERY_BROKER_URL` has placeholder text instead of actual Redis URL

**Fix**: Set the correct Upstash Redis URL in Railway variables

---

### Error: `ssl_cert_reqs must be set to CERT_REQUIRED, CERT_OPTIONAL, or CERT_NONE`

**Cause**: Using `rediss://` without SSL configuration

**Fix**: Already fixed in `celery_app.py` with:
```python
import ssl

broker_transport_options={
    'ssl_cert_reqs': ssl.CERT_NONE,
}

redis_backend_use_ssl={
    'ssl_cert_reqs': ssl.CERT_NONE,
}
```

---

### Error: `Only 0th database is supported! Selected DB: 1`

**Cause**: Upstash free tier only supports Redis database 0

**Fix**: 
1. Update Railway environment variables to use `/0`:
   ```
   CELERY_BROKER_URL=rediss://...@host:port/0
   CELERY_RESULT_BACKEND=rediss://...@host:port/0
   ```
2. The code uses key prefixes to separate data in the same database
3. Redeploy after updating variables

---

### Error: `Connection refused` or `timeout`

**Cause**: Wrong Redis URL or network issue

**Fix**: 
1. Verify Upstash Redis URL is correct
2. Check Upstash dashboard for connection limits
3. Ensure `/0` is appended to URLs (not `/1` or `/2`)

---

### Worker not processing tasks

**Cause**: Queue mismatch or worker not connected

**Fix**:
1. Check worker logs for `celery@worker ready`
2. Verify queue names match in `task_routes` config
3. Restart Railway service

---

## Monitoring

### Railway Dashboard
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time Celery worker logs
- **Deployments**: Build history and rollback

### Celery Flower (Optional)
Add Flower for web-based monitoring:
```bash
# In Railway, change start command to:
celery -A app.core.celery_app flower --port=5555
```

---

## Scaling

Railway auto-scales based on:
- Memory usage (worker restarts if > 250MB per child)
- Task count (max 1000 tasks per child process)

To handle more load:
1. Increase `concurrency` in start command
2. Add more Railway services (horizontal scaling)
3. Upgrade Railway plan for more resources

---

## Cost Optimization

- **Starter Plan**: $5/month (512MB RAM, 1GB disk)
- **Pro Plan**: $20/month (8GB RAM, 100GB disk)
- **Sleep Mode**: Railway can pause services when idle (not recommended for workers)

---

## Security Checklist

- [ ] All secrets in Railway variables (not in code)
- [ ] `DEBUG=false` in production
- [ ] Upstash Redis has password authentication
- [ ] Neon DB uses SSL (`?sslmode=require`)
- [ ] Railway service is private (not exposed to internet)
