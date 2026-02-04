# Site24x7 APM Setup Guide (Multi-Tenant)

**Version:** 3.0  
**Last Updated:** February 1, 2026

---

## Quick Start

### 1. Get License Key
1. Sign up at [Site24x7](https://www.site24x7.com/signup.html) (30-day free trial)
2. Go to **Admin → Developer → APM Insight → Python**
3. Copy your license key

### 2. Install SDK
```bash
pip install apminsight
```

### 3. Configure `.env`
```bash
SITE24X7_ENABLED=true
SITE24X7_LICENSE_KEY=your_license_key_here
```

### 4. Restart Server
```bash
uvicorn app.main:app --reload
```

---

## What Gets Monitored

- **Request latency** - Automatic HTTP timing
- **Error rates** - Exceptions tracked
- **Slow queries** - DB performance
- **API endpoints** - Per-route metrics

### Multi-Tenant Metrics (NEW - v3.0)

| Metric | Description |
|--------|-------------|
| `tenant_id` tag | All traces tagged with tenant |
| `tenant.active_sessions` | Active sessions per tenant |
| `tenant.api_calls` | API calls per tenant |
| `tenant.grading_queue` | Pending grading tasks per tenant |

---

## Multi-Tenant Monitoring Best Practices

### 1. Tag All Traces with Tenant
The `TenantContextMiddleware` automatically adds `tenant_id` to all traces:

```python
# Already implemented in app/core/tenant_context.py
def set_tenant_context(tenant_id: str):
    # APM trace tagging happens here
    pass
```

### 2. Create Tenant-Specific Dashboards
1. **Admin → Dashboards → Create**
2. Add filter: `tenant_id = <specific_tenant>`
3. Track:
   - Request latency per tenant
   - Error rates per tenant
   - Active sessions per tenant

### 3. Tenant Isolation Alerts
Set up alerts for cross-tenant anomalies:
- Unusual traffic from single tenant
- High error rate for specific tenant
- Slow queries affecting specific tenant

---

## Dashboard Access

1. Login to [Site24x7](https://www.site24x7.com/login.html)
2. Go to **APM → Python → Your App**
3. View real-time metrics
4. Filter by `tenant_id` for tenant-specific views

---

## Alerting (Optional)

### Global Alerts
1. **Admin → Configuration Profiles → Thresholds**
2. Set alert for:
   - Response time > 2s
   - Error rate > 5%
   - CPU > 80%

### Tenant-Specific Alerts (NEW)
1. **Admin → IT Automation → Conditions**
2. Add condition: `tenant_id == <tenant>`
3. Set custom thresholds per tenant (e.g., premium tenants get 1s threshold)

---

## Troubleshooting

### APM Not Reporting
```python
# Test connection
python -c "import apminsight; print('SDK installed')"
```

### Check Logs
```bash
grep "Site24x7" logs/app.log
```

### Verify Tenant Tags
```bash
# In APM dashboard, check if tenant_id appears in trace tags
# If missing, verify TenantContextMiddleware is loaded
```

---

## Comparison: Prometheus vs Site24x7

| Feature | Prometheus | Site24x7 |
|---------|------------|----------|
| Setup | Self-hosted | Cloud SaaS |
| Dashboards | Need Grafana | Built-in |
| Alerting | Alertmanager | Built-in |
| Free tier | Unlimited | 30 days |
| Maintenance | You manage | Zero |
| Multi-Tenant | Custom tags | Custom tags |

---

## Removed Files

The following Prometheus files are no longer used:
- `app/monitoring/prometheus.py` (can be deleted)
