# Data Model: opencode-status-sync

## Overview

The opencode-status-sync plugin has a minimal data model. It does not persist any data — all state is in-memory and ephemeral.

## Configuration Model

### PetsConfig

The plugin's configuration, read from `opencode-status-sync.json`.

```typescript
interface PetsConfig {
  /** Base URL of the pet service API (e.g., "http://192.168.137.197") */
  baseURL: string
}
```

**Validation Rules**:
- `baseURL` MUST be a non-empty string
- `baseURL` SHOULD be a valid URL (protocol + host)
- If `baseURL` is missing or empty, the plugin operates in disabled mode

**Source**: `opencode-status-sync.json`

### Config Example

```json
{
  "pets": {
    "baseURL": "http://192.168.137.197"
  }
}
```

### Config Defaults

| Field | Default | Behavior When Missing |
|-------|---------|----------------------|
| `baseURL` | `undefined` | Plugin logs warning, all API calls are skipped |

## Runtime State Model

### PluginState

In-memory state tracked during plugin lifetime.

```typescript
interface PluginState {
  /** Currently active pet state */
  currentState: PetState
  
  /** Whether the plugin is active (has valid config) */
  enabled: boolean
  
  /** Configured base URL */
  baseURL: string | undefined
}
```

### PetState

Enumeration of possible pet visual states.

```typescript
type PetState = 
  | "thinking"   // AI is generating a response or session just started
  | "idle"       // AI is waiting for user input
  | "error"      // Error state
  | "reading"    // AI is reading files
  | "writing"    // AI is writing/editing files
  | "working"    // AI is running commands or executing other tools
```

### State Transitions

```
                    ┌──────────┐
         ┌─────────→│ thinking │←─────────┐
         │          └────┬─────┘          │
         │               │                │
    session.created   tool calls     tool complete
         │               │           (debounced)
         │          ┌────▼─────┐          │
         │   ┌─────→│ reading  │─────┐    │
         │   │      └──────────┘     │    │
         │   │      ┌──────────┐     │    │
         │   └─────→│ writing  │─────┤    │
         │          └──────────┘     │    │
         │          ┌──────────┐     │    │
         │          │ working  │─────┘    │
         │          └────┬─────┘          │
         │               │                │
         │          ┌────▼─────┐          │
         │          │   idle   │          │
         │          └──────────┘          │
         │                               │
         │          ┌──────────┐         │
         └──────────│  error   │←────────┘
                    └──────────┘
                  session.error
                  (immediate)
```

> Transitions to `thinking`, `reading`, `writing`, `working` are debounced at 1000ms. `idle` and `error` fire immediately and cancel any pending debounce.

## Event Mapping Model

### SessionEvent → PetState

| OpenCode Session Event | PetState |
|------------------------|----------|
| `session.created` | `thinking` |
| `session.idle` | `idle` |
| `session.error` | `error` |

### ToolEvent → PetState

| OpenCode Tool | PetState |
|---------------|----------|
| `read` | `reading` |
| `glob` | `reading` |
| `grep` | `reading` |
| `edit` | `writing` |
| `write` | `writing` |
| `bash` | `working` |
| *(any other tool)* | `working` |

### Debounce Rules

| PetState | Debounce Policy |
|----------|----------------|
| `idle`, `error` | Fire immediately, cancel pending debounce |
| `thinking`, `reading`, `writing`, `working` | Debounced at 1000ms |

## API Request Model

### PetServiceRequest

HTTP request sent to the pet service.

```typescript
interface PetServiceRequest {
  /** Full URL: {baseURL}/{endpoint} */
  url: string
  /** HTTP method (always POST) */
  method: "POST"
  /** Request body (empty or minimal) */
  body?: string
}
```

### Endpoints

| Endpoint | Corresponding State |
|----------|-------------------|
| `/thinking` | thinking |
| `/idle` | idle |
| `/error` | error |
| `/reading` | reading |
| `/writing` | writing |
| `/working` | working |

## Logging Model

### LogEntry

Structured log entry via `client.app.log()`.

```typescript
interface LogEntry {
  service: "opencode-status-sync"
  level: "debug" | "info" | "warn" | "error"
  message: string
  extra?: Record<string, unknown>
}
```

**Log Levels by Scenario**:

| Scenario | Level | Extra Fields |
|----------|-------|-------------|
| Plugin initialized with baseURL | `info` | `{ baseURL }` |
| State transition | `debug` | `{ from, to }` |
| API call sent | `debug` | `{ url }` |
| API call succeeded | `debug` | `{ url, status }` |
| API call failed | `error` | `{ url, error }` |
| Missing config | `warn` | `{ message }` |
| Config read error | `warn` | `{ error }` |

## No Persistence

The plugin does NOT persist any state:
- No file system writes (except through OpenCode's logging)
- No database
- No local storage
- No cache files

All state is reset when OpenCode restarts.
