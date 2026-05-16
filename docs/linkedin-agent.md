# LinkedIn AI Agent

## Overview

The LinkedIn agent automates feed commenting, connection requests, DMs, and post publishing via the **Unipile API**. All actions require Telegram approval before execution.

**Agent key:** `linkedin`  
**Module:** `apps/api/src/modules/agents/linkedin/`  
**Files:** `agent.ts`, `linkedin.service.ts`, `schema.ts`, `linkedin.module.ts`

---

## API Stack

### Unipile (primary — all LinkedIn actions)

Unipile is a third-party LinkedIn API proxy. All credentials are stored in Settings.

| Setting key | Description |
|---|---|
| `unipile_api_key` | Unipile API key (`X-API-KEY` header) |
| `unipile_dsn` | Unipile DSN hostname (e.g. `api1.unipile.com:13000`) |

Base URL: `https://{unipile_dsn}/api/v1`

### Endpoints used

| Purpose | Method | Path |
|---|---|---|
| List LinkedIn accounts | GET | `/accounts?provider=LINKEDIN` |
| Fetch feed posts (native) | GET | `/posts?account_id={id}&limit=N` |
| Post a comment | POST | `/posts/{post_id}/comments` |
| Search people | POST | `/linkedin/search?account_id={id}` |
| Get profile | GET | `/users/{identifier}?account_id={id}` |
| Send connection invite | POST | `/users/invite` |
| Get connections | GET | `/users/relations?account_id={id}&limit=N` |
| Send DM | POST | `/chats` |
| Publish post | POST | `/posts?account_id={id}` |
| Raw Voyager proxy (feed fallback) | POST | `/linkedin` |

---

## Critical: Post ID compatibility for commenting

**Unipile's comment API (`POST /posts/{id}/comments`) requires a Unipile-native post ID.**

- Native post IDs come from `GET /api/v1/posts?account_id=X` — these are Unipile's internal IDs.
- LinkedIn activity URNs (`urn:li:activity:XXX`) fetched via the raw Voyager proxy are **NOT** compatible with the comment API.
- The agent's `buildContext` tries `getNativeFeedPosts()` first. Only if it returns 0 posts does it fall back to the Voyager proxy.
- When Voyager fallback is used, the stored `postId` in the action payload will be a LinkedIn URN — commenting will fail with `422 invalid_post`.

**Fix:** Ensure Unipile returns native posts for the connected account. Use the debug endpoint to verify.

---

## Feed fetch flow

```
buildContext()
  └─ getNativeFeedPosts(accountId, 20)         ← GET /api/v1/posts
       ├─ posts > 0 → feedSource = 'native'    ← IDs work with comment API
       └─ posts = 0 → getFeedWithDiagnostics() ← POST /api/v1/linkedin (Voyager)
                        feedSource = 'voyager' ← IDs are LinkedIn URNs, comment will fail
```

---

## Comment flow

```
decideFeedComments()
  └─ for each fresh post not in linkedinPosts table:
       ├─ LLM generates comment (with KB context + self-critique)
       ├─ inserts into linkedinPosts (externalId = post.id)
       └─ proposes action: { type: 'post_comment', payload: { postId, comment, accountId } }

[Telegram approval]

execute(post_comment)
  └─ postComment(postId, comment, accountId)
       └─ POST /api/v1/posts/{postId}/comments  { text, account_id }
```

---

## Database schema (`schema.ts`)

| Table | Key columns | Purpose |
|---|---|---|
| `linkedin_accounts` | `unipileAccountId`, `label`, `isActive`, `enableComments`, `dailyCommentsLimit` | Synced from Unipile |
| `linkedin_posts` | `externalId`, `authorName`, `draftComment`, `status`, `postedAt` | Tracks commented posts (dedup) |
| `linkedin_leads` | `profileUrl`, `status`, `lastContactedAt`, `profile_id` | Lead pipeline |
| `linkedin_niches` | `keywords`, `targetJobTitles`, `dailyConnectLimit` | Targeting config |
| `linkedin_connection_requests` | `profileId`, `status`, `note`, `sentAt` | Connection tracking |

---

## Dedup logic

Before proposing a comment, the agent queries `linkedinPosts.externalId` for all known post IDs. Posts already in the table are skipped. This prevents commenting twice on the same post.

---

## Rate limiting

Each account has `dailyCommentsLimit` (default: 10). The agent counts `postedAt` entries for today and caps proposals at the remaining quota.

---

## Debug endpoints

All require JWT auth (`Authorization: Bearer <token>`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/linkedin/debug/posts` | Raw Unipile `/posts` response — shows native post IDs and their format |
| GET | `/linkedin/accounts` | All synced accounts from DB |
| POST | `/linkedin/accounts/sync` | Pull accounts from Unipile into DB |
| GET | `/linkedin/posts` | Last 100 commented posts |
| GET | `/linkedin/reports/daily` | Per-account daily activity (14 days) |

**Use `/linkedin/debug/posts` to verify:**
1. Unipile is returning posts for the account
2. The post `id` field contains a Unipile-native ID (not a LinkedIn URN)
3. The `status` is 200

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `422 invalid_post` | `postId` is a LinkedIn URN, not a Unipile-native ID | Feed must use native posts — check `/linkedin/debug/posts` |
| `400 invalid_parameters: account_id` | `account_id` missing or wrong format | Verify account is synced via `/linkedin/accounts/sync` |
| Feed returns 0 posts, `feedSource: voyager` | `GET /api/v1/posts` returns nothing | Check Unipile account connection status in Unipile dashboard |
| `Unipile not configured` | Missing API key or DSN in Settings | Add `unipile_api_key` and `unipile_dsn` in Settings |
| BullMQ retrying old approval | Same run ID re-processed 3 times | Old approval — trigger a fresh run instead of approving stale Telegram messages |

---

## Config (stored in `agents` table `config` JSONB)

```json
{
  "targetTopics": ["digital agency", "marketing agency", ...],
  "maxCommentsPerRun": 3,
  "maxDMsPerRun": 2,
  "commentTone": "professional and insightful",
  "icpScoreThreshold": 6,
  "llm": { "provider": "openai", "model": "gpt-4o-mini" }
}
```
