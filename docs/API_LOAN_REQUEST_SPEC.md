# Loan Request API Specification (FastAPI)

## Overview
This document specifies the API endpoint for creating peer-to-peer loan requests in the Moodeng Credit system. The endpoint handles loan request submission with WorldID verification, dynamic credit limits, and comprehensive validation.

## Endpoint

### Create Loan Request

**POST** `/v1/loan-requests`

Creates a new loan request from a verified borrower.

#### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request Body

```json
{
  "borrowerUserId": "string",
  "loanAmount": "number",
  "totalRepaymentAmount": "number",
  "reason": "string",
  "days": "number",
  "coin": "USDC"
}
```

#### Field Specifications

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `borrowerUserId` | string | Yes | Min length: 1 | Unique identifier of the borrower (25-char CUID) |
| `loanAmount` | number | Yes | > 0, ≤ 1,000,000,000, 2 decimal places | Principal amount to borrow in USDC |
| `totalRepaymentAmount` | number | Yes | > loanAmount, ≤ 1,000,000,000, 2 decimal places | Total amount to repay (principal + interest) |
| `reason` | string | Yes | 1-500 chars, sanitized | Reason for borrowing (40 chars UI limit, 500 backend max) |
| `days` | number | Yes | 1-3650 | Number of days until repayment date |
| `coin` | string | Yes | Must be "USDC" | Currency type (fixed to USDC) |

#### Business Logic Validations

1. **User Verification**
   - User must have active WorldID verification (`isWorldId === 'ACTIVE'`)
   - Return `403 Forbidden` if not verified

2. **Credit Limit Check**
   - Calculate effective credit limit: `getEffectiveCreditLimit(user.cs, isVerified)`
   - `loanAmount` must not exceed user's credit limit
   - Return `400 Bad Request` with error code `LOAN_AMOUNT_EXCEEDS_LIMIT` if exceeded

3. **Active Loan Limit**
   - Check that `user.nal < user.mal` (number of active loans < max allowed loans)
   - Return `400 Bad Request` with error code `LOAN_LIMIT_REACHED` if limit reached

4. **Wallet Validation**
   - User must have a connected wallet address
   - Return `400 Bad Request` with error code `WALLET_MISSING` if not connected

5. **Interest Rate Validation**
   - Implied interest rate: `((totalRepaymentAmount - loanAmount) / loanAmount) * 100`
   - Must be reasonable (suggest 0-100% for short-term loans)

6. **Repayment Date**
   - Must be at least 24 hours in the future
   - Calculate from `days` parameter
   - Store as ISO8601 timestamp at midnight UTC

#### Response

**Success (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123abc456def789012",
    "borrowerUserId": "clxyz123abc456def789012",
    "loanAmount": 10.50,
    "totalRepaymentAmount": 12.00,
    "reason": "Car repair emergency",
    "dueDate": "2026-02-18T00:00:00.000Z",
    "coin": "USDC",
    "status": "REQUESTED",
    "createdAt": "2026-02-11T15:00:00.000Z",
    "updatedAt": "2026-02-11T15:00:00.000Z"
  },
  "message": "Loan request created successfully"
}
```

**Error (400 Bad Request)**
```json
{
  "success": false,
  "error": "LOAN_AMOUNT_EXCEEDS_LIMIT",
  "message": "Loan amount exceeds your current credit limit of $15.00",
  "details": {
    "field": "loanAmount",
    "requestedAmount": 20.00,
    "creditLimit": 15.00
  }
}
```

**Error (403 Forbidden)**
```json
{
  "success": false,
  "error": "WORLDID_REQUIRED",
  "message": "WorldID verification is required to request a loan",
  "details": {
    "verificationStatus": "INACTIVE"
  }
}
```

**Error (401 Unauthorized)**
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Valid authentication token is required"
}
```

## FastAPI Implementation Example

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
from typing import Literal
from datetime import datetime, timedelta
from decimal import Decimal

router = APIRouter(prefix="/v1", tags=["loans"])

# Request Models
class CreateLoanRequest(BaseModel):
    borrowerUserId: str = Field(..., min_length=1, description="Borrower user ID")
    loanAmount: Decimal = Field(..., gt=0, le=1_000_000_000, decimal_places=2)
    totalRepaymentAmount: Decimal = Field(..., gt=0, le=1_000_000_000, decimal_places=2)
    reason: str = Field(..., min_length=1, max_length=500)
    days: int = Field(..., ge=1, le=3650)
    coin: Literal["USDC"] = "USDC"
    
    @validator('totalRepaymentAmount')
    def validate_repayment_greater_than_loan(cls, v, values):
        if 'loanAmount' in values and v <= values['loanAmount']:
            raise ValueError('Repayment amount must be greater than loan amount')
        return v
    
    @validator('reason')
    def sanitize_reason(cls, v):
        # Remove HTML tags and XSS attempts
        import re
        v = re.sub(r'<[^>]*>', '', v)  # Remove HTML tags
        v = re.sub(r'on\w+\s*=\s*["\'][^"\']*["\']', '', v, flags=re.IGNORECASE)  # Remove event handlers
        v = re.sub(r'javascript:', '', v, flags=re.IGNORECASE)  # Remove javascript: protocol
        return v.strip()

