# SSO (OAuth) Setup Guide for Scire

This guide explains how to configure Google and Microsoft OAuth SSO for the Scire platform.

---

## Architecture Overview

```
┌──────────────┐     1. Click SSO      ┌──────────────┐
│   Frontend   │ ─────────────────────→│   Backend    │
│  scire.in    │                       │ api.scire.in │
└──────────────┘                       └──────┬───────┘
       ↑                                      │ 2. Redirect
       │                                      ↓
       │                               ┌──────────────┐
       │ 4. Redirect to                │  OAuth       │
       │    /auth/callback             │  Provider    │
       │                               │ (Google/MS)  │
       │                               └──────┬───────┘
       │                                      │ 3. Callback
       │         ┌──────────────┐             │
       └─────────│   Backend    │←────────────┘
                 │ api.scire.in │ Sets cookies
                 └──────────────┘
```

| Frontend | `https://scire.in` | Main app, tenant subdomains |
| Backend API | `https://scira-backend.onrender.com` | REST API, OAuth callbacks |
- OAuth providers send the authorization code to the backend
- Backend exchanges the code for tokens securely (server-side)
- Backend sets HttpOnly cookies before redirecting to frontend

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Navigate to **APIs & Services → Credentials**

### Step 2: Configure OAuth Consent Screen

1. Go to **OAuth consent screen**
2. Select **External** (unless you have Google Workspace)
3. Fill in:
   - App name: `Scire`
   - User support email: your email
   - Developer contact email: your email
4. Add scopes:
   - `email`
   - `profile`
   - `openid`
5. Add test users (for development)
6. Submit for verification (for production)

### Step 3: Create OAuth Credentials

1. Go to **Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: `Scire Backend`
4. **Authorized redirect URIs**:
   ```
   # Development
   http://localhost:8000/api/v1/auth/sso/google/callback
   
   # Production
   https://scira-backend.onrender.com/api/v1/auth/sso/google/callback
   ```
5. Click **Create**
6. Copy **Client ID** and **Client Secret**

### Step 4: Add to Environment Variables

```env
# Backend .env
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://scira-backend.onrender.com/api/v1/auth/sso/google/callback
SSO_ENABLED=true
```

---

## Microsoft Entra ID (Azure AD) Setup

### Step 1: Register Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID → App registrations**
3. Click **New registration**
4. Fill in:
   - Name: `Scire`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: Web → `https://scira-backend.onrender.com/api/v1/auth/sso/microsoft/callback`
5. Click **Register**

### Step 2: Get Application Credentials

1. From the app overview, copy:
   - **Application (client) ID** → `MICROSOFT_CLIENT_ID`
   - **Directory (tenant) ID** → `MICROSOFT_TENANT_ID` (use `common` for multi-tenant)

2. Go to **Certificates & secrets → New client secret**
   - Description: `Scire Backend`
   - Expires: 24 months
   - Copy the **Value** → `MICROSOFT_CLIENT_SECRET`

### Step 3: Configure API Permissions

1. Go to **API permissions**
2. Add permissions:
   - Microsoft Graph → Delegated:
     - `User.Read`
     - `email`
     - `openid`
     - `profile`
3. Click **Grant admin consent** (if you're an admin)

### Step 4: Add Redirect URIs

1. Go to **Authentication**
2. Add platform: **Web**
3. Add redirect URIs:
   ```
   # Development
   http://localhost:8000/api/v1/auth/sso/microsoft/callback
   
   # Production
   https://scira-backend.onrender.com/api/v1/auth/sso/microsoft/callback
   ```

### Step 5: Add to Environment Variables

```env
# Backend .env
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://scira-backend.onrender.com/api/v1/auth/sso/microsoft/callback
SSO_ENABLED=true
```

---

## Backend Environment Variables Summary

```env
# ============ SSO Configuration ============

# Enable SSO
SSO_ENABLED=true
SSO_AUTO_PROVISION_USERS=true
SSO_DEFAULT_ROLE=student

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_REDIRECT_URI=https://scira-backend.onrender.com/api/v1/auth/sso/google/callback

# Microsoft Entra ID
MICROSOFT_CLIENT_ID=your-app-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://scira-backend.onrender.com/api/v1/auth/sso/microsoft/callback
```

---

## Local Development

For local testing, update redirect URIs:

```env
# Local development
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/sso/google/callback
MICROSOFT_REDIRECT_URI=http://localhost:8000/api/v1/auth/sso/microsoft/callback
```

Also add these URIs to your OAuth provider's allowed redirect URIs.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `redirect_uri_mismatch` | URI doesn't match registered | Ensure exact match including trailing slashes |
| `invalid_client` | Wrong client ID/secret | Double-check credentials |
| `access_denied` | User cancelled or insufficient permissions | Check OAuth consent screen |
| SSO buttons not showing | `SSO_ENABLED=false` or no client ID | Set environment variables |

---

## Security Notes

1. **Never commit secrets** - Use environment variables
2. **Use HTTPS in production** - OAuth requires secure connections
3. **Limit redirect URIs** - Only add URIs you actually use
4. **Rotate secrets periodically** - Create new secrets before old ones expire

---

## 🌐 Advanced Multi-Tenancy SSO (v3.0)

### 1. Multi-Domain Support (Split Domains)
Tenants can now support multiple email domains mappings (e.g., `cumail.in` and `cuchd.in`).
*   **Configuration**: Add domains to `tenants.additional_domains` (JSON array).
*   **Behavior**: Users logging in with *any* of the listed domains will be routed to the same tenant (e.g. Faculty and Student domains mapping to one University tenant).

### 2. Guest Access (Public Exams)
For public exams, users from *any* domain (e.g., `@gmail.com`) can log in as guests.
*   **Endpoint Param**: Append `?target_tenant=tenant-slug` to the login URL.
    *   Example: `GET /api/v1/auth/sso/google/login?target_tenant=nebula`
*   **Flow**:
    1.  User clicks "Start Exam" with an Exam Code.
    2.  Frontend redirects to SSO login with `target_tenant`.
    3.  Backend authenticates via Google/Microsoft.
    4.  Backend sees `target_tenant` in state.
    5.  Backend verifies Tenant has `allow_guests=True`.
    6.  User is provisioned/logged in to that specific Tenant, ignoring their email domain.
