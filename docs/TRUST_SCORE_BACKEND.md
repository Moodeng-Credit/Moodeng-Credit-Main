# Trust Score & Dashboard Backend Documentation

## Overview
This document describes the backend logic for the Trust Score calculation and Dashboard data requirements for the Moodeng Credit borrower dashboard.

## Trust Score Calculation

### Formula
The Trust Score is calculated based on the following formula:

```
Trust Score = Base Score + Verification Bonus + (On-Time Repayments × 5) - (Late Repayments × 10)
```

Where:
- **Base Score**: 50 points (everyone starts here)
- **Verification Bonus**: +10 points (one-time, when World ID is verified)
- **On-Time Repayment Bonus**: +5 points per loan repaid on or before due date
- **Late Repayment Penalty**: -10 points per loan repaid after due date
- **Min Score**: 0 points
- **Max Score**: 100 points

### Score Levels
The Trust Score is categorized into four levels:

| Score Range | Level | Color |
|------------|-------|-------|
| 0-39 | Poor | Red (#ef4444) |
| 40-69 | Fair | Orange (#f97316) |
| 70-89 | Good Standing | Green (#22c55e) |
| 90-100 | Excellent | Emerald (#10b981) |

### Implementation Details

#### Database Requirements
The Trust Score calculation uses existing data from:

**Users Table:**
- `is_world_id`: World ID verification status (ACTIVE/INACTIVE)
- `cs`: Current credit score (for credit limit calculation)

**Loans Table:**
- `repayment_status`: 'Paid', 'Unpaid', or 'Partial'
- `repaid_amount`: Amount repaid by borrower
- `total_repayment_amount`: Total amount including interest
- `due_date`: Loan due date
- `updated_at`: When the loan was last updated (used as payment date)

#### Calculation Logic
1. Start with base score of 50
2. Add +10 if user's `is_world_id === 'ACTIVE'`
3. For each loan where `repayment_status === 'Paid'`:
   - Calculate if fully repaid: `repaid_amount >= total_repayment_amount`
   - Compare `updated_at` (payment time) with `due_date`
   - If `updated_at <= due_date`: Add +5 (on-time)
   - If `updated_at > due_date`: Subtract -10 (late)
4. Clamp final score between 0 and 100

#### Code Location
- Frontend calculation: `src/lib/trustScore.ts`
- Used in: `src/views/profile/components/tabs/useDashboardData.ts`

### Future Considerations
1. **Backend Calculation**: Consider moving Trust Score calculation to backend as a database trigger or scheduled job
2. **Caching**: Cache Trust Score in the users table (add `trust_score` column) for better performance
3. **History**: Track Trust Score over time for trend analysis
4. **IOU Points**: Integration for additional scoring factors (mentioned in requirements)

## Reputation Milestones

### Milestone Definitions
Milestones are achievements based on on-time repayments:

| ID | Title | Requirement | Description |
|----|-------|------------|-------------|
| repay_1 | Repay a loan on time | 1 on-time repayment | Increase your Trust Level |
| repay_2 | Repay 2 loans on time | 2 on-time repayments | Build reputation with lenders |
| repay_5 | Repay 5 loans on time | 5 on-time repayments | Unlock higher credit limits |
| repay_10 | Repay 10 loans on time | 10 on-time repayments | Become a trusted borrower |

### Milestone States
1. **Next**: The milestone the user is currently working towards (highlighted in purple)
2. **Locked**: Future milestones not yet accessible (grayed out)
3. **Completed**: Milestones already achieved (green with checkmark)

### State Logic
- First incomplete milestone becomes "next"
- All milestones after "next" are "locked"
- All milestones before "next" are "completed"

### Implementation
- Frontend calculation: `src/views/profile/components/tabs/ReputationMilestones.tsx`
- Based on same on-time repayment counting logic as Trust Score

### Future Enhancements
1. Store milestone achievements in database
2. Add notification when milestone is completed
3. Add rewards for milestone completion (bonus points, badges, etc.)
4. More diverse milestone types (e.g., "borrow from 5 different lenders", "maintain 90+ score for 3 months")

## Dashboard Data API (Future)

### Proposed Endpoint: GET /dashboard

While the current implementation calculates Trust Score on the frontend, a backend API endpoint could improve performance and consistency:

```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "first_name": "string",
    "verified": boolean,
    "member_since": "ISO date",
    "days_active": number,
    "trust_score": number,
    "trust_level": "Poor" | "Fair" | "Good Standing" | "Excellent"
  },
  "credit": {
    "level": number,
    "used": number,
    "limit": number,
    "progression_paused": boolean
  },
  "stats": {
    "repayments": { "count": number, "total": number },
    "active": { "count": number, "total": number },
    "defaulted": { "count": number, "total": number },
    "pending": { "count": number, "total": number }
  },
  "milestones": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "requirement": number,
      "current": number,
      "status": "next" | "locked" | "completed"
    }
  ],
  "lender_diversity_score": number
}
```

### Implementation Recommendation
Create a Supabase Edge Function or PostgreSQL function to:
1. Calculate Trust Score from user's loan history
2. Aggregate loan statistics
3. Calculate milestone progress
4. Return all dashboard data in one API call

This would reduce frontend complexity and ensure consistent scoring across the platform.

## Database Schema Recommendations

### Option 1: Add Trust Score Column (Simple)
```sql
ALTER TABLE users ADD COLUMN trust_score INTEGER DEFAULT 50;
```

Update via trigger on loan updates:
```sql
CREATE OR REPLACE FUNCTION update_trust_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate and update trust score when loan repayment status changes
  -- Implementation here
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loan_repayment_trust_score
AFTER UPDATE ON loans
FOR EACH ROW
WHEN (OLD.repayment_status IS DISTINCT FROM NEW.repayment_status)
EXECUTE FUNCTION update_trust_score();
```

### Option 2: Create Milestones Table (Advanced)
```sql
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirement INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, milestone_id)
);
```

This allows for:
- Dynamic milestone creation
- Tracking completion dates
- Historical milestone data
- Analytics on milestone completion rates

## Credit Level System (Existing)

The credit level system already exists and works as follows:

### Tiers
- LVL 0: $20
- LVL 1: $40
- LVL 2: $60
- LVL 3: $80
- LVL 4: $100
- LVL 5: $120
- LVL 6: $140 (max)

### Progression Rules
1. User must verify World ID to start (unlocks $20)
2. To unlock next tier: Fully repay cumulative amount equal to current tier on time
3. Late repayments pause progression (`credit_progression_paused` flag)
4. Resume progression after next on-time repayment

### Implementation
- Backend logic: `src/lib/creditLeveling.ts`
- Database: `users.cs` stores current credit limit
- Progression flag: `users.credit_progression_paused`

## Testing Recommendations

### Unit Tests
1. Trust Score calculation with various scenarios:
   - New user (should be 50)
   - Verified user (should be 60)
   - 1 on-time repayment (should be 65)
   - 1 late repayment (should be 50)
   - Multiple combinations

2. Milestone state logic:
   - 0 repayments: first is "next", others "locked"
   - 1 repayment: first "completed", second "next", others "locked"
   - 10+ repayments: all "completed"

### Integration Tests
1. Full dashboard data flow
2. Trust Score updates after loan repayment
3. Milestone completion triggers
4. Credit level progression with Trust Score

## Performance Considerations

1. **Current Approach (Frontend Calculation)**
   - Pros: Simple, no backend changes needed
   - Cons: Recalculated on every dashboard load, inconsistent if loan data changes

2. **Recommended Approach (Cached in Database)**
   - Pros: Fast queries, consistent across platform, enables analytics
   - Cons: Requires database trigger/scheduled job, complexity

3. **Hybrid Approach**
   - Calculate and cache Trust Score on backend
   - Frontend uses cached value
   - Recalculate on loan status change (via trigger)
   - Background job to ensure consistency

## Security Considerations

1. Trust Score should only be visible to the user themselves and potentially lenders (with privacy controls)
2. Milestone data is public but should be read-only
3. All calculations should be server-side for production to prevent manipulation
4. Rate limit dashboard API to prevent abuse

## Monitoring & Analytics

Track the following metrics:
1. Average Trust Score by user cohort
2. Milestone completion rates
3. Time to reach each milestone
4. Correlation between Trust Score and default rates
5. Impact of verification on Trust Score distribution

This data can inform future scoring model improvements.
