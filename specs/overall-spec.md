# Overall Specification: opencode-status-sync

## Feature ID
`001-opencode-status-sync-plugin`

## Feature Name
OpenCode 状态宠物插件 (OpenCode Status Pet Plugin)

## Overview

**opencode-status-sync** is an OpenCode plugin that monitors the AI agent's activity in real-time and sends status updates to a pet visualization service. Each state change triggers an HTTP request to a corresponding API endpoint, allowing a visual pet to reflect what OpenCode is currently doing — thinking, reading files, writing code, working (running commands or other tools), idling, or error state.

## Actors

| Actor | Role |
|-------|------|
| **OpenCode User** | Configures the plugin by creating `opencode-status-sync.json` with a `baseURL`. Observes the pet's visual state. |
| **OpenCode AI Agent** | Performs actions (thinking, reading, writing, executing) that trigger plugin hooks. |
| **Pet Service** | External HTTP service that receives status calls and renders the pet visualization. Runs at the configured `baseURL`. |

## User Scenarios

### Scenario 1: Plugin Installation and Configuration

**Given** the user has OpenCode installed
**When** they add the plugin file to `.opencode/plugins/` and create `opencode-status-sync.json` with `baseURL`
**Then** the plugin loads at OpenCode startup and logs the configured baseURL

### Scenario 2: AI Thinking State

**Given** the plugin is loaded and configured
**When** a new session is created (user sends a message) or the AI begins generating a response
**Then** the plugin sends a request to `{baseURL}/thinking`

### Scenario 3: AI Reading Files

**Given** the AI is processing a task
**When** the AI executes a read-related tool (read, glob, grep)
**Then** the plugin sends a request to `{baseURL}/reading`

### Scenario 4: AI Writing/Editing Files

**Given** the AI is processing a task
**When** the AI executes a write or edit tool
**Then** the plugin sends a request to `{baseURL}/writing`

### Scenario 5: AI Running Commands

**Given** the AI is processing a task
**When** the AI executes a bash/shell command
**Then** the plugin sends a request to `{baseURL}/working`

### Scenario 6: AI Working (Generic Activity)

**Given** the AI is processing a task
**When** the AI executes any tool not covered by reading/writing
**Then** the plugin sends a request to `{baseURL}/working`

### Scenario 7: AI Becomes Idle

**Given** the AI was actively working
**When** the session enters idle state (response complete, waiting for user)
**Then** the plugin sends a request to `{baseURL}/idle`

### Scenario 8: Error State

**Given** the plugin is loaded
**When** OpenCode encounters a session error
**Then** the plugin sends a request to `{baseURL}/error`

### Scenario 9: Missing Configuration

**Given** the plugin is loaded but `opencode-status-sync.json` does not exist or `baseURL` is not configured
**When** any event would trigger a status update
**Then** the plugin logs a warning and does NOT attempt API calls

### Scenario 10: Pet Service Unreachable

**Given** the plugin is configured with a valid baseURL
**When** the pet service is unreachable (network error, timeout)
**Then** the plugin logs the error and continues without affecting OpenCode

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Plugin SHALL load from `.opencode/plugins/` directory at OpenCode startup | P0 |
| FR-02 | Plugin SHALL read `baseURL` configuration from `opencode-status-sync.json` | P0 |
| FR-03 | Plugin SHALL log initialization status via `client.app.log()` | P1 |
| FR-04 | Plugin SHALL subscribe to OpenCode session events (`session.created`, `session.idle`, `session.error`) | P0 |
| FR-05 | Plugin SHALL subscribe to OpenCode tool execution events (`tool.execute.before`) | P0 |
| FR-06 | Plugin SHALL map `session.created` event to `POST {baseURL}/thinking` | P0 |
| FR-07 | Plugin SHALL map `session.idle` event to `POST {baseURL}/idle` | P0 |
| FR-08 | Plugin SHALL map `session.error` event to `GET {baseURL}/error` | P0 |
| FR-09 | Plugin SHALL map `tool.execute.before` (read/glob/grep tools) to `GET {baseURL}/reading` | P0 |
| FR-10 | Plugin SHALL map `tool.execute.before` (edit/write tools) to `GET {baseURL}/writing` | P0 |
| FR-11 | Plugin SHALL map `tool.execute.before` (bash and all other tools) to `GET {baseURL}/working` | P0 |
| FR-12 | Plugin SHALL deduplicate consecutive identical state changes (no repeat calls) | P1 |
| FR-13 | Plugin SHALL debounce rapid state transitions (1000ms delay, except idle/error which fire immediately) | P1 |
| FR-14 | Plugin SHALL handle API call failures gracefully (log, never throw) | P0 |
| FR-15 | Plugin SHALL function when `baseURL` is missing from `opencode-status-sync.json` (log warning, disable calls) | P1 |
| FR-16 | Plugin SHALL NOT block or delay any OpenCode operation | P0 |
| FR-17 | Plugin SHALL use native `fetch` (Bun built-in) for HTTP requests | P1 |

## Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | Plugin SHALL be written in TypeScript | P0 |
| NFR-02 | Plugin SHALL have zero external runtime dependencies | P1 |
| NFR-03 | Plugin SHALL use `@opencode-ai/plugin` types for type safety | P1 |
| NFR-04 | Plugin SHALL log all state transitions at debug level | P2 |
| NFR-05 | Plugin SHALL log errors at error level with request context | P2 |
| NFR-06 | HTTP requests SHALL use a reasonable timeout (default: 5 seconds) | P2 |
| NFR-07 | Plugin code SHALL be a single file (`opencode-status-sync.ts`) under 300 lines | P2 |

## Event-to-API Mapping

| OpenCode Event | Condition | API Endpoint | HTTP Method |
|----------------|-----------|-------------|-------------|
| `session.created` | — | `/thinking` | GET |
| `session.idle` | — | `/idle` | GET |
| `session.error` | — | `/error` | GET |
| `tool.execute.before` | tool is `read`, `glob`, `grep` | `/reading` | GET |
| `tool.execute.before` | tool is `edit`, `write` | `/writing` | GET |
| `tool.execute.before` | tool is `bash` or any other tool | `/working` | GET |
| `tool.execute.after` | current state is not `error` | `/thinking` | GET |

> State transitions to `thinking`, `reading`, `writing`, `working` are debounced at 1000ms to prevent rapid visual flicker. `idle` and `error` transitions fire immediately, cancelling any pending debounce timer.

## API Contract (Pet Service)

The pet service is an external dependency with the following interface:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/thinking` | GET | 思考中 — AI is thinking/generating |
| `/idle` | GET | 发呆中 — AI is idle, waiting for user |
| `/error` | GET | 出错 — AI encountered an error |
| `/reading` | GET | 阅读中 — AI is reading files |
| `/writing` | GET | 书写中 — AI is writing/editing files |
| `/working` | GET | 工作中 — AI is running commands or using other tools |

All endpoints:
- Accept empty or any request body
- Return any response (success is assumed if connection succeeds)
- No authentication required

## Success Criteria

| ID | Criterion | Target |
|----|-----------|--------|
| SC-01 | Plugin loads without errors in OpenCode | 100% of startups |
| SC-02 | Idle/error status changes are sent immediately; debounced states within 1100ms of first trigger | ≤1100ms |
| SC-03 | OpenCode session is unaffected when pet service is down | No errors, no delays |
| SC-04 | Consecutive same-state calls are deduplicated | 100% dedup rate |
| SC-05 | Missing config results in clean degradation (no API calls) | 100% |
| SC-06 | Zero TypeScript compilation errors | 0 errors |

## Out of Scope

- Pet visualization/rendering (handled by pet service)
- Pet service implementation (separate project)
- Multi-pet support
- Authentication/authorization for pet service
- WebSocket or persistent connections
- Request batching or queuing
- Pet state persistence across OpenCode restarts
- UI for configuring the plugin (config is JSON only)
- npm publishing (local plugin only in v0.1)

## Assumptions

1. The pet service runs at the configured `baseURL` and responds to GET requests
2. The pet service does not require authentication
3. The pet service endpoints accept GET requests with no request body
4. OpenCode's Bun runtime provides a standards-compliant `fetch` implementation
5. The plugin is loaded as a local plugin (`.opencode/plugins/`), not from npm
6. The user is responsible for starting the pet service separately

## Dependencies

| Dependency | Type | Required |
|------------|------|----------|
| OpenCode (with plugin support) | Runtime | Yes |
| Bun (bundled with OpenCode) | Runtime | Yes |
| Pet Service (external HTTP API) | Runtime | Yes (for functionality) |
| `@opencode-ai/plugin` | Dev | Yes (for type checking) |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pet service unreachable | Plugin degrades gracefully (no pet updates) | Try-catch all API calls, log errors |
| OpenCode plugin API changes | Plugin may break on upgrade | Pin to documented event names, monitor changelog |
| High-frequency tool calls flood API | Many rapid requests to pet service | Deduplicate consecutive same-state calls + 1000ms debounce on non-terminal states |
| Plugin blocks event loop | OpenCode becomes unresponsive | All HTTP calls use async/await, no synchronous operations |
