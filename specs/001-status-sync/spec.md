# Status Sync Plugin Specification

> Module: 001-status-sync
> Status: Implemented
> Last Updated: 2026-07-02

## 1. Module Overview

### 1.1 Purpose

The Status Sync plugin monitors OpenCode AI agent activity in real-time and sends HTTP notifications to an external status service. Each OpenCode event (session state change, tool execution) maps to a configurable API endpoint, allowing external systems to visualize what the AI is currently doing — thinking, reading files, writing code, running commands, idling, or encountering errors.

### 1.2 Problems Solved

- **Black box AI**: Users cannot tell what the AI is doing when it works silently between responses
- **Hardcoded mappings**: Previous implementation forced fixed state names and endpoints; users had no way to customize behavior
- **State pollution**: Non-state-change events (file watcher updates, message parts) previously overrode terminal states like idle/error

### 1.3 Scope

**Included**:
- Config-driven mapping of OpenCode extension points to HTTP endpoints
- Session event monitoring (`session.created`, `session.idle`, `session.error`)
- Tool execution monitoring (`tool.execute.before`, `tool.execute.after`)
- HTTP notification with configurable method (GET/POST), headers, and body
- State deduplication and 1000ms debounce to prevent API flood
- Immediate fire for terminal states (idle, error)
- Wildcard fallback for unmapped extension points
- Graceful degradation when config is missing or service is unreachable

**Excluded**:
- Status visualization (handled by external service)
- External service implementation
- WebSocket or persistent connections
- Config hot-reload (requires restart)
- Multi-service fanout (one baseURL per config)

## 2. User Stories

- As an OpenCode user, I can configure which OpenCode events map to which API endpoints, so I can customize the status visualization without modifying plugin code
- As an OpenCode user, I can see when the AI is idle (waiting for me), working (running tools), or in error state, so I know when to interact
- As a developer, I can add custom HTTP headers to all API requests, so I can integrate with authenticated services
- As a developer, I can specify HTTP method and body per endpoint, so I can use POST-based status APIs

## 3. Functional Requirements

### 3.1 Configuration

- FR-001-001: Plugin MUST read configuration from `opencode-status-sync.json` in the project directory
- FR-001-002: Configuration MUST support `debug` (boolean), `baseURL` (string), `headers` (object), and `mapping` (array) fields
- FR-001-003: Each mapping entry MUST contain `status` (OpenCode extension point name) and `url` (API endpoint path)
- FR-001-004: Each mapping entry MAY contain `method` (HTTP method, defaults to "GET") and `body` (request body, defaults to "")
- FR-001-005: Missing or invalid configuration MUST result in disabled mode — plugin logs warning, returns no hooks
- FR-001-006: Individual mapping entries with missing `status` or `url` fields MUST be filtered out during validation

### 3.2 Event Monitoring

- FR-002-001: Plugin MUST subscribe to OpenCode `event` hook for session-level state changes
- FR-002-002: Plugin MUST subscribe to `tool.execute.before` hook for tool execution detection
- FR-002-003: Plugin MUST subscribe to `tool.execute.after` hook for post-tool state recovery
- FR-002-004: `event` hook MUST filter to only `session.created`, `session.status`, `session.idle`, `session.error` — all other event types MUST be silently ignored
- FR-002-005: `tool.execute.before` MUST pass `input.tool` directly as the extension point status for config lookup

### 3.3 Extension Point Mapping

- FR-003-001: Extension point names MUST be used verbatim as config `status` keys — no translation layer
- FR-003-002: Mapping lookup MUST first attempt exact match, then fall back to `"*"` wildcard entry
- FR-003-003: Unmapped extension points (no exact match, no wildcard) MUST be skipped silently
- FR-003-004: `session.idle` and `session.error` MUST be treated as terminal states and fire immediately without debounce

### 3.4 State Management

