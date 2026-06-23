# Cortex-OS — Task Tracker

## Project Prefix: CX

## Sprint 1 — Live Chat human-alert fixes
**Status:** IN PROGRESS
**Started:** 2026-06-23

### Tickets

| Ticket | Title | Status | Priority | Tokens | Description |
|--------|-------|--------|----------|--------|-------------|
| CX-001 | Send human-alert email only once per waiting chat | DONE | HIGH | ~30k | Still fires after the 3-min wait, but never re-sends for the same waiting period. Wait/alert reset when an agent joins so a re-escalation gets one fresh email. |
| CX-002 | "Needs human" attention badge on admin LiveChat inbox | DONE | MED | ~30k | Orange pulsing badge on inbox rows whose status is `needs_human` so operators can spot chats needing attention at a glance. |
| CX-003 | Improve human-alert admin email template | DONE | MED | ~25k | Richer, actionable email: visitor name/email, wait duration, their last message quoted, clearer CTA + footer. |
| CX-004 | Operator can reply in a closed chat (auto-reopen) | DONE | HIGH | ~25k | Composer enabled on closed chats; sending auto-reopens as `human_taken_over` (backend + frontend). |
| CX-005 | Email "Join the chat" deep-link opens the exact conversation | DONE | HIGH | ~35k | New `app_base_url` setting (default `https://cortex.xgenious.com`); email CTA + push link to `/livechat?session=<id>`; web auto-opens session from `?session=`. Push click opens in installed PWA via SW. iOS email links open in Safari (Apple PWA limitation). |
| CX-006 | Push notification deduped — once per waiting chat | DONE | HIGH | ~35k | Removed repeating per-message needs-human pushes; the inactivity sweep is now the single source (gated by `human_alert_sent_at`, reset on join), mirroring the email. |

### Sprint Stats
- Total: 6  /  TODO: 0  /  IN_PROGRESS: 0  /  DONE: 6  /  BLOCKED: 0
- Tokens: ~180k total

### Notes
- Email logic: `apps/api/src/modules/agents/livechat/livechat-inactivity.service.ts` (`sweepNeedsHuman`)
- Wait/alert reset: `apps/api/src/modules/agents/livechat/livechat.service.ts` (`setSessionStatus`) — `humanAlertSentAt` reset to null on entering `needs_human`, and on join/reopen (`human_taken_over`/`open`).
- Badge: `apps/web/src/pages/LiveChatPage.tsx` (`InboxRow`)
- Email template: `livechat-inactivity.service.ts` (`buildHumanAlertHtml`, `formatWait`, `sendHumanAlertEmail`)
- Reopen-on-reply: `livechat-conversations.controller.ts` (`operatorReply`) + `LiveChatPage.tsx` (`composerEnabled`)