# Response Models
class LoanResponse(BaseModel):
    id: str
    borrowerUserId: str
    loanAmount: Decimal
    totalRepaymentAmount: Decimal
    reason: str
    dueDate: datetime
    coin: str
    status: str
    createdAt: datetime
    updatedAt: datetime

class SuccessResponse(BaseModel):
    success: bool = True
    data: LoanResponse
    message: str

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    message: str
    details: dict = {}

# Endpoint
@router.post(
    "/loan-requests",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "Bad Request"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        403: {"model": ErrorResponse, "description": "Forbidden"}
    },
    summary="Create a new loan request",
    description="Creates a peer-to-peer loan request with WorldID verification and credit limit checks"
)
async def create_loan_request(
    request: CreateLoanRequest,
    current_user = Depends(get_current_user),  # Authentication dependency
    db = Depends(get_database)  # Database dependency
):
    """
    Create a new loan request.
    
    Requirements:
    - User must be authenticated (JWT token)
    - User must have active WorldID verification
    - Loan amount must not exceed user's credit limit
    - User must not have reached maximum active loans
    - User must have a connected wallet address
    """
    
    # 1. Check WorldID verification
    if current_user.isWorldId != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": "WORLDID_REQUIRED",
                "message": "WorldID verification is required to request a loan",
                "details": {"verificationStatus": current_user.isWorldId}
            }
        )
    
    # 2. Check wallet address
    if not current_user.walletAddress or current_user.walletAddress.strip() == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": "WALLET_MISSING",
                "message": "A connected wallet address is required",
                "details": {}
            }
        )
    
    # 3. Calculate effective credit limit
    is_verified = current_user.isWorldId == "ACTIVE"
    credit_limit = get_effective_credit_limit(current_user.cs, is_verified)
    
    if request.loanAmount > credit_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": "LOAN_AMOUNT_EXCEEDS_LIMIT",
                "message": f"Loan amount exceeds your current credit limit of ${credit_limit:.2f}",
                "details": {
                    "field": "loanAmount",
                    "requestedAmount": float(request.loanAmount),
                    "creditLimit": float(credit_limit)
                }
            }
        )
    
    # 4. Check active loan limit
    if current_user.nal >= current_user.mal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": "LOAN_LIMIT_REACHED",
                "message": "You have reached your maximum number of active loans",
                "details": {
                    "activeLoans": current_user.nal,
                    "maxLoans": current_user.mal
                }
            }
        )
    
    # 5. Calculate due date (midnight UTC)
    due_date = datetime.utcnow() + timedelta(days=request.days)
    due_date = due_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 6. Validate minimum 24-hour future date
    min_date = datetime.utcnow() + timedelta(hours=24)
    if due_date < min_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": "INVALID_REPAYMENT_DATE",
                "message": "Repayment date must be at least 24 hours in the future",
                "details": {"dueDate": due_date.isoformat()}
            }
        )
    
    # 7. Create loan record
    loan = await db.loans.create({
        "borrowerUserId": request.borrowerUserId,
        "borrowerWallet": current_user.walletAddress,
        "loanAmount": float(request.loanAmount),
        "totalRepaymentAmount": float(request.totalRepaymentAmount),
        "reason": request.reason,
        "dueDate": due_date,
        "coin": request.coin,
        "status": "REQUESTED",
        "repaymentStatus": "UNPAID"
    })
    
    # 8. Update user's active loan count
    await db.users.update(
        current_user.id,
        {"nal": current_user.nal + 1}
    )
    
    # 9. Send notifications (async)
    # await send_loan_request_notification(loan)
    
    return SuccessResponse(
        data=LoanResponse(**loan),
        message="Loan request created successfully"
    )

# Helper function
def get_effective_credit_limit(credit_score: int, is_verified: bool) -> Decimal:
    """
    Calculate the effective credit limit based on credit score and verification status.
    
    Args:
        credit_score: User's credit score (cs)
        is_verified: Whether user has active WorldID verification
        
    Returns:
        Credit limit in USDC (Decimal)
    """
    if not is_verified:
        return Decimal("0")
    
    MIN_CREDIT_LIMIT = Decimal("20")
    MAX_CREDIT_LIMIT = Decimal("140")
    
    limit = max(credit_score or 0, MIN_CREDIT_LIMIT)
    return min(limit, MAX_CREDIT_LIMIT)
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `WORLDID_REQUIRED` | 403 | User must complete WorldID verification |
| `WALLET_MISSING` | 400 | User must connect a wallet address |
| `LOAN_AMOUNT_EXCEEDS_LIMIT` | 400 | Loan amount exceeds user's credit limit |
| `LOAN_LIMIT_REACHED` | 400 | User has reached max active loans |
| `INVALID_REPAYMENT_DATE` | 400 | Repayment date must be 24+ hours in future |
| `INVALID_LOAN_AMOUNT` | 400 | Loan amount must be positive |
| `INVALID_REPAYMENT_AMOUNT` | 400 | Repayment must exceed loan amount |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | User lacks required permissions |

