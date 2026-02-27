# Workspace Lock API

> **Purpose**: Coordinate multi-device access to cloud workspaces using time-limited locks with heartbeats. Replaces poll-based version checking.

## Overview

Only one device at a time holds a lock on a workspace. The lock has a **60-second TTL** and the client sends a **heartbeat every 20 seconds** to keep it alive. If a device goes offline or closes the tab, the lock expires naturally and another device can acquire it.

---

## Endpoints

All endpoints are scoped to:

```
/api/workspaces/:uuid/lock
```

### 1. Acquire Lock — `POST /api/workspaces/:uuid/lock`

Called when a device opens a cloud workspace.

**Request Body:**

```json
{
  "device_id": "a1b2c3d4-...",
  "ttl": 60
}
```

| Field       | Type   | Description                                                    |
|-------------|--------|----------------------------------------------------------------|
| `device_id` | string | Unique per browser session (`crypto.randomUUID()` in `sessionStorage`) |
| `ttl`       | number | Lock time-to-live in seconds (client requests 60)              |

**Responses:**

| Status | Meaning         | Body                                                                 |
|--------|-----------------|----------------------------------------------------------------------|
| `200`  | Lock acquired   | `{ "lock": { "device_id": "...", "expires_at": "ISO8601", "version": 42 } }` |
| `409`  | Already locked  | `{ "error": "workspace_locked", "lock": { "device_id": "...", "expires_at": "ISO8601" } }` |

**Notes:**
- If the workspace has no active lock (or the existing lock has expired), grant the lock and return `200`.
- If the workspace is already locked by a **different** `device_id` and the lock hasn't expired, return `409`.
- If the requesting `device_id` already holds the lock, treat it as a re-acquire (reset TTL) and return `200`.
- The `version` field in the `200` response is the current workspace version (so the client knows the baseline).

---

### 2. Heartbeat — `PUT /api/workspaces/:uuid/lock`

Called every **20 seconds** while the workspace is open and the tab is visible.

**Request Body:**

```json
{
  "device_id": "a1b2c3d4-..."
}
```

**Responses:**

| Status | Meaning                  | Body                                                                 |
|--------|--------------------------|----------------------------------------------------------------------|
| `200`  | Lock renewed             | `{ "lock": { "device_id": "...", "expires_at": "ISO8601" } }`       |
| `409`  | Lock stolen by another   | `{ "error": "lock_stolen", "lock": { "device_id": "...", "expires_at": "ISO8601" } }` |
| `404`  | No lock exists           | `{ "error": "no_lock" }`                                            |

**Notes:**
- `200`: The lock belongs to this `device_id` — reset the TTL to 60s from now.
- `409`: Another device acquired the lock after ours expired. Client must close the workspace and re-open (pull fresh).
- `404`: Lock expired and nobody re-acquired. Client should re-acquire via `POST`.

---

### 3. Release Lock — `DELETE /api/workspaces/:uuid/lock`

Called on workspace close, `beforeunload`, or explicit deactivation. Enables instant handoff to another device without waiting for TTL expiry.

**Request Body (or query param):**

```json
{
  "device_id": "a1b2c3d4-..."
}
```

**Responses:**

| Status | Meaning              | Body                        |
|--------|----------------------|-----------------------------|
| `200`  | Lock released        | `{ "ok": true }`            |
| `403`  | Not your lock        | `{ "error": "not_owner" }`  |
| `404`  | No lock exists       | `{ "error": "no_lock" }`    |

**Notes:**
- Only the `device_id` that holds the lock can release it.
- `403` / `404` are non-fatal — the client can ignore them.
- Consider using `navigator.sendBeacon()` for the `beforeunload` case since `fetch` may be cancelled. If that's easier, this endpoint can also accept a `POST` with `_method=DELETE` or a dedicated `POST /api/workspaces/:uuid/unlock` alias.

---

## Backend Storage

The lock is a single record per workspace. Suggested schema:

