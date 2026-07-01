# Data Model: opencode-pets

## Overview

The opencode-pets plugin has a minimal data model. It does not persist any data — all state is in-memory and ephemeral.

## Configuration Model

### PetsConfig

The plugin's configuration, read from `opencode-pets.json`.

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

**Source**: `opencode-pets.json`

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
  | "sleeping"   // Error state / inactive
  | "reading"    // AI is reading files
  | "writing"    // AI is writing/editing files
  | "runing"     // AI is running commands
  | "working"    // AI is executing other tools
```

### State Transitions

```
                    ┌──────────┐
         ┌─────────→│ thinking │←─────────┐
         │          └────┬─────┘          │
         │               │                │
    session.created   tool calls     tool complete
         │               │                │
         │          ┌────▼─────┐          │
         │   ┌─────→│ reading  │─────┐    │
         │   │      └──────────┘     │    │
         │   │      ┌──────────┐     │    │
         │   ├─────→│ writing  │─────┤    │
         │   │      └──────────┘     │    │
         │   │      ┌──────────┐     │    │
         │   ├─────→│ runing   │─────┤    │
         │   │      └──────────┘     │    │
         │   │      ┌──────────┐     │    │
         │   └─────→│ working  │─────┘    │
         │          └────┬─────┘          │
         │               │                │
         │          ┌────▼─────┐          │
         │          │   idle   │          │
         │          └──────────┘          │
         │                               │
         │          ┌──────────┐         │
         └──────────│ sleeping │←────────┘
                    └──────────┘
                  session.error
```

## Event Mapping Model

### SessionEvent → PetState

| OpenCode Session Event | PetState |
|------------------------|----------|
| `session.created` | `thinking` |
| `session.idle` | `idle` |
| `session.error` | `sleeping` |

### ToolEvent → PetState

| OpenCode Tool | PetState |
|---------------|----------|
| `read` | `reading` |
| `glob` | `reading` |
| `grep` | `reading` |
| `edit` | `writing` |
| `write` | `writing` |
| `bash` | `runing` |
| *(any other tool)* | `working` |

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
| `/sleeping` | sleeping |
| `/reading` | reading |
| `/writing` | writing |
| `/runing` | runing |
| `/working` | working |

## Logging Model

### LogEntry

Structured log entry via `client.app.log()`.

```typescript
interface LogEntry {
  service: "opencode-pets"
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
