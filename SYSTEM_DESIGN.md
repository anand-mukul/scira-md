# Scire - System Design Document

**Version:** 3.1  
**Last Updated:** February 3, 2026  
**Author:** Mukul Anand

---

## 1. 🏗️ High-Level Architecture

Scire follows a **Multi-Tenant, Event-Driven, Service-Oriented Architecture** built on a monolithic FastAPI core. It leverages asynchronous processing for real-time interactions (Voice/AI) and background workers for heavy lifting (Grading, Notifications).

```mermaid
graph TD
    User[Student / Instructor] -->|HTTPS / WSS| LoadBalancer[Nginx / Cloud Load Balancer]
    LoadBalancer -->|API Requests| API[FastAPI Server Cluster]
    LoadBalancer -->|WebSocket Audio| API
    
    subgraph "Core Backend"
        API -->|Auth & Tenant Context| DB[(PostgreSQL + pgvector + RLS)]
        API -->|Session State FSM| Redis[(Redis Cache - Tenant Prefixed)]
        API -->|Async Tasks| Celery[Celery Workers]
        API -->|Media Upload| S3[AWS S3 Storage]
        API -->|Quota Check| QuotaSvc[Quota Enforcement Service]
        API -->|Payments| PaymentGateway[Razorpay Gateway]
    end
    
    subgraph "Multi-Tenancy Layer"
        API -->|Tenant Context| TenantCtx[ContextVar Middleware]
        TenantCtx -->|Isolation| DB
        TenantCtx -->|Scoped Keys| Redis
        QuotaSvc -->|Check Limits| DB
    end
    
    subgraph "Payment & Subscription"
        PaymentGateway -->|Order Creation| RazorpayAPI[Razorpay API]
        PaymentGateway -->|Signature Verify| RazorpayAPI
        PaymentGateway -->|Upgrade Tenant| DB
        QuotaSvc -->|Enforce Limits| PaymentGateway
    end
    
    subgraph "External AI Services"
        API -->|Streaming Audio| Deepgram[Deepgram ASR]
        API -->|Context & Logic| LLM[OpenAI GPT-4o]
        API -->|Streaming Voice| TTS[ElevenLabs / OpenAI TTS]
    end
    
    subgraph "Notification Services"
        Celery -->|Result Emails| Resend[Resend API]
    end
    
    Celery -->|Fetch Data with Tenant| DB
    Celery -->|Store Grades| DB
```

---

## 2. 🏢 Multi-Tenancy Architecture (NEW - v3.0)

### 2.1 Tenant Model
Each organization is represented by a `Tenant` entity:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Organization name |
| `slug` | String | URL-safe identifier |
| `domain` | String | Custom domain (optional) |
| `status` | Enum | ACTIVE, SUSPENDED, TRIAL |
| `subscription_tier` | String | FREE, PRO, ENTERPRISE |
| `max_students` | Integer | Student quota limit |
| `max_exams_per_month` | Integer | Monthly exam creation limit |
| `settings` | JSONB | Quotas, branding, features |

### 2.2 Tenant Isolation Strategy
- **Shared Database, Shared Schema**: All tenants share tables with `tenant_id` discriminator
- **Row-Level Security (RLS)**: Database-level enforcement
- **Tenant Context**: `ContextVar` for thread-safe isolation per request
- **JWT Claims**: Tokens include `tenant_id` and `tenant_slug`

### 2.3 Tenant Context Flow
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Middleware
    participant ContextVar
    participant Service
    participant DB

    Client->>API: Request with JWT
    API->>Middleware: Validate Token
    Middleware->>ContextVar: Set tenant_id
    API->>Service: Business Logic
    Service->>ContextVar: get_current_tenant_id()
    Service->>DB: Query with tenant_id filter
    DB-->>Service: Tenant-scoped data
    Service-->>API: Response
    Middleware->>ContextVar: Clear context
