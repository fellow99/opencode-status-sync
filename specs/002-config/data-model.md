# Data Model: opencode-status-sync

## Config Types

```typescript
/** Root configuration structure read from opencode-status-sync.json */
interface StatusSyncConfig {
  /** Enable debug logging to console */
  debug: boolean
  /** Base URL for the external status service (e.g., "http://192.168.137.197") */
  baseURL: string
  /** HTTP headers included in every API request */
  headers: Record<string, string>
  /** Array of status-to-endpoint mappings */
  mapping: MappingEntry[]
}

/** A single mapping entry: logical status → API endpoint + optional body */
interface MappingEntry {
  /** Logical status name (e.g., "thinking", "reading", "writing") */
  status: string
  /** Relative URL path to call when this status is active (e.g., "/thinking") */
  url: string
  /** HTTP method (default: "GET") */
  method?: string
  /** Optional request body string (empty for GET requests) */
  body?: string
}
```

## Runtime Types

```typescript
/** Internal state tracking */
type RuntimeState = {
  currentStatus: string
  debounceTimer: ReturnType<typeof setTimeout> | null
  pendingDebounceStatus: string | null
}

/** Log levels used for client.app.log() */
type LogLevel = "debug" | "info" | "warn" | "error"
```

## Event-to-Status Mapping

```typescript
/** Session events that trigger status changes */
const SESSION_EVENT_MAP: Record<string, string> = {
  "session.created": "thinking",
  "session.status": "thinking",
  "session.idle": "idle",
  "session.error": "error",
}

/** Tool name → status mapping (defaults, overridable via config) */
const TOOL_STATUS_MAP: Record<string, string> = {
  "read": "reading",
  "glob": "reading",
  "grep": "reading",
  "edit": "writing",
  "write": "writing",
}

/** Post-tool state: return to "thinking" after any tool completes */
const POST_TOOL_STATUS = "thinking"
```

## State Machine

```
  [Any event] → lookup status in config.mapping
       ↓
  Is status same as current or pending? → YES → skip (dedup)
       ↓ NO
  Is status in immediateList (idle, error)? → YES → fire immediately, cancel debounce
       ↓ NO
  Set pendingDebounceStatus, start/reset 1000ms timer
       ↓ (after 1000ms)
  Fire API call with configured url, body, headers
```

## Configuration Validation Rules

| Rule | Condition | Action |
|------|-----------|--------|
| Config file missing | `opencode-status-sync.json` not found | Log warn, return `null` (disabled mode) |
| `baseURL` missing/invalid | `baseURL` not a non-empty string | Log warn, return `null` |
| `mapping` missing/empty | `mapping` not an array or empty | Log warn, return `null` |
| `debug` missing | Field absent | Default to `false` |
| `headers` missing | Field absent | Default to `{}` |
| Mapping entry missing `url` | `url` not a non-empty string | Skip that mapping entry |
| Mapping entry missing `status` | `status` not a non-empty string | Skip that mapping entry |
