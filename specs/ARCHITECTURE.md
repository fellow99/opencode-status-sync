# Architecture: opencode-pets

## System Context

```
┌─────────────────────────────────────────────────────┐
│                   OpenCode Runtime                    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │          opencode-pets Plugin                 │    │
│  │                                               │    │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  │    │
│  │  │  Config   │  │  State   │  │   HTTP     │  │    │
│  │  │  Reader   │  │  Manager │  │  Notifier  │  │    │
│  │  └─────┬─────┘  └────┬─────┘  └─────┬─────┘  │    │
│  │        │              │              │         │    │
│  │  ┌─────▼──────────────▼──────────────▼─────┐  │    │
│  │  │           Event Dispatcher               │  │    │
│  │  └──────────────────┬──────────────────────┘  │    │
│  └─────────────────────┼─────────────────────────┘    │
│                        │                               │
│  ┌─────────────────────▼─────────────────────────┐    │
│  │          OpenCode Event System                 │    │
│  │  (session.*, tool.*, message.* events)         │    │
│  └───────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────┘
                        │
                        │ HTTP POST
                        ▼
┌─────────────────────────────────────────────────────┐
│                 Pet Service (External)                │
│                                                       │
│  GET/POST /thinking   GET/POST /idle                  │
│  GET/POST /working    GET/POST /reading               │
│  GET/POST /writing    GET/POST /runing               │
│  GET/POST /sleeping                                   │
└─────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Config Reader

**Purpose**: Read plugin configuration from `opencode.json`.

**Input**: Plugin context (`directory` path)
**Output**: `PetsConfig { baseURL: string }`

**Logic**:
1. Read `opencode.json` from the project directory
2. Parse the `pets` key
3. If missing or invalid, return default/warning

**Error Handling**: Missing config → log warning, return disabled state.

### 2. Event Dispatcher

**Purpose**: Subscribe to OpenCode events and route them to the state manager.

**Events Subscribed**:
- `session.created`, `session.idle`, `session.error` → via `event` hook
- `tool.execute.before` → via dedicated hook

**Mapping Logic**:
```
session.created     → "thinking"
session.idle        → "idle"
session.error       → "sleeping"
tool: read/glob/grep → "reading"
tool: edit/write     → "writing"
tool: bash           → "runing"
tool: other          → "working"
```

### 3. State Manager

**Purpose**: Track current state and deduplicate consecutive identical states.

**State**: `string` (one of: "thinking", "idle", "sleeping", "reading", "writing", "runing", "working", "")

**Logic**:
- On new state request:
  - If same as current state → no-op (dedup)
  - If different → update current state, trigger HTTP notifier

### 4. HTTP Notifier

**Purpose**: Send HTTP POST request to the pet service.

**Input**: `baseURL: string`, `endpoint: string` (e.g., "/thinking")
**Output**: void (fire-and-forget)

**Logic**:
1. Construct URL: `${baseURL}${endpoint}`
2. Send POST with `fetch()`
3. Handle response (ignore body, log status)
4. Handle errors (log, never throw)

**Error Handling**:
- Network error → log error, continue
- Timeout → log error, continue
- Non-2xx response → log warning, continue
- Never throw or reject

## Data Flow

```
1. OpenCode fires event (e.g., "tool.execute.before" with tool="bash")
2. Plugin's hook receives event
3. Event Dispatcher maps tool name "bash" → state "runing"
4. State Manager checks: is "runing" === currentState?
   - Yes: return (no-op)
   - No: update currentState, call HTTP Notifier
5. HTTP Notifier calls POST http://192.168.137.197/runing
6. Pet Service receives request, updates pet visual
```

## Deployment

### As Local Plugin

```
~/.config/opencode/plugins/opencode-pets.ts  (global)
# OR
<project>/.opencode/plugins/opencode-pets.ts  (per-project)
```

### Configuration

```json
// opencode.json
{
  "pets": {
    "baseURL": "http://192.168.137.197"
  }
}
```

## File Structure

```
opencode-pets/
├── .opencode/
│   └── plugins/
│       └── opencode-pets.ts       # Plugin source (single file)
├── specs/                         # Specification documents
│   ├── README.md
│   ├── SPECS_CHECKLIST.md
│   ├── STRUCTURE.md
│   ├── TECH.md
│   ├── ARCHITECTURE.md            # This file
│   ├── constitution.md
│   ├── overall-spec.md
│   ├── overall-plan.md
│   ├── overall-data-model.md
│   └── overall-test-cases.md
├── logs/                          # Development & test logs
├── package.json                   # Project metadata
├── tsconfig.json                  # TypeScript config
├── opencode.json                  # Example config
└── README.md                      # Project README
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single file plugin | Minimizes complexity; under 200 lines covers all functionality |
| `event` hook + `tool.execute.before` | Covers all session events AND tool-specific detection |
| State deduplication in-memory | Avoids redundant API calls for rapid same-type tool executions |
| Fire-and-forget HTTP | Non-blocking; API failures never affect OpenCode |
| No retry logic | Pet service availability is not critical; simplicity over resilience |
| No persistent state | Plugin is stateless across restarts; reset on each load |
