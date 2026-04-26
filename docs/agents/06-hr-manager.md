# Agent: HR Manager Agent

**Key:** `hr`  
**Phase:** 5

## Purpose

Monthly salary sheet, leave requests, HR alerts.

## Trigger

- CRON: 25th of month (salary generation)
- CRON: daily 09:00 (HR alerts)
- WEBHOOK + MANUAL: leave requests

## Context

- Employee table
- Attendance records
- Leave balance
- Prior salary sheets

## Decision

- Salary sheet: compute with anomaly flags
- Leave decision: approve/reject with reasoning
- Alerts: probation endings, anniversaries, contract expirations

## Actions

| Action | Approval Required |
|---|---|
| `generate_salary_sheet` | Yes |
| `respond_to_leave_request` | Yes |
| `notify_owner` | Auto |

## MCP Tools

| Tool | Description |
|---|---|
| `list_employees` | List all employees |
| `get_employee` | Get employee details |
| `compute_salary` | Compute salary with deductions/bonuses |
| `decide_leave` | LLM-draft leave decision |

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/leave-request` | Submit a leave request |
| GET | `/salary-sheet/:month` | Fetch generated salary sheet |
| GET | `/alerts/today` | Get today's HR alerts |

## Schema

```sql
employees {
  id              text PK
  name            text
  email           text
  role            text
  salary          integer
  joinedAt        timestamp
  probationUntil  timestamp
  contractEndsAt  timestamp
  leaveBalance    integer
}

leave_requests {
  id          text PK
  employeeId  text FK → employees.id
  type        text
  fromDate    date
  toDate      date
  reason      text
  status      text
  decidedAt   timestamp
}

salary_sheets {
  id          text PK
  month       text
  totals      jsonb
  lineItems   jsonb
  fileKey     text       -- MinIO key
  generatedAt timestamp
  approvedAt  timestamp
}
```

## Storage

Salary sheets stored in **MinIO** private bucket.
