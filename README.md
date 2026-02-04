# Scira Backend Documentation

**Last Updated**: February 3, 2026  
**Version**: 3.1

Welcome to the Scira backend documentation. This directory contains comprehensive guides on the system architecture, implementation details, and operational procedures.

---

## 📚 Documentation Index

### Core Architecture
- **[System Design](./SYSTEM_DESIGN.md)** - High-level architecture, multi-tenancy, data flows, and ER diagrams
- **[Database Models](./DATABASE_MODELS.md)** - Detailed database schema and relationships
- **[Exam Flow](./EXAM_FLOW.md)** - End-to-end exam workflow from creation to grading

### Payment & Subscription (NEW)
- **[Payment System](./PAYMENT_SYSTEM.md)** - Razorpay integration, server-side pricing, security measures
- **[Quota Enforcement](./QUOTA_ENFORCEMENT.md)** - Student and exam quotas, enforcement strategy, monitoring

### Frontend Integration
- **[Frontend Architecture](./FRONTEND_ARCHITECTURE.md)** - Next.js application structure and patterns
- **[Frontend Workflow](./FRONTEND_WORKFLOW.md)** - Component design and state management

### Deployment & Operations
- **[Railway Celery Deployment](./RAILWAY_CELERY_DEPLOYMENT.md)** - Deploying background workers
- **[Site24x7 Guide](./site24x7_guide.md)** - Monitoring and alerting setup
- **[SSO Setup Guide](./SSO_SETUP_GUIDE.md)** - Single Sign-On configuration

---

## 🏗️ System Overview

Scira is a **Multi-Tenant AI Viva Platform** that enables organizations to conduct automated oral examinations using voice AI.

### Key Features
- 🏢 **Multi-Tenancy**: Full isolation with shared database and Row-Level Security
- 💳 **Payment Integration**: Razorpay with server-side pricing (FREE, PRO, ENTERPRISE)
- 📊 **Quota Management**: Automated enforcement of student and exam limits
- 🎙️ **Real-Time Voice AI**: Sub-500ms latency viva conversations
- 🎓 **Automated Grading**: LLM-powered rubric-based evaluation
- 🔒 **Enterprise Security**: RBAC, audit logs, integrity monitoring
- 📧 **Email Notifications**: Resend API integration for result delivery

---

## 🎯 Quick Links

### For New Developers
1. Start with [System Design](./SYSTEM_DESIGN.md) for the big picture
2. Read [Database Models](./DATABASE_MODELS.md) to understand data relationships
3. Review [Exam Flow](./EXAM_FLOW.md) for the core user journey
4. Check [Payment System](./PAYMENT_SYSTEM.md) for subscription management

### For Frontend Developers
- [Frontend Architecture](./FRONTEND_ARCHITECTURE.md)
- [Frontend Workflow](./FRONTEND_WORKFLOW.md)

### For DevOps
- [Railway Celery Deployment](./RAILWAY_CELERY_DEPLOYMENT.md)
- [Site24x7 Guide](./site24x7_guide.md)

---

## 🔄 Recent Updates (v3.1 - Feb 3, 2026)

### Payment & Subscription System
- ✅ Razorpay integration with server-side pricing
- ✅ Three tiers: FREE (₹0), PRO (₹4,999/mo), ENTERPRISE (Custom)
- ✅ Automatic quota upgrades on successful payment
- ✅ HMAC-SHA256 signature verification for security

### Quota Enforcement
- ✅ Student quota (`max_students`): 50 / 1,000 / 100,000
- ✅ Exam quota (`max_exams_per_month`): 5 / 100 / 10,000
- ✅ API-layer enforcement with 402 Payment Required errors
- ✅ Frontend displays upgrade prompts on quota exceeded

### Security Enhancements
- ✅ Server-side pricing prevents client manipulation
- ✅ Tenant-scoped payment records
- ✅ Idempotent payment verification
- ✅ Comprehensive audit logging

---

## 📊 Architecture Highlights

### Multi-Tenancy Strategy
- **Shared Database, Shared Schema** with `tenant_id` discriminator
- **ContextVar** for thread-safe tenant isolation per request
- **Row-Level Security** enforced at database level
- **Tenant-Prefixed Keys** in Redis for cache isolation

### Payment Flow
```
Client → Backend (plan_id) → Lookup Price → Razorpay Order
  ↓
User Completes Payment in Razorpay Modal
  ↓
Backend Verifies Signature → Upgrade Tenant → Update Quotas
```

### Quota Enforcement
```
API Request → Authorization → Quota Check → Create Resource
                              ↓ (if exceeded)
                        402 Payment Required
```

---

## 🧪 Development Setup

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@host/db

# Razorpay
RAZORPAY_KEY_ID=rzp_test_***
RAZORPAY_KEY_SECRET=***

# AI Services
OPENAI_API_KEY=sk-***
DEEPGRAM_API_KEY=***
ELEVENLABS_API_KEY=***

# Email
RESEND_API_KEY=re_***
```

### Running Locally
```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload

# Start Celery workers
celery -A app.core.celery_app worker --loglevel=info
```

---

## 🛠️ Tech Stack

### Backend
- **FastAPI**: Async web framework
- **PostgreSQL**: Primary database with pgvector extension
- **Redis**: Session state and caching
- **Celery**: Background task processing
- **SQLAlchemy**: ORM with async support

### External Services
- **Razorpay**: Payment processing
- **Deepgram**: Real-time speech-to-text
- **OpenAI**: GPT-4o for AI logic and embeddings
- **ElevenLabs**: Text-to-speech synthesis
- **Resend**: Transactional email delivery
- **AWS S3**: Object storage

---

## 📝 API Documentation

Interactive API docs available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 🔐 Security Best Practices

1. **Never Trust Client Input**: All prices, quotas, and limits are server-side
2. **Verify Signatures**: All payment webhooks verified with HMAC-SHA256
3. **Tenant Isolation**: Every query filtered by `tenant_id`
4. **Audit Everything**: Sensitive actions logged with IP and metadata
5. **Rate Limiting**: Protect API endpoints from abuse

---

## 📊 Monitoring & Observability

### Key Metrics
- Payment success rate: `CAPTURED / CREATED`
- Quota hit rate: `402 errors / total requests`
- Upgrade conversion rate: `Upgrades / Quota errors`
- Session completion rate: `COMPLETED / STARTED`

### Recommended Alerts
- Failed payment signature verification (security)
- Payments stuck in CREATED status > 1 hour
- High quota error rate (> 10% of tenants)
- Database connection pool exhaustion

---

## 🤝 Contributing

When updating documentation:
1. Update version number in relevant files
2. Add "Last Updated" timestamp
3. Update this README index if adding new docs
4. Include mermaid diagrams for complex flows
5. Cross-reference related documentation

---

## 📞 Support

For technical questions:
- Review existing documentation first
- Check code comments in `app/` directory
- Contact: Mukul Anand

---

**Note**: This documentation reflects the production system as of v3.1 (February 3, 2026).