## Data Sanitization

All text inputs undergo sanitization to prevent XSS attacks:
- Remove HTML tags: `<script>`, `<img>`, etc.
- Remove event handlers: `onclick`, `onerror`, etc.
- Remove JavaScript protocols: `javascript:`, `data:text/html`
- Trim whitespace

## Rate Limiting

**Recommended**: 10 requests per minute per user to prevent spam.

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/loan-requests")
@limiter.limit("10/minute")
async def create_loan_request(...):
    ...
```

## Database Schema

```sql
CREATE TABLE loans (
    id VARCHAR(25) PRIMARY KEY,  -- CUID
    borrower_user_id VARCHAR(25) NOT NULL REFERENCES users(id),
    borrower_wallet VARCHAR(42) NOT NULL,
    lender_user_id VARCHAR(25) REFERENCES users(id),
    loan_amount DECIMAL(20, 2) NOT NULL CHECK (loan_amount > 0),
    total_repayment_amount DECIMAL(20, 2) NOT NULL CHECK (total_repayment_amount > loan_amount),
    repaid_amount DECIMAL(20, 2) DEFAULT 0 CHECK (repaid_amount >= 0),
    reason TEXT NOT NULL,
    due_date TIMESTAMP NOT NULL,
    coin VARCHAR(10) NOT NULL DEFAULT 'USDC',
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    repayment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_repayment CHECK (total_repayment_amount > loan_amount),
    CONSTRAINT valid_amounts CHECK (loan_amount > 0 AND loan_amount <= 1000000000),
    CONSTRAINT future_due_date CHECK (due_date > CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX idx_loans_borrower ON loans(borrower_user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_due_date ON loans(due_date);
```

## Testing

### Unit Test Example

```python
import pytest
from fastapi.testclient import TestClient
from decimal import Decimal

def test_create_loan_request_success(client: TestClient, auth_headers):
    """Test successful loan request creation"""
    payload = {
        "borrowerUserId": "clxyz123abc456def789012",
        "loanAmount": 10.50,
        "totalRepaymentAmount": 12.00,
        "reason": "Car repair emergency",
        "days": 7,
        "coin": "USDC"
    }
    
    response = client.post("/v1/loan-requests", json=payload, headers=auth_headers)
    
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["loanAmount"] == 10.50
    assert data["data"]["status"] == "REQUESTED"

def test_create_loan_request_exceeds_limit(client: TestClient, auth_headers):
    """Test loan request exceeding credit limit"""
    payload = {
        "borrowerUserId": "clxyz123abc456def789012",
        "loanAmount": 100.00,  # Exceeds user's $15 limit
        "totalRepaymentAmount": 110.00,
        "reason": "Emergency",
        "days": 7,
        "coin": "USDC"
    }
    
    response = client.post("/v1/loan-requests", json=payload, headers=auth_headers)
    
    assert response.status_code == 400
    data = response.json()
    assert data["error"] == "LOAN_AMOUNT_EXCEEDS_LIMIT"

def test_create_loan_request_unverified_user(client: TestClient, unverified_auth_headers):
    """Test loan request from unverified user"""
    payload = {
        "borrowerUserId": "clxyz123abc456def789012",
        "loanAmount": 10.00,
        "totalRepaymentAmount": 11.00,
        "reason": "Test",
        "days": 7,
        "coin": "USDC"
    }
    
    response = client.post("/v1/loan-requests", json=payload, headers=unverified_auth_headers)
    
    assert response.status_code == 403
    data = response.json()
    assert data["error"] == "WORLDID_REQUIRED"
```

## Security Considerations

1. **Authentication**: Always validate JWT tokens
2. **Authorization**: Ensure borrowerUserId matches authenticated user
3. **Input Validation**: Use Pydantic models for all inputs
4. **SQL Injection**: Use parameterized queries
5. **XSS Prevention**: Sanitize all text inputs
6. **Rate Limiting**: Prevent abuse with rate limits
7. **HTTPS Only**: All API calls must use HTTPS in production
8. **CORS**: Configure appropriate CORS policies

## Frontend Integration

The modal component sends requests using the existing API client:

```typescript
import { useApiMutation } from '@/lib/api/hooks';
import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { createLoanSchema } from '@/lib/schemas/loans';

const createLoanMutation = useApiMutation(API_ENDPOINTS.LOANS.CREATE);

const loanData = createLoanSchema.parse({
  borrowerUserId: user?.id,
  loanAmount: parseFloat(borrowAmount),
  totalRepaymentAmount: parseFloat(repaymentAmount),
  reason: reason.trim(),
  days: calculateDays(),
  coin: 'USDC'
});

await createLoanMutation.mutateAsync(loanData);
```

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-11 | Initial API specification for loan request endpoint |
