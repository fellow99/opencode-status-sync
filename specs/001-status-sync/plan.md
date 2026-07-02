# 001-status-sync Technical Plan (As-Built)

> This document is a retrospective technical plan documenting the actual architecture,
> design decisions, and implementation strategies as built.
> Module: 001-status-sync
> Corresponding spec: [spec.md](./spec.md)
> Last Updated: 2026-07-02

## 1. Technical Context

### 1.1 Runtime Environment

| Aspect | Detail |
|--------|--------|
| Runtime | Bun (OpenCode plugin runtime) |
| Language | TypeScript (strict mode, `tsconfig.json`) |
| Source | `.opencode/plugins/opencode-status-sync.ts` (368 lines) |
| Package Manager | Bun |

### 1.2 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@opencode-ai/plugin` | ^1.17.12 | TypeScript type definitions (dev only) |
| `@types/bun` | ^1.3.14 | Bun runtime types (dev only) |
| `typescript` | ^5.7.0 | TypeScript compiler (dev only) |

Runtime: **zero external dependencies**. Uses only Bun built-in `fetch` and OpenCode plugin context (`client`, `$`).

## 2. Constitution Compliance

| Principle | Status | Evidence |
|-----------|--------|----------|
| Non-Intrusive | ✅ Compliant | Fire-and-forget HTTP; no tool interception |
| Fail-Safe | ✅ Compliant | Try-catch all fetch; null config → disabled mode |
| Minimal Dependencies | ✅ Compliant | Zero runtime deps |
| Fully Configurable | ✅ Compliant | All mappings via JSON config |
| Observable | ✅ Compliant | `client.app.log()` at debug/info/warn/error |
| Extension-Ready | ✅ Compliant | Raw extension point names + wildcard |

## 3. Architecture

### 3.1 Component Diagram

```
┌─────────────────────────────────────────────────┐
│                OpenCode Runtime                   │
│  ┌───────────────────────────────────────────┐  │
│  │         opencode-status-sync Plugin         │  │
│  │                                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────┐  │  │
│  │  │  Config   │  │  State   │  │  HTTP   │  │  │
│  │  │  Reader   │──│  Manager │──│ Notifier│  │  │
│  │  └──────────┘  └──────────┘  └────┬────┘  │  │
│  │       ↑              ↑             │       │  │
│  │  ┌────┴──────────────┴─────────────┴───┐  │  │
│  │  │         Hook Dispatcher              │  │  │
│  │  │  event | tool.before | tool.after  │  │  │
│  │  └────────────────┬────────────────────┘  │  │
│  └───────────────────┼───────────────────────┘  │
│                      │                           │
│  ┌───────────────────▼───────────────────────┐  │
│  │        OpenCode Event System               │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │ HTTP (GET/POST)
                       ▼
┌─────────────────────────────────────────────────┐
│           External Status Service                 │
│  /thinking  /idle  /error  /reading              │
│  /writing   /working                             │
└─────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
1. OpenCode fires event (e.g., tool.execute.before: "read")
2. Hook dispatcher receives input.tool = "read"
3. transitionTo("read") called
4. findMapping("read") → exact match → { url: "/reading", method: "GET" }
5. Not immediate → debounce timer starts (1000ms)
6. If another event fires before timer: clears timer, sets new pending
7. After 1000ms: notify() → fetch(baseURL + "/reading")
```

## 4. Data Model

### 4.1 Configuration Types

```typescript
interface StatusSyncConfig {
  debug: boolean
  baseURL: string
  headers: Record<string, string>
  mapping: MappingEntry[]
}

interface MappingEntry {
  status: string   // OpenCode extension point name (e.g., "session.idle", "read", "*")
  url: string      // Relative API path (e.g., "/idle", "/reading")
  method?: string  // HTTP method, defaults to "GET"
  body?: string    // Request body, defaults to ""
}
```

### 4.2 Extension Point Detection

| OpenCode Extension Point | Detection Mechanism | Config status key |
|--------------------------|---------------------|-------------------|
| `session.created` | `event` hook → `event.type` | `session.created` |
| `session.status` | `event` hook → `event.type` | `session.status` |
| `session.idle` | `event` hook → `event.type` | `session.idle` |
| `session.error` | `event` hook → `event.type` | `session.error` |
| Tool execution (any) | `tool.execute.before` → `input.tool` | `read`, `glob`, `grep`, `edit`, `write`, `bash`, ... |
| Tool completion | `tool.execute.after` | `tool.execute.after` |
| Unknown tool (fallback) | `tool.execute.before` | `*` (wildcard) |