```

---

## 3. 🔄 Core Data Workflows

### 3.1 Exam Join Flow
Students must use an **Exam Access Code** to join exams (scoped to tenant).

```mermaid
sequenceDiagram
    participant Student
    participant Frontend
    participant API
    participant TenantCtx
    participant DB

    Student->>Frontend: Enter Exam Code
    Frontend->>API: POST /exams/join {exam_code}
    API->>TenantCtx: Get current tenant_id
    API->>DB: Validate Code + Check Attempts (tenant-scoped)
    alt Code Valid & Attempts Available
        API->>DB: Create Session (PENDING) with tenant_id
        API-->>Frontend: Return Session
    else Invalid or Max Attempts
        API-->>Frontend: 400/404 Error
    end
```

### 3.2 Pre-Exam Onboarding Flow
Before starting, students must complete mandatory onboarding.

```mermaid
sequenceDiagram
    participant Student
    participant Frontend
    participant API
    participant S3

    Note over Student, API: Step 1: Accept Terms
    Student->>Frontend: View Rules & Accept T&C
    Frontend->>API: POST /sessions/{id}/onboarding {accepted: true}
    API-->>Frontend: Session Updated

    Note over Student, S3: Step 2: Identity Snapshot
    Frontend->>API: POST /sessions/{id}/upload-url
    API-->>Frontend: {url: "s3://signed-url", key: "tenant/snapshots/..."}
    Frontend->>S3: PUT Image (Signed URL)
    S3-->>Frontend: 200 OK
    Frontend->>API: POST /sessions/{id}/snapshot {snapshot_url}
    API-->>Frontend: Session Updated (Ready to Start)
```

### 3.3 The "Viva Loop" (Real-Time Voice Interaction)
This flow requires sub-500ms latency to feel natural.

1.  **Ingestion**: Client streams raw audio (binary) via WebSocket.
2.  **Transduction (ASR)**: Server forwards stream to **Deepgram**.
3.  **Logic (LLM)**:
    *   ASR Text + Conversation History + Exam Context -> sent to **LLM**.
    *   LLM generates response text.
4.  **Synthesis (TTS)**: Response text streamed to **ElevenLabs** or **OpenAI**.
5.  **Delivery**: TTS Audio + Text Transcript sent back to Client via WebSocket.
6.  **State Management**: `SessionStateService` updates FSM in Redis with **tenant-prefixed keys**.

### 3.4 The Grading & Notification Pipeline (Asynchronous)
Grading is decoupled from the live session with tenant context propagation.

```mermaid
sequenceDiagram
    participant API
    participant Redis
    participant Celery
    participant LLM
    participant DB
    participant Resend

    API->>Redis: Enqueue grade_session_task(session_id, tenant_id)
    Celery->>Redis: Claim Task
    Celery->>Celery: Set tenant context
    Celery->>DB: Fetch Rubrics & Transcript (tenant-scoped)
    Celery->>LLM: Evaluate Transcript
    LLM-->>Celery: Scores & Reasoning
    Celery->>DB: Save Grades & Result Token
    Celery->>Redis: Enqueue send_result_email_task (5min delay)
    
    Note over Celery, Resend: After 5 Minutes
    Celery->>DB: Fetch Session & Student Email
    Celery->>Resend: Send Result Email via API
    Celery->>DB: Mark result_email_sent_at
    Celery->>Celery: Clear tenant context
