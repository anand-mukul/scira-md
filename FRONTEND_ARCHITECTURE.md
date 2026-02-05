# Scire — Frontend Architecture & Integration Guide

**Version:** 3.0  
**Last Updated:** February 1, 2026  
**Status:** Canonical Reference for Frontend Development

---

## 📑 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Multi-Tenancy Integration](#2-multi-tenancy-integration)
3. [Authentication & Routing Strategy](#3-authentication--routing-strategy)
4. [The Viva Engine (Real-Time Logic)](#4-the-viva-engine-real-time-logic)
5. [Data Fetching & Mutations (REST API)](#5-data-fetching--mutations-rest-api)
6. [Anti-Cheat & Security Implementation](#6-anti-cheat--security-implementation)
7. [Master v0 Generation Prompt](#7-master-v0-generation-prompt)

---

## 1. Architecture Overview

**Scire Frontend** is a Next.js (App Router) application that serves as the interface for distinct user personas within a **multi-tenant** context: **Students**, **Instructors**, **Admins**, **Reviewers**, and **Platform Admins**. It relies heavily on **Server-Side Rendering (SSR)** for dashboards and **Client-Side Rendering (CSR)** for the real-time exam room.

### Tech Stack
*   **Framework:** Next.js (App Router)
*   **Styling:** Tailwind CSS + Shadcn/UI (Radix Primitives)
*   **State Management:**
    *   *Server State:* React Query (TanStack Query)
    *   *Local/UI State:* Zustand (for the active Exam Session FSM)
    *   *Tenant Context:* React Context for tenant-aware rendering
*   **Real-time:** Native `WebSocket` API (wrapped in a custom hook)
*   **Forms:** React Hook Form + Zod

---

## 2. Multi-Tenancy Integration (NEW - v3.0)

### 2.1 JWT Tenant Claims
The access token includes tenant information:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "STUDENT",
  "tenant_id": "tenant-uuid",
  "tenant_slug": "acme-university",
  "exp": 1706800000
}
```

### 2.2 Tenant Context Provider

```tsx
// contexts/TenantContext.tsx
interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantSettings: TenantSettings;
}

export const TenantProvider = ({ children }) => {
  const { user } = useAuth();
  const tenant = useMemo(() => ({
    tenantId: user?.tenant_id,
    tenantSlug: user?.tenant_slug,
    // Fetch tenant details on mount
  }), [user]);
  
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
};
```

### 2.3 Tenant-Aware API Calls
All API calls automatically include tenant context via JWT:

```tsx
// hooks/useApi.ts
const useApi = () => {
  const { accessToken } = useAuth();
  
  const fetchWithTenant = async (url: string, options?: RequestInit) => {
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  };
  
  return { fetchWithTenant };
};
```

---

## 3. Authentication & Routing Strategy

We use JWT-based authentication via HTTP-Only cookies (handled by backend) and role-based routing with tenant awareness.

### Auth Middleware
The frontend middleware must decode the JWT (non-secure payload) to route users:

| Role | Tenant Scope | Landing Page | Allowed Routes |
| :--- | :--- | :--- | :--- |
| **PLATFORM_ADMIN** | Cross-tenant | `/platform/tenants` | All Routes |
| **ADMIN** | Tenant-scoped | `/admin/dashboard` | `/admin/*`, `/dashboard/*` |
| **INSTRUCTOR** | Tenant-scoped | `/dashboard/manage` | `/dashboard/manage/*`, `/grading/*` |
| **REVIEWER** | Tenant-scoped | `/grading/queue` | `/grading/*` |
| **STUDENT** | Tenant-scoped | `/dashboard/exams` | `/dashboard/*`, `/results/*` |
| **Public** | None | `/login` | `/login`, `/register`, `/request-access`, `/results/verify/*` |
| **Any** | - | - | `/tenant-suspended`, `/unauthorized` |

### Auth API Map
*   `POST /api/v1/auth/login` → Returns `access_token` (includes `tenant_id`) + sets `refresh_token` cookie.
*   `POST /api/v1/auth/refresh` → Call this on 401 response interceptor.
*   `GET /api/v1/auth/me` → Returns User Profile + Role + Tenant info.

### Tenant-Aware Middleware

```tsx
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token');
  const decoded = decodeJwt(token);
  
  // Validate tenant is active
  if (decoded?.tenant_status === 'SUSPENDED') {
    return NextResponse.redirect('/tenant-suspended');
  }
  
  // Route based on role
  if (!isRouteAllowed(decoded?.role, request.nextUrl.pathname)) {
    return NextResponse.redirect('/unauthorized');
  }
}
```

---

## 4. The Viva Engine (Real-Time Logic)

The **Viva Room** (`/dashboard/student/exam/[id]/session`) is the most complex component. It functions as a **Finite State Machine (FSM)** mirror of the backend.

### 4.1 Session Lifecycle States
The frontend must react to these backend states (received via WebSocket `state_update`):

1.  **INIT**: Connecting to WS. Show loader.
2.  **AUTH**: Sending token (includes tenant validation).
3.  **READY**: Connected. Waiting for user to speak/start.
4.  **LISTENING**: User is speaking (VAD Active).
5.  **PROCESSING**: User stopped speaking. AI is thinking. Show pulsing "Thinking" animation.
6.  **SPEAKING**: AI is answering. **Play Audio Buffer**.
7.  **COMPLETED**: Exam finished. Redirect to generic "Processing Results" page.

### 4.2 WebSocket Protocol
**Base URL:** `wss://API_URL/api/v1/ws/session/{session_id}?token={jwt}`

> **Note**: The JWT token automatically authenticates the user AND validates their tenant access.

#### 📥 Client Receives (Events)
| Event Type | Payload | Action |
| :--- | :--- | :--- |
| `state_update` | `{"state": "LISTENING"}` | Update UI mode (hide/show mic, change avatar state) |
| `agent_response` | `{"audio": "base64...", "text": "..."}` | 1. Queue audio in `AudioContext`. <br> 2. Show text subtitle. |
| `transcript` | `{"text": "...", "speaker": "user"}` | Append to chat history visually. |
| `error` | `{"message": "..."}` | Show error toast. If critical, overlay error screen. |
| `tenant_error` | `{"message": "Tenant suspended"}` | Immediately disconnect and show tenant error |

#### 📤 Client Sends (commands)
| Logic | Format | Frequency |
| :--- | :--- | :--- |
| **Audio** | Binary (PCM 16-bit, 16kHz) | Streaming (Chunked ~250ms) |
| **KeepAlive** | `{"type": "ping"}` | Every 30s |
| **Integrity** | `{"type": "integrity_snapshot", "data": {...}}` | Every 10s |

---

## 5. Data Fetching & Mutations (REST API)

### Exam Management (Instructor)
*   **Create Exam:** `POST /api/v1/exams` (Wizard style) - auto-assigns `tenant_id`
*   **Upload Syllabus:** `POST /api/v1/exams/{id}/syllabus` (Raw text) - stores with `tenant_id`
*   **Add Rubric:** `POST /api/v1/exams/{id}/rubrics`
*   **Publish:** `PATCH /api/v1/exams/{id}` (Sets status to PUBLISHED)

### Join & Onboarding (Student)
1.  **Join:** `POST /api/v1/exams/join` with `{"exam_code": "..."}`. Returns `session_id`.
2.  **Onboard:** `POST /api/v1/sessions/{id}/onboarding` with `{"accepted": true}`.
3.  **Upload URL:** `POST /api/v1/sessions/{id}/upload-url`. Returns S3 signed URL (tenant-prefixed).
4.  **Confirm Upload:** `POST /api/v1/sessions/{id}/snapshot`.
5.  **Start:** `POST /api/v1/sessions/{id}/start`.

### Grading (Reviewer)
*   **View Queue:** `GET /api/v1/sessions/reviewer/queue` - returns tenant-scoped sessions
*   **View Details:** `GET /api/v1/grading/sessions/{id}/details`
*   **Submit Review:** `POST /api/v1/grading/sessions/{id}/review` with `{"review_status": "APPROVED"}`.

### Tenant Management (Admin)
*   **List Users:** `GET /api/v1/tenants/me/users`
*   **Create User:** `POST /api/v1/tenants/me/users`
*   **View Usage:** `GET /api/v1/tenants/me/usage`

---

## 6. Anti-Cheat & Security Implementation

### A. Information Gathering
The frontend is the telemetry agent.
1.  **Tab Focus:** Listen to `document.visibilityState`. Increment `tab_switches` counter on `hidden`.
2.  **Noise Level:** Use `AudioContext` to measure RMS amplitude of mic input (0.0 to 1.0).
3.  **Browser Lock:** Render in **Full Screen Mode** (request `document.documentElement.requestFullscreen()`).
4.  **Device Check:** Enforce only 1 active screen (if detectable via browser API heuristics).

### B. Reporting
Every 10 seconds, send:
```json
{
  "type": "integrity_snapshot",
  "data": {
    "timestamp": "ISO_STRING",
    "tab_switches": 5,
    "noise_score": 0.45,
    "face_similarity": null
  }
}
```

### C. Alerts
*   If backend responds with `{"type": "warning", "message": "High Noise"}`, show a **Yellow Toast**.
*   If network disconnects, show **Red Overlay** ("Reconnecting..."). **DO NOT KICK USER**. Retry connection with exponential backoff.

---

## 7. Master v0 Generation Prompt

*Copy and paste the block below into v0.dev to generate the core frontend structure.*

```markdown
You are an expert Frontend Architect building "Scire," an advanced AI-Proctored Oral Exam Platform with Multi-Tenant support.
Your goal is to scaffold the application using Next.js 14 (App Router), Tailwind CSS, Lucide Icons, and Shadcn/UI.

### 🏢 Multi-Tenancy
- All API calls include JWT with `tenant_id` claim
- Create a `TenantContext` for tenant-aware rendering
- Tenant branding can be applied via settings

### 🎨 Design System & Aesthetics
- **Theme:** Academic, Trustworthy, Minimalist, Focus-Oriented.
- **Colors:**
  - Background: Slate-950 (Dark mode default for exam room) / Zinc-50 (Dashboard)
  - Primary: Emerald-600 (Confidence/Success)
  - Accent: Indigo-500 (AI/Tech)
  - Destructive: Rose-600 (Errors/Flags)
- **Typography:** Inter (UI), JetBrains Mono (Code/Data).
- **UX Principles:** "Frictionless Onboarding", "Calm Exam Environment".

### 🏗️ Directory Structure & Core Pages
Please generate the code for these critical routes:

#### 1. Student Dashboard (`/dashboard/exams`)
- **Layout:** Sidebar navigation (Exams, Results, Profile).
- **Core Component:** `ExamJoinCard`.
  - Simple card with an input field for "Exam Code".
  - Large "Join Session" button.
  - List of "Recent Results" below.

#### 2. Onboarding Flow (`/session/[id]/onboarding`)
- **Step 1: Rules & Ethics.** Layout displaying exam rules. "I Agree" Checkbox.
- **Step 2: Authenticated Snapshot.**
  - A persistent Camera Viewport.
  - "Capture ID Photo" button.
  - Preview & Confirm.

#### 3. The Viva Exam Room (`/dashboard/student/exam/[id]/session`)
- **Mode:** Full-screen immersive (Dark Mode).
- **Centerpiece:** `AIAvatar` component.
- **Controls:** Mic Toggle (Large, bottom center). "End Exam" (Top right, destructive variant).
- **Feedback:** Live Transcript overlay. "Integrity Status" indicator.

#### 4. Reviewer Queue (`/grading/queue`) - NEW
- **Layout:** Table of sessions pending review
- **Filters:** By exam code, assignment status
- **Actions:** Claim session, view details

#### 5. Admin Dashboard (`/admin/dashboard`) - NEW
- **Layout:** Tenant usage stats, user management
- **Components:** Usage cards, user table

#### 6. Exam Result Certificate (`/results/[token]`)
- **Design:** Professional report card.
- **Data:** Overall Score, AI Feedback, Score Breakdown.

### 🛠️ Technical Implementation Details
1.  **State:** Use `zustand` for managing the Exam Room state.
2.  **Context:** Create `TenantContext` for tenant-aware rendering.
3.  **Components:** Use `shadcn/ui` Card, Button, Input, Dialog, Progress, Toast.
4.  **Icons:** Use `lucide-react`.
```
