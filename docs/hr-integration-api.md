# HR Integration API Spec

This document defines every endpoint, webhook, and data contract the Cortex OS HR Manager Agent expects from the internal HRM system.

The HRM system is the source of truth for employee data, leave records, WFH records, and payslips.
The agent reads from and writes to it via HTTP. The HRM system pushes real-time events to the agent via webhooks.

---

## Authentication

All requests from the agent carry a shared secret header.

```
X-HRM-Secret: <shared_secret>
```

The HRM system must validate this header on every endpoint.
The secret is stored in Cortex OS Settings (`hrm_api_secret`) and the HRM system's environment config.

All requests use `Content-Type: application/json`.

Base URL configured in Cortex OS Settings as `hrm_api_base_url`.
Example: `https://hrm.internal.yourdomain.com/api`

---

## Data Models

### Employee

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "phone": "string | null",
  "role": "string",
  "department": "string | null",
  "salary": 50000,
  "currency": "BDT",
  "joinedAt": "2024-01-15",
  "probationUntil": "2024-04-15 | null",
  "contractEndsAt": "2025-01-15 | null",
  "leaveBalance": 14,
  "bankAccount": "string | null",
  "active": true,
  "photoUrl": "string | null"
}
```

### Leave Request

```json
{
  "id": "string",
  "employeeId": "string",
  "employeeName": "string",
  "type": "annual | sick | unpaid | maternity | paternity | other",
  "fromDate": "2025-12-20",
  "toDate": "2025-12-24",
  "totalDays": 5,
  "reason": "string | null",
  "status": "pending | approved | rejected | cancelled",
  "decisionReason": "string | null",
  "decidedAt": "ISO8601 | null",
  "createdAt": "ISO8601"
}
```

### WFH Request

```json
{
  "id": "string",
  "employeeId": "string",
  "employeeName": "string",
  "date": "2025-12-20",
  "reason": "string | null",
  "status": "pending | approved | rejected",
  "decisionReason": "string | null",
  "decidedAt": "ISO8601 | null",
  "createdAt": "ISO8601"
}
```

### Payslip

```json
{
  "id": "string",
  "employeeId": "string",
  "employeeName": "string",
  "month": "2025-12",
  "baseSalary": 50000,
  "bonus": 5000,
  "deductions": 2000,
  "netSalary": 53000,
  "currency": "BDT",
  "workingDays": 26,
  "presentDays": 24,
  "status": "draft | approved | paid",
  "approvedAt": "ISO8601 | null",
  "paidAt": "ISO8601 | null",
  "createdAt": "ISO8601"
}
```

---

## Endpoints

### Employees

---

#### `GET /employees`

Returns all active employees.

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `active` | `true \| false \| all` | `true` | Filter by active status |
| `department` | string | — | Filter by department |

**Response `200`**

```json
{
  "data": [ /* Employee[] */ ],
  "total": 12
}
```

---

#### `GET /employees/:id`

Returns a single employee by ID.

**Response `200`** — Employee object

**Response `404`**
```json
{ "error": "Employee not found" }
```

---

#### `GET /employees/today/on-leave`

Returns employees who have an approved leave that covers today's date.
Used by the daily digest to show who is absent.

**Response `200`**
```json
{
  "data": [
    {
      "employeeId": "string",
      "employeeName": "string",
      "leaveType": "annual",
      "fromDate": "2025-12-20",
      "toDate": "2025-12-24"
    }
  ]
}
```

---

#### `GET /employees/today/wfh`

Returns employees with an approved WFH for today.

**Response `200`**
```json
{
  "data": [
    {
      "employeeId": "string",
      "employeeName": "string",
      "date": "2025-12-20"
    }
  ]
}
```

---

#### `GET /employees/alerts`

Returns time-sensitive alerts the agent should surface.
Called daily at 9am.

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `withinDays` | number | `7` | Look-ahead window in days |

**Response `200`**
```json
{
  "probationEnding": [
    { "employeeId": "string", "employeeName": "string", "probationUntil": "2025-12-22" }
  ],
  "contractExpiring": [
    { "employeeId": "string", "employeeName": "string", "contractEndsAt": "2025-12-28" }
  ],
  "birthdays": [
    { "employeeId": "string", "employeeName": "string", "date": "2025-12-20" }
  ],
  "workAnniversaries": [
    { "employeeId": "string", "employeeName": "string", "years": 2, "date": "2025-12-20" }
  ]
}
```

---

### Leave Requests

---

#### `GET /leave-requests`

**Query params**

| Param | Type | Description |
|---|---|---|
| `status` | `pending \| approved \| rejected \| all` | Filter by status. Default: `all` |
| `employeeId` | string | Filter to one employee |
| `month` | `YYYY-MM` | Filter by month of leave start date |

**Response `200`**
```json
{
  "data": [ /* LeaveRequest[] */ ],
  "total": 5,
  "pendingCount": 2
}
```

---

#### `GET /leave-requests/pending`

Shorthand for `GET /leave-requests?status=pending`.
The agent calls this on the daily CRON to build the Telegram digest.

**Response `200`**
```json
{
  "data": [ /* LeaveRequest[] */ ],
  "total": 3
}
```

---

#### `POST /leave-requests`

Submit a new leave request. Called by the agent when an employee submits via the intern tool or Telegram.

**Body**
```json
{
  "employeeId": "string",
  "type": "annual | sick | unpaid | maternity | paternity | other",
  "fromDate": "2025-12-20",
  "toDate": "2025-12-24",
  "reason": "string | null"
}
```

**Validation rules**
- `fromDate` must not be in the past
- `toDate` >= `fromDate`
- `type` must be one of the allowed values
- `employeeId` must exist and be active

**Response `201`** — LeaveRequest object

**Response `422`**
```json
{ "error": "Insufficient leave balance (requested 5, available 3)" }
```

---

#### `POST /leave-requests/:id/approve`

Approve a pending leave request. Called by the agent after Telegram approval.

**Body**
```json
{
  "reason": "string | null"
}
```

**Side effects the HRM system must handle:**
- Set `status = approved`, `decidedAt = now()`
- Deduct `totalDays` from `employee.leaveBalance`
- Send email notification to the employee (optional, HRM-side)

**Response `200`** — updated LeaveRequest object

**Response `409`**
```json
{ "error": "Leave request is not in pending status" }
```

---

#### `POST /leave-requests/:id/reject`

Reject a pending leave request.

**Body**
```json
{
  "reason": "string"
}
```

**Side effects:** Set `status = rejected`. No balance change.

**Response `200`** — updated LeaveRequest object

---

### WFH Requests

---

#### `GET /wfh-requests/pending`

Returns all pending WFH requests. Called on the daily CRON.

**Response `200`**
```json
{
  "data": [ /* WfhRequest[] */ ],
  "total": 2
}
```

---

#### `POST /wfh-requests`

Submit a new WFH request.

**Body**
```json
{
  "employeeId": "string",
  "date": "2025-12-20",
  "reason": "string | null"
}
```

**Validation rules**
- `date` must not be in the past
- No duplicate WFH request for same employee + date

**Response `201`** — WfhRequest object

---

#### `POST /wfh-requests/:id/approve`

**Body**
```json
{
  "reason": "string | null"
}
```

**Response `200`** — updated WfhRequest object

---

#### `POST /wfh-requests/:id/reject`

**Body**
```json
{
  "reason": "string"
}
```

**Response `200`** — updated WfhRequest object

---

### Payslips

---

#### `GET /payslips`

**Query params**

| Param | Type | Description |
|---|---|---|
| `month` | `YYYY-MM` | Required. Filter by month |
| `status` | `draft \| approved \| paid \| all` | Default: `all` |

**Response `200`**
```json
{
  "data": [ /* Payslip[] */ ],
  "total": 12,
  "summary": {
    "month": "2025-12",
    "totalNet": 630000,
    "currency": "BDT",
    "approvedCount": 10,
    "draftCount": 2
  }
}
```

---

#### `GET /payslips/:employeeId/:month`

Get a single payslip for a given employee and month.

**Response `200`** — Payslip object

**Response `404`**
```json
{ "error": "Payslip not found" }
```

---

#### `POST /payslips/generate`

Generate draft payslips for all active employees for a given month.
The agent calls this at the start of the monthly salary run.
If payslips already exist for the month, this must be idempotent (no duplicates).

**Body**
```json
{
  "month": "2025-12"
}
```

**Response `201`**
```json
{
  "generated": 12,
  "skipped": 0,
  "data": [ /* Payslip[] — all drafts */ ]
}
```

---

#### `PATCH /payslips/:id`

Update bonus or deductions on a draft payslip before approval.
The agent calls this when the operator edits values in the Telegram flow.

**Body** (all fields optional)
```json
{
  "bonus": 5000,
  "deductions": 2000
}
```

**Constraints:** Only allowed when `status = draft`.

**Response `200`** — updated Payslip object with recalculated `netSalary`

---

#### `POST /payslips/:id/approve`

Mark a single payslip as approved. Called one-by-one after each Telegram approval.

**Side effects the HRM system must handle:**
- Set `status = approved`, `approvedAt = now()`

**Response `200`** — updated Payslip object

---

#### `POST /payslips/:id/mark-paid`

Mark a single payslip as paid after salary is disbursed.

**Body**
```json
{
  "paidAt": "ISO8601 | null"
}
```

**Response `200`** — updated Payslip object

---

#### `GET /payslips/export/:month`

Download a CSV of all approved payslips for the given month.

**Response `200`**
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="payslips-2025-12.csv"`

