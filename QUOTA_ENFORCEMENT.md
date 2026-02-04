# Quota Enforcement System

> **Last Updated**: 2026-02-03  
> **Status**: Production Ready

## Overview

Scira enforces subscription-based quotas to ensure fair usage and encourage upgrades. Quotas are checked **before** resource creation and enforced at the **API layer** to prevent abuse.

---

## Quota Types

### 1. Student Quota (`max_students`)

**Definition**: Maximum number of active students allowed per tenant.

**Enforcement Point**: `POST /api/v1/tenants/me/users` (when `role == STUDENT`)

**How it works**:
```python
# Count active students
current_count = db.query(User).filter(
    User.tenant_id == tenant_id,
    User.role == UserRole.STUDENT,
    User.is_active == True
).count()

if current_count >= tenant.max_students:
    raise QuotaExceededError("students", tenant.max_students, current_count)
```

**Limits by Plan**:
- Free: 50 students
- Pro: 1,000 students
- Enterprise: 100,000 students

---

### 2. Exam Quota (`max_exams_per_month`)

**Definition**: Maximum exams that can be created in a calendar month.

**Enforcement Point**: `POST /api/v1/exams`

**How it works**:
```python
# Count exams created this month
now = datetime.now(timezone.utc)
month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

current_count = db.query(Exam).filter(
    Exam.tenant_id == tenant_id,
    Exam.created_at >= month_start
).count()

if current_count >= tenant.max_exams_per_month:
    raise QuotaExceededError("exams_per_month", tenant.max_exams_per_month, current_count)
```

**Limits by Plan**:
- Free: 5 exams/month
- Pro: 100 exams/month
- Enterprise: 10,000 exams/month

---

## Implementation Architecture

```mermaid
flowchart TD
    Start[API Request: Create Resource] --> CheckAuth{Authenticated?}
    CheckAuth -->|No| Reject401[Return 401 Unauthorized]
    CheckAuth -->|Yes| GetTenant[Get Tenant from Context]
    
    GetTenant --> CheckQuota{Quota Check}
    CheckQuota -->|Student Creation| CountStudents[Count Active Students]
    CheckQuota -->|Exam Creation| CountExams[Count Exams This Month]
    
    CountStudents --> CompareStudents{current < max_students?}
    CountExams --> CompareExams{current < max_exams?}
    
    CompareStudents -->|No| Reject402S[Return 402 Payment Required]
    CompareExams -->|No| Reject402E[Return 402 Payment Required]
    
    CompareStudents -->|Yes| CreateResource[Create Resource]
    CompareExams -->|Yes| CreateResource
    
    CreateResource --> Success[Return 201 Created]
    
    Reject402S --> ShowUpgradeMsg[Show: "Student quota exceeded: 50/50"]
    Reject402E --> ShowUpgradeMsg2[Show: "Exam quota exceeded: 5/5"]
```

---

## Code Structure

### Core Module: `app/core/quota.py`

#### 1. `check_student_quota()`
```python
def check_student_quota(db: Session, tenant_id: Optional[UUID] = None) -> bool:
    """Check if tenant can add more students.
    
    Raises:
        QuotaExceededError: If quota exceeded
    """
    tenant = get_current_tenant()
    
    if tenant.max_students is None:
        return True  # No limit configured
    
    current_count = db.query(func.count(User.id)).filter(
        User.tenant_id == tenant_id,
        User.role == UserRole.STUDENT,
        User.is_active == True
    ).scalar()
    
    if current_count >= tenant.max_students:
        raise QuotaExceededError("students", tenant.max_students, current_count)
    
    return True
```

#### 2. `check_exam_quota()`
```python
def check_exam_quota(db: Session, tenant_id: Optional[UUID] = None) -> bool:
    """Check if tenant can create more exams this month.
    
    Raises:
        QuotaExceededError: If quota exceeded
    """
    tenant = get_current_tenant()
    
    if tenant.max_exams_per_month is None:
        return True
    
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    current_count = db.query(func.count(Exam.id)).filter(
        Exam.tenant_id == tenant_id,
        Exam.created_at >= month_start
    ).scalar()
    
    if current_count >= tenant.max_exams_per_month:
        raise QuotaExceededError("exams_per_month", tenant.max_exams_per_month, current_count)
    
    return True
```

#### 3. `require_quota()` Dependency
```python
def require_quota(quota_type: str):
    """FastAPI dependency factory for quota enforcement.
    
    Usage:
        @router.post("/exams")
        async def create_exam(
            ...,
            _quota_check = Depends(require_quota("exam"))
        ):
            ...
    """
    async def quota_checker(db: Session = Depends(get_db)):
        try:
            if quota_type == "student":
                check_student_quota(db)
            elif quota_type == "exam":
                check_exam_quota(db)
        except QuotaExceededError as e:
            raise HTTPException(
                status_code=402,
                detail=f"Quota exceeded: {e.quota_type}. Current: {e.current}, Limit: {e.limit}. Please upgrade your subscription."
            )
    
    return quota_checker
```