### 4.3 State Machine

```
  Any event → transitionTo(rawExtensionPoint)
       ↓
  findMapping(cfg, status) → exact or wildcard?
       ↓ no mapping
  skip (silent)
       ↓ has mapping
  dedup check (same as current/pending?)
       ↓ yes → skip
       ↓ no
  terminal guard (current is idle/error and new is non-terminal?)
       ↓ yes → skip
       ↓ no
  is new status terminal (session.idle/session.error)?
       ↓ yes → flushDebounce(), fire immediately
       ↓ no  → set pendingDebounceStatus, (re)start 1000ms timer
                   ↓ after 1000ms
                   currentStatus = target, notify(target)
```

### 4.4 Terminal State Constants

```typescript
const IMMEDIATE_STATUSES = new Set(["session.idle", "session.error"])
const ERROR_STATUSES = new Set(["session.error"])
const SESSION_STATE_EVENTS = new Set([
  "session.created", "session.status", "session.idle", "session.error"
])
const WILDCARD_STATUS = "*"
```

## 5. Key Algorithms

### 5.1 Config Validation (readConfig)

1. Read `opencode-status-sync.json` via `Bun.file()`; return `null` if absent
2. Parse JSON; return `null` on parse error
3. Validate `baseURL` is non-empty string; return `null` otherwise
4. Validate `mapping` is non-empty array; return `null` otherwise
5. Filter mapping entries: require `status` and `url` to be non-empty strings
6. Validate `headers`: extract string-valued entries from object
7. Return `{ baseURL, debug, headers, mapping }` with filtered entries

### 5.2 Mapping Lookup (findMapping)

```typescript
function findMapping(config, status):
  exact = config.mapping.find(m => m.status === status)
  if exact: return exact
  return config.mapping.find(m => m.status === "*")  // wildcard fallback
```

### 5.3 HTTP Notification (notify)

```typescript
async function notify(status):
  entry = findMapping(cfg, status)
  if !entry: return  // no mapping
  method = entry.method ?? "GET"
  url = baseURL (trailing / stripped) + entry.url
  controller = new AbortController()
  timeout = setTimeout(() => controller.abort(), 5000)
  try:
    response = await fetch(url, { method, signal, headers, body })
    log success/warning based on response.ok
  catch:
    log error
  finally:
    clearTimeout(timeout)
```

### 5.4 Event Filtering

The `event` hook filters by `SESSION_STATE_EVENTS`:
- `session.created`, `session.status` → mapped to `/thinking`
- `session.idle` → mapped to `/idle`
- `session.error` → mapped to `/error`
- All other event types (`message.*`, `file.*`, `todo.*`, `tui.*`, etc.) → silently ignored

This prevents non-state-change events from activating the wildcard mapping and overriding terminal states.

## 6. Error Handling

| Scenario | Handling |
|----------|----------|
| Config file missing | Log warn; return `{}` (no hooks) |
| Config parse error | Log warn; return `null` |
| `baseURL` missing/empty | Log debug; return `null` |
| `mapping` invalid entries | Filter out invalid; return `null` if none remain |
| HTTP fetch throws | Log error with URL; continue |
| HTTP non-2xx response | Log warn with status code; continue |
| AbortController timeout | Log error; continue (timeout = 5s) |
| Unknown extension point | Skip silently (no mapping, no wildcard) |

## 7. File Inventory

| File | Purpose | Lines |
|------|---------|-------|
| `.opencode/plugins/opencode-status-sync.ts` | Plugin source — config reader, state manager, HTTP notifier, hooks | 368 |
| `opencode-status-sync.json` | Default configuration — 11 mapping entries (6 API endpoints) | 18 |
| `package.json` | Project metadata and dev dependencies | 22 |
| `tsconfig.json` | TypeScript strict mode configuration | 26 |
| `README.md` | User-facing documentation | ~120 |

## 8. Testing Considerations

- **Type safety**: `bun x tsc --noEmit` — zero errors ✅
- **Config validation**: Invalid entries filtered; missing fields → disabled mode
- **Event filtering**: Non-session events silently ignored; dedup prevents duplicate calls
- **Terminal guard**: idle/error block non-terminal overrides
- **Edge cases**: concurrent debounce resets, config parse errors, missing wildcard, no headers