```

---

## 4. 💾 Database Schema (ER Diagram)

The data model centers around the `Tenant`, `Exam` and `VivaSession` entities.

```mermaid
erDiagram
    Tenant ||--o{ User : contains
    Tenant ||--o{ Exam : owns
    Tenant ||--o{ VivaSession : hosts
    Tenant ||--o{ Department : organizes
    Tenant ||--o{ Payment : processes
    Tenant ||--o{ AuditLog : tracks
    Tenant {
        uuid id PK
        string name
        string slug UK
        string domain UK
        string logo_url
        string primary_color
        enum status "ACTIVE, SUSPENDED, TRIAL"
        string subscription_tier "free, pro, enterprise"
        int max_students
        int max_exams_per_month
        json settings
        string data_residency
        bool gdpr_enabled
    }

    OrganizationRequest {
        uuid id PK
        string name
        string email
        string slug
        string full_name
        string status "PENDING, APPROVED, REJECTED"
        string use_case
    }

    User ||--o{ Exam : creates
    User ||--o{ VivaSession : takes
    User {
        uuid id PK
        uuid tenant_id FK
        string email UK
        string role "STUDENT, INSTRUCTOR, ADMIN, REVIEWER, PLATFORM_ADMIN"
        string full_name
        bool is_active
    }

    Exam ||--o{ Rubric : contains
    Exam ||--o{ VivaSession : spawns
    Exam ||--o{ KnowledgeBase : has
    Exam {
        uuid id PK
        uuid tenant_id FK
        string title
        string exam_code UK
        json settings
        int max_attempts
        string status "DRAFT, PUBLISHED, ACTIVE, ARCHIVED"
    }

    Rubric {
        uuid id PK
        uuid exam_id FK
        string criterion
        string weight
        bool is_mandatory
        int order_index
    }

    VivaSession ||--o{ Transcript : has
    VivaSession ||--o{ GradingDetail : produces
    VivaSession ||--o{ IntegritySnapshot : monitors
    VivaSession {
        uuid id PK
        uuid tenant_id FK
        uuid exam_id FK
        uuid student_id FK
        uuid assigned_reviewer_id FK
        int attempt_number
        string status
        string review_status
        string review_notes
        bool onboarding_accepted
        string snapshot_url
        string result_token UK
        float final_score
        float confidence_score
        bool integrity_flag
    }

    Transcript {
        uuid id PK
        uuid session_id FK
        int turn_index
        string speaker "STUDENT, AI, SYSTEM"
        string text_content
        string audio_url
    }

    GradingDetail {
        uuid id PK
        uuid session_id FK
        uuid rubric_id FK
        float score_awarded
        string ai_reasoning
        bool passed
    }

    KnowledgeBase {
        uuid id PK
        uuid tenant_id FK
        uuid exam_id FK
        string content_chunk
        vector embedding
        string source
    }

    IntegritySnapshot {
        uuid id PK
        uuid session_id FK
        float face_similarity
        float voice_similarity
        int tab_switches
        float noise_score
        bool flagged
        string reason
    }

    AuditLog {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        uuid session_id FK
        string action
        json log_metadata
        string ip_address
    }

    Department ||--o{ Subject : contains
    Department {
        uuid id PK
        uuid tenant_id FK
        string name
        string code
        string description
        uuid head_user_id FK
        bool is_active
    }

    Subject {
        uuid id PK
        uuid department_id FK
        uuid tenant_id FK
        string name
        string code
        string description
        int credits
        bool is_active
    }

    Payment {
        uuid id PK
        uuid tenant_id FK
        string order_id UK
        string payment_id
        string signature
        int amount
        string status
        json notes
    }
```

---

## 5. 🛡️ Security & Compliance Design

### 5.1 Role-Based Access Control (RBAC)
We enforce a strict hierarchy with tenant isolation:

| Role | Scope | Access |
|------|-------|--------|
| **PLATFORM_ADMIN** | Cross-tenant | All operations, user management, audit logs |
| **ADMIN** | Tenant-scoped | Tenant settings, departments, subjects |
| **INSTRUCTOR** | Tenant-scoped | Own exams (CRUD), session monitoring |
| **REVIEWER** | Tenant-scoped | Review grades, integrity data, flag sessions |
| **STUDENT** | Tenant-scoped | Own sessions, view results |

### 5.2 Tenant Isolation Enforcement
*   **JWT Validation**: Token's `tenant_id` must match user's `tenant_id`
*   **Tenant Status Check**: Suspended tenants are blocked
*   **Query Filtering**: All queries include `tenant_id` filter
*   **Background Tasks**: Tenant context passed and set in workers

### 5.3 Anti-Cheat Measures
*   **Integrity Snapshots**: Client sends regular heartbeats containing:
    *   `tab_switches`: Count of focus loss events.
    *   `noise_level`: Environmental audio checks.
*   **Replay Protection**: Timestamps on snapshots must be strictly increasing.
*   **Immutability**: Once an Exam is `PUBLISHED`, it becomes Read-Only.
*   **Identity Verification**: One-time photo snapshot at exam start.

### 5.4 Audit Trail
A dedicated `audit_logs` table records every sensitive action with:
*   **tenant_id**: Tenant isolation for logs
*   **actor_id**: Who did it
*   **action**: What they did
*   **metadata**: Before/After diffs
*   **ip_address**: Where they came from

---

## 6. 🚀 Scalability Strategy

*   **Stateless API**: The FastAPI servers hold no exam state. All state is in **Redis** with tenant-prefixed keys. This allows horizontal scaling of API nodes behind a Load Balancer.
*   **Async Grading & Notifications**: Heavy grading jobs and email sending are offloaded to queues with tenant context. If load spikes, we simply add more Celery Workers.
*   **Vector Search (Implemented)**: Postgres `pgvector` stores syllabus embeddings with `tenant_id` filtering. Queries use Cosine Similarity for RAG.
*   **Object Storage**: All media stored in S3 with tenant-prefixed keys for isolation.

---

## 7. 📚 RAG Knowledge Engine

*   **Vector Storage**: Uses `pgvector` on PostgreSQL with tenant-scoped embeddings.
*   **Hybrid AI Stack**:
    *   **Chat**: OpenAI GPT-4o for high-quality conversational logic.
    *   **Embeddings**: OpenAI (text-embedding-ada-002) for high-quality retrieval.
*   **Workflow**:
    1.  Instructor uploads Syllabus (`POST /exams/{id}/syllabus`).
    2.  Text is chunked and embedded with `tenant_id`.
    3.  Viva questions are generated using tenant-scoped context retrieval.

---

## 8. 🔑 New Features Summary (v3.0)

| Feature | Description |
|---------|-------------|
| **Multi-Tenancy** | Full tenant isolation with shared schema and RLS |
| **PLATFORM_ADMIN** | Cross-tenant system administration role |
| **Tenant Management** | User management, quotas, settings per tenant |
| **Reviewer Queue** | Dedicated `/sessions/reviewer/queue` endpoint |
| **Grade Finalization** | Lock grades after APPROVED/REJECTED status |
| **Resend Integration** | Modern email API (replaces SMTP) |
| **Tenant Context** | Thread-safe isolation via ContextVar |
| **Quota Enforcement** | Student and exam quotas enforced at API layer |
| **Payment System** | Razorpay integration with server-side pricing |
| **Subscription Tiers** | FREE, PRO, ENTERPRISE with automatic quota upgrades |

---

## 9. 💳 Payment & Subscription System (NEW - v3.0)

### 9.1 Subscription Tiers

```mermaid
graph LR
    Free[FREE Tier<br/>50 students<br/>5 exams/month<br/>₹0] -->|Upgrade| Pro[PRO Tier<br/>1000 students<br/>100 exams/month<br/>₹4,999/month]
    Pro -->|Contact Sales| Enterprise[ENTERPRISE<br/>100K students<br/>10K exams/month<br/>Custom Pricing]
```

### 9.2 Payment Flow

1. **Order Creation**: Client sends `plan_id: "pro"`, server looks up price (₹4,999)
2. **Razorpay Checkout**: User completes payment in Razorpay modal
3. **Signature Verification**: Server verifies payment using HMAC-SHA256
4. **Tenant Upgrade**: Subscription tier and quotas updated automatically

### 9.3 Quota Enforcement

**Student Quota**: Checked before creating new students via `POST /tenants/me/users`
**Exam Quota**: Checked before creating exams via `POST /exams`

When exceeded, returns `402 Payment Required` with upgrade prompt.

**See detailed documentation**:
- [Payment System](file:///f:/devlopment/miniproject/scira-backend/docs/PAYMENT_SYSTEM.md)
- [Quota Enforcement](file:///f:/devlopment/miniproject/scira-backend/docs/QUOTA_ENFORCEMENT.md)