```
workspace_locks
├── workspace_uuid   (PK, FK → workspaces.uuid)
├── device_id        (string)
├── expires_at       (timestamp)
├── created_at       (timestamp)
└── updated_at       (timestamp)
```

**Lock acquisition logic (pseudo-code):**

```sql
-- Atomic acquire: only succeeds if no valid lock exists
INSERT INTO workspace_locks (workspace_uuid, device_id, expires_at)
VALUES (:uuid, :device_id, NOW() + INTERVAL :ttl SECOND)
ON CONFLICT (workspace_uuid) DO UPDATE
  SET device_id = :device_id,
      expires_at = NOW() + INTERVAL :ttl SECOND
  WHERE workspace_locks.expires_at < NOW()           -- expired
     OR workspace_locks.device_id = :device_id;      -- same device re-acquire
```

If the `UPDATE` affects 0 rows → lock is held by someone else → return `409`.

---

## Client-Side Flow

```
┌──────────────────────────────────────────────────┐
│  Open Workspace                                  │
│  ┌─────────────────────────┐                     │
│  │ POST /lock              │                     │
│  │ { device_id, ttl: 60 }  │                     │
│  └────────┬────────────────┘                     │
│           │                                      │
│     200 ──┤──→ Pull workspace, start heartbeat   │
│     409 ──┤──→ Show "workspace in use" message   │
│           │                                      │
│  ┌────────▼────────────────┐                     │
│  │ Every 20s (tab visible) │                     │
│  │ PUT /lock               │                     │
│  │ { device_id }           │                     │
│  └────────┬────────────────┘                     │
│           │                                      │
│     200 ──┤──→ Continue working                  │
│     409 ──┤──→ Lock stolen → close workspace     │
│     404 ──┤──→ Lock expired → re-acquire (POST)  │
│           │                                      │
│  ┌────────▼────────────────┐                     │
│  │ Tab hidden / offline    │                     │
│  │ → Stop heartbeat        │                     │
│  │ → Lock expires in ≤60s  │                     │
│  └─────────────────────────┘                     │
│                                                  │
│  ┌─────────────────────────┐                     │
│  │ Close workspace /       │                     │
│  │ beforeunload            │                     │
│  │ DELETE /lock            │                     │
│  │ { device_id }           │                     │
│  └─────────────────────────┘                     │
└──────────────────────────────────────────────────┘
```

### Key Client Behaviors

| Event                | Action                                                      |
|----------------------|-------------------------------------------------------------|
| Open workspace       | `POST /lock` → on `200` pull & start heartbeat              |
| Tab visible          | Resume heartbeat (`PUT /lock` every 20s)                    |
| Tab hidden           | Pause heartbeat (lock will expire after TTL)                |
| Browser offline      | Close workspace immediately (no network = no work)          |
| Browser online       | Re-open workspace (`POST /lock` + pull)                     |
| `beforeunload`       | `DELETE /lock` via `sendBeacon` for clean handoff            |
| Heartbeat `409`      | Another device took over → close workspace, show message    |
| Heartbeat `404`      | Lock expired naturally → re-acquire via `POST`              |

### Device ID

- Generated once per browser session: `crypto.randomUUID()`
- Stored in `sessionStorage` (not `localStorage`) so each tab gets its own identity
- This means two tabs in the same browser are treated as two separate devices

---

## What This Replaces

- **`checkRemoteVersion()`** — no longer needed; heartbeat serves as the "am I still the owner?" check
- **`pullIfChanged()` on tab focus** — replaced by heartbeat response; if `409` we re-pull everything
- **`expected_version` in PATCH** — can remain as an optional safety net but is no longer the primary coordination mechanism
- **Visibility/online event listeners** that call `checkRemoteVersion` — replaced by heartbeat start/stop logic

---

## Timing Summary

| Parameter           | Value  |
|---------------------|--------|
| Lock TTL            | 60s    |
| Heartbeat interval  | 20s    |
| Max missed beats    | ~2-3 before expiry |
| Handoff latency     | 0s (DELETE) or ≤60s (natural expiry) |