CSV columns: `employee_id, name, department, role, base_salary, bonus, deductions, net_salary, currency, status`

---

## Webhooks (HRM → Agent)

The HRM system must `POST` to the agent webhook URL when these events occur.
The agent URL is configured in the HRM system as an environment variable.

Agent webhook base: `https://your-cortex-os.com/api/agents/hr/webhook`

All webhook payloads carry:
```json
{
  "event": "event_name",
  "occurredAt": "ISO8601",
  "data": { /* event-specific payload */ }
}
```

The agent validates requests with `X-HRM-Secret` (same shared secret, reversed direction).

---

### `leave_request.created`

Fired immediately when an employee submits a leave request via the HRM system's own UI.
This triggers the agent to send a Telegram approval request without waiting for the daily CRON.

```json
{
  "event": "leave_request.created",
  "occurredAt": "2025-12-18T10:30:00Z",
  "data": {
    "leaveRequestId": "string",
    "employeeId": "string",
    "employeeName": "string",
    "type": "annual",
    "fromDate": "2025-12-20",
    "toDate": "2025-12-24",
    "totalDays": 5,
    "reason": "Family vacation",
    "leaveBalance": 14
  }
}
```

---

### `wfh_request.created`

Fired immediately when an employee submits a WFH request.

```json
{
  "event": "wfh_request.created",
  "occurredAt": "2025-12-18T08:00:00Z",
  "data": {
    "wfhRequestId": "string",
    "employeeId": "string",
    "employeeName": "string",
    "date": "2025-12-20",
    "reason": "Doctor appointment in the morning"
  }
}
```