- FR-004-001: Consecutive identical status transitions MUST be deduplicated (no repeat API calls)
- FR-004-002: Non-terminal states MUST be debounced at 1000ms to prevent API flood from rapid tool calls
- FR-004-003: Terminal states (idle/error) MUST fire immediately and cancel any pending debounce
- FR-004-004: Once a terminal state is reached, non-terminal transitions MUST be rejected until a new session starts

### 3.5 HTTP Notification

- FR-005-001: HTTP requests MUST use Bun native `fetch` — zero external dependencies
- FR-005-002: Configured headers MUST be included in every API request
- FR-005-003: HTTP method MUST default to GET if not specified in mapping entry
- FR-005-004: Request body MUST be sent only when explicitly configured in mapping entry
- FR-005-005: All HTTP calls MUST be wrapped in try-catch — failures MUST be logged, never thrown
- FR-005-006: Immediate state notifications MUST be fire-and-forget, not awaited

### 3.6 Non-Interference

- FR-006-001: Plugin MUST NOT block, delay, or intercept any OpenCode operation
- FR-006-002: Plugin MUST NOT throw unhandled errors that affect OpenCode's normal functioning

## 4. Key Entities

| Entity | Description | Key Attributes |
|--------|-------------|---------------|
| `StatusSyncConfig` | Root configuration from JSON file | `debug`, `baseURL`, `headers`, `mapping` |
| `MappingEntry` | Single extension point → endpoint mapping | `status`, `url`, `method?`, `body?` |
| Runtime State | In-memory tracking during plugin lifetime | `currentStatus`, `debounceTimer`, `pendingDebounceStatus` |
| `AppLogInput` | Typed wrapper for `client.app.log()` | `service`, `level`, `message`, `extra` |

## 5. Acceptance Scenarios

### Scenario: Plugin Loads with Valid Config
- Given `opencode-status-sync.json` exists with valid `baseURL` and `mapping`
- When OpenCode starts
- Then plugin logs initialization at info level and registers all three hooks

### Scenario: Session Idle Triggers Immediate Notification
- Given plugin is active and AI finishes responding
- When `session.idle` event fires
- Then plugin immediately sends HTTP request to mapped endpoint, cancels any pending debounce

### Scenario: Tool Execution Triggers Debounced Notification
- Given AI executes `read`, then `edit`, then `bash` within 500ms
- When debounce timer fires after 1000ms
- Then only the final state (`bash` → wildcard mapping) triggers an HTTP request

### Scenario: Missing Config Causes Graceful Degradation
- Given `opencode-status-sync.json` does not exist
- When OpenCode starts
- Then plugin logs warning and returns empty hooks object — no API calls attempted

### Scenario: Service Unreachable Does Not Affect OpenCode
- Given plugin is configured with valid baseURL but service is down
- When any event triggers a notification
- Then plugin logs error; OpenCode operates normally without delay

### Scenario: Non-State Events Are Ignored
- Given session is in idle state
- When `message.updated` or `file.edited` event fires
- Then plugin silently ignores it — state remains idle

## 6. Non-Functional Requirements

- NFR-001: TypeScript strict mode — zero `as any`, zero `@ts-ignore`
- NFR-002: Zero external runtime dependencies — only Bun built-in `fetch` and OpenCode plugin context
- NFR-003: HTTP timeout: 5 seconds per request
- NFR-004: Debounce window: 1000ms for non-terminal states
- NFR-005: Single-file implementation (<400 lines)

## 7. Assumptions & Constraints

- OpenCode runtime provides Bun with standards-compliant `fetch`
- External status service accepts HTTP requests with configurable methods
- Plugin is loaded as a local plugin from `.opencode/plugins/`
- User is responsible for starting and configuring the external service

## 8. Dependencies

| Dependency | Type | Required |
|------------|------|----------|
| OpenCode (with plugin support) | Runtime | Yes |
| Bun (bundled with OpenCode) | Runtime | Yes |
| External Status Service | Runtime | Yes (for functionality) |
| `@opencode-ai/plugin` | Dev | Yes (for type checking) |