---

## API Integration

### Exam Creation Endpoint
```python
@router.post("/exams", response_model=ExamResponse)
async def create_exam(
    exam_data: ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR)),
    _quota_check = Depends(require_quota("exam")),  # ✅ Enforced
):
    """Create a new exam. Enforces max_exams_per_month quota."""
    return ExamService.create_exam(db, exam_data, current_user.id)
```

### User Creation Endpoint
```python
@router.post("/tenants/me/users", response_model=UserResponse)
async def create_tenant_user(
    user_data: RegisterRequest,
    db: Session = Depends(get_db),
    user_tenant = Depends(require_tenant_admin()),
):
    """Create a user. Enforces max_students quota for students."""
    # Check student quota BEFORE creating user
    if user_data.role == UserRole.STUDENT or user_data.role is None:
        try:
            check_student_quota(db, tenant_id)
        except QuotaExceededError as e:
            raise HTTPException(
                status_code=402,
                detail=f"Student quota exceeded: {e.current}/{e.limit}. Please upgrade your subscription."
            )
    
    # Create user...
```

---

## Error Handling

### Backend Response (402 Payment Required)
```json
{
  "detail": "Student quota exceeded: 50/50. Please upgrade your subscription."
}
```

### Frontend Display
The API interceptor extracts the `detail` field and shows it as a toast:

```typescript
onError: (error) => {
    toast.error(error.message);
    // Displays: "Student quota exceeded: 50/50. Please upgrade your subscription."
}
```

---

## Quota Usage API

### Get Current Usage

**Endpoint**: `GET /api/v1/tenants/me/quotas`

**Response**:
```json
{
  "students": {
    "current": 45,
    "limit": 50,
    "remaining": 5
  },
  "exams_per_month": {
    "current": 3,
    "limit": 5,
    "remaining": 2
  },
  "subscription_tier": "free"
}
```

---

## Upgrading Quotas

When a tenant upgrades via payment, quotas are automatically updated:

```python
# In payment_service.py after successful payment verification
plan_config = PLAN_DETAILS[plan_id]
tenant.subscription_tier = plan_id
tenant.max_students = plan_config["limits"]["max_students"]
tenant.max_exams_per_month = plan_config["limits"]["max_exams_per_month"]
db.commit()
```

**Flow**:
1. User clicks "Upgrade to Pro" in settings
2. Payment succeeds
3. Backend verifies signature
4. Tenant limits updated: `max_students: 1000`, `max_exams_per_month: 100`
5. User can now create more resources

---

## Testing Scenarios

### Test 1: Exceed Student Quota
```bash
# Setup: Free tier (max_students: 50)
POST /tenants/me/users (create 50 students) → ✅ Success
POST /tenants/me/users (create 51st student) → ❌ 402 Payment Required
```

### Test 2: Exceed Exam Quota
```bash
# Setup: Free tier (max_exams_per_month: 5)
POST /exams (create 5 exams in January) → ✅ Success
POST /exams (create 6th exam in January) → ❌ 402 Payment Required
POST /exams (create 1st exam in February) → ✅ Success (new month)
```

### Test 3: Upgrade and Retry
```bash
POST /exams → ❌ 402 (quota exceeded)
POST /payments/order {plan_id: "pro"} → Complete payment
POST /payments/verify → ✅ Tenant upgraded
POST /exams → ✅ Success (new limits applied)
```

---

## Monitoring

### Key Metrics

1. **Quota Hit Rate**: `COUNT(402 responses) / COUNT(total requests)`
2. **Quota Usage %**: `(current / limit) * 100` for each tenant
3. **Upgrade Conversions**: Users who hit quota → upgrade within 7 days

### Alerts

- **High Quota Hit Rate**: Alert if >10% of tenants hitting quotas
- **Usage Warning**: Alert tenant admins at 80% usage
- **Critical Usage**: Alert at 95% usage

---

## Future Enhancements

1. **Soft Limits**: Warn at 80%, block at 100%
2. **Grace Period**: Allow 10% overage for 7 days
3. **Auto-Upgrade**: Prompt upgrade dialog on quota error
4. **Usage Analytics**: Dashboard showing quota trends
5. **Custom Quotas**: Enterprise plans with negotiated limits

---

## Related Documentation

- [Payment System](file:///f:/devlopment/miniproject/scira-backend/docs/PAYMENT_SYSTEM.md)
- [System Design](file:///f:/devlopment/miniproject/scira-backend/docs/SYSTEM_DESIGN.md)
- [Database Models](file:///f:/devlopment/miniproject/scira-backend/docs/DATABASE_MODELS.md)
