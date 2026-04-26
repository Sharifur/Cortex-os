# Telegram Approval Flow

## Outbound Message Format

```
🤖 [Agent Name] proposes:
[summary]

Run: abc123
Action: send_email → user@x.com
Risk: low

[✅ Approve]  [❌ Reject]  [💬 Follow up]
```

Inline keyboard callback data:
- `approval:<approvalId>:approve`
- `approval:<approvalId>:reject`
- `approval:<approvalId>:followup`

## Follow Up Flow

1. Owner taps **Follow up**
2. Bot edits message footer: *"Reply to this message with your instruction."* + sets `forceReply`
3. Bot stores `pendingApprovals.telegramThreadId = message_id` and `status = FOLLOWUP`
4. Owner sends free-text reply (e.g. *"make it shorter and mention Taspi"*)
5. Webhook receives reply, matches `reply_to_message.message_id` → `telegramThreadId`, appends to `followupMessages` and `AgentRun.context.followups`
6. Runtime sets `runStatus = FOLLOWUP`, enqueues new `agent-run` job that re-runs `decide()` with augmented context
7. New `ProposedAction[]` → fresh approval message → back to Approve / Reject / Follow up
8. Multiple follow-up rounds allowed; **capped at 5 per run** (configurable) to prevent loops

## Rules

- Only callbacks/replies from `users.telegramChatId` are honored — others silently dropped
- Approvals expire after **24h** (configurable); sweeper job marks expired and ends the run
- One approval = one action; multiple actions in a run = multiple Telegram messages
- The original approval message is **edited in place** on resolution to show outcome (Approved / Rejected / Followed-up → result)
- Follow-up ceiling: default 5 rounds per run — prevents infinite redraft loops

## Queue Involvement

| Event | Queue Used |
|---|---|
| Initial run | `agent-run` |
| Follow-up re-decide | `agent-followup` |
| Approved action execution | `agent-execute` |
| Sweep expired approvals | `approval-sweep` (every 15 min) |