---

### `employee.created`

Fired when a new employee is added to the HRM system.
The agent sends a Telegram notification to the owner.

```json
{
  "event": "employee.created",
  "occurredAt": "2025-12-18T09:00:00Z",
  "data": {
    "employeeId": "string",
    "name": "string",
    "role": "string",
    "department": "string | null",
    "joinedAt": "2025-12-18"
  }
}
```

---

### `employee.updated`

Fired when salary, role, or contract details change.

```json
{
  "event": "employee.updated",
  "occurredAt": "2025-12-18T09:00:00Z",
  "data": {
    "employeeId": "string",
    "name": "string",
    "changes": {
      "salary": { "from": 50000, "to": 55000 },
      "role": { "from": "Junior Dev", "to": "Mid Dev" }
    }
  }
}
```

---

## Summary: What the Agent Calls and When

### Daily at 9:00 AM

| Step | Call |
|---|---|
| 1 | `GET /leave-requests/pending` |
| 2 | `GET /wfh-requests/pending` |
| 3 | `GET /employees/today/on-leave` |
| 4 | `GET /employees/today/wfh` |
| 5 | `GET /employees/alerts?withinDays=7` |

For each pending leave → sends individual Telegram message with Approve/Reject.
For each pending WFH → sends individual Telegram message with Approve/Reject.
Sends one summary digest: who is on leave today, who is WFH, any HR alerts.

### On Telegram "Approve" for leave

| Step | Call |
|---|---|
| 1 | `POST /leave-requests/:id/approve` |

### On Telegram "Reject" for leave (after follow-up reason)

| Step | Call |
|---|---|
| 1 | `POST /leave-requests/:id/reject` with reason |

### Monthly on the 25th

| Step | Call |
|---|---|
| 1 | `POST /payslips/generate` with current month |
| 2 | For each employee in sequence: send Telegram, wait for approval |
| 3 | On approval: `POST /payslips/:id/approve` |
| 4 | On edit: `PATCH /payslips/:id`, re-show updated figure |
| 5 | After all done: `GET /payslips/export/:month` URL sent to Telegram |

### On Webhook `leave_request.created`

| Step | Call |
|---|---|
| 1 | `GET /leave-requests/:id` to get full details |
| 2 | Send Telegram approval immediately (no waiting for 9am) |

### On Webhook `wfh_request.created`

Same pattern as leave — immediate Telegram approval.

---

## Error Handling Contract

The HRM system must return standard HTTP status codes:

| Code | When |
|---|---|
| `200` | Successful read or update |
| `201` | Successful create |
| `400` | Missing or invalid fields |
| `401` | Missing or wrong `X-HRM-Secret` |
| `404` | Resource not found |
| `409` | Conflict (duplicate, wrong status) |
| `422` | Business rule violation (insufficient balance, past date) |
| `500` | Internal server error |

Error response shape (always):
```json
{
  "error": "Human-readable message"
}
```

---

## Quick Reference — All Endpoints

```
GET    /employees
GET    /employees/:id
GET    /employees/today/on-leave
GET    /employees/today/wfh
GET    /employees/alerts

GET    /leave-requests
GET    /leave-requests/pending
POST   /leave-requests
POST   /leave-requests/:id/approve
POST   /leave-requests/:id/reject

GET    /wfh-requests/pending
POST   /wfh-requests
POST   /wfh-requests/:id/approve
POST   /wfh-requests/:id/reject

GET    /payslips
GET    /payslips/:employeeId/:month
POST   /payslips/generate
PATCH  /payslips/:id
POST   /payslips/:id/approve
POST   /payslips/:id/mark-paid
GET    /payslips/export/:month

Webhooks (HRM → Agent):
  leave_request.created
  wfh_request.created
  employee.created
  employee.updated
```
