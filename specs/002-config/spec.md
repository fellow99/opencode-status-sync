# Feature Specification: opencode-status-sync Config-Driven Refactoring

## Feature ID
`002-config`

## Overview

Restructure the opencode-status-sync plugin into opencode-status-sync with a fully configurable, mapping-driven architecture. Replace hardcoded state-to-endpoint mappings with a JSON configuration file (`opencode-status-sync.json`) that defines which OpenCode events and tool calls map to which API endpoints, HTTP methods, request bodies, and headers. Support all available OpenCode extension points (events, hooks, tools) so users can extend status synchronization beyond the original 6 pet states.

## Actors

| Actor | Role |
|-------|------|
| **OpenCode User** | Creates and edits `opencode-status-sync.json` to define status-to-API mappings. Installs the plugin. |
| **OpenCode AI Agent** | Performs actions that trigger plugin hooks, generating status events. |
| **External Status Service** | HTTP service that receives status notifications at configured endpoints. |

## User Scenarios

### Scenario 1: Basic Status Sync (Existing Behavior Preserved)
**Given** the plugin is installed and `opencode-status-sync.json` is configured with mapping entries
**When** OpenCode events fire (session created, tools execute, session idle, session error)
**Then** the plugin sends HTTP requests to the mapped URLs with configured bodies and headers

### Scenario 2: Config-Driven Mapping (New)
**Given** the user has defined a `mapping` array in `opencode-status-sync.json`
**When** an OpenCode event or hook fires that matches a mapping entry's status
**Then** the plugin sends an HTTP request to the mapped URL with the configured method, body, and headers

### Scenario 3: Custom Headers Support (New)
**Given** the user has configured `headers` in `opencode-status-sync.json`
**When** any API call is made
**Then** those headers are included in every request

### Scenario 4: Missing Configuration
**Given** `opencode-status-sync.json` does not exist or has no valid `mapping` entries
**When** any event would trigger a status update
**Then** the plugin logs a warning and does NOT make any API calls

### Scenario 5: Debug Mode
**Given** `debug` is set to `true` in `opencode-status-sync.json`
**When** the plugin initializes or processes any event
**Then** verbose console output is emitted showing state transitions and API calls

### Scenario 6: Project Rename
**Given** the project was previously named `opencode-status-sync`
**When** the refactoring is complete
**Then** all references to `opencode-status-sync` are changed to `opencode-status-sync`, the config file is renamed to `opencode-status-sync.json`, and the plugin identifier is updated

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Plugin SHALL be named `opencode-status-sync` in all identifiers, filenames, and config files | P0 |
| FR-02 | Configuration SHALL be read from `opencode-status-sync.json` in the project directory | P0 |
| FR-03 | Config SHALL support `debug` (boolean), `baseURL` (string), `headers` (object), and `mapping` (array) fields | P0 |
| FR-04 | Each mapping entry SHALL contain `status` (string), `url` (string), optional `method` (string, defaults to "GET"), and optional `body` (string) | P0 |
| FR-05 | Plugin SHALL subscribe to OpenCode hook types: `event`, `tool.execute.before`, `tool.execute.after` | P0 |
| FR-06 | Plugin SHALL map OpenCode session events to configured statuses via the `event` hook | P0 |
| FR-07 | Plugin SHALL map tool names to configured statuses via `tool.execute.before` and `tool.execute.after` hooks | P0 |
| FR-08 | Plugin SHALL support all documented OpenCode event types (session.*, tool.*, message.*, file.*, tui.*, etc.) | P1 |
| FR-09 | Plugin SHALL deduplicate consecutive identical status changes (no repeat API calls) | P1 |
| FR-10 | Plugin SHALL debounce rapid state transitions (1000ms default, configurable) | P1 |
| FR-11 | Plugin SHALL handle API call failures gracefully (log, never throw) | P0 |
| FR-12 | Plugin SHALL NOT block or delay any OpenCode operation | P0 |
| FR-13 | Plugin SHALL use native Bun `fetch` for HTTP requests (zero external dependencies) | P0 |
| FR-14 | Plugin SHALL include configured `headers` in every API request | P1 |
| FR-15 | Plugin SHALL send configured `body` as the request body in API calls | P1 |
| FR-16 | External status service endpoints at `http://192.168.137.197/{/idle,/error,/thinking,/reading,/writing,/working}` SHALL be mapped to appropriate OpenCode states | P0 |

## Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | Plugin SHALL be written in TypeScript (strict mode) | P0 |
| NFR-02 | Plugin SHALL have zero external runtime dependencies | P1 |
| NFR-03 | Plugin SHALL use `@opencode-ai/plugin` types for type safety | P1 |
| NFR-04 | All state transitions SHALL be logged via `client.app.log()` | P2 |
| NFR-05 | Errors SHALL be logged at error level with full context | P2 |
| NFR-06 | HTTP requests SHALL use a configurable timeout (default: 5 seconds) | P2 |

## Config Schema

```json
{
  "debug": true,
  "baseURL": "http://192.168.137.197",
  "headers": {},
  "mapping": [
    { "status": "idle",     "url": "/idle",     "method": "GET", "body": "" },
    { "status": "error",    "url": "/error",    "method": "GET", "body": "" },
    { "status": "thinking", "url": "/thinking", "method": "GET", "body": "" },
    { "status": "reading",  "url": "/reading",  "method": "GET", "body": "" },
    { "status": "writing",  "url": "/writing",  "method": "GET", "body": "" },
    { "status": "working",  "url": "/working",  "method": "GET", "body": "" }
  ]
}
```

### 字段说明

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `debug` | 否 | `false` | 不填则跳过调试日志 |
| `baseURL` | 是 | — | 接口环境根地址 |
| `headers` | 否 | `{}` | 不填则无需注入额外请求头 |
| `mapping` | 是 | — | 扩展点→接口映射数组 |
| `mapping[].status` | 是 | — | **OpenCode 扩展点**（状态、事件、调用等逻辑名称） |
| `mapping[].url` | 是 | — | 对应接口环境的接口路径 |
| `mapping[].method` | 否 | `"GET"` | HTTP 方法 |
| `mapping[].body` | 否 | `""` | 请求体字符串 |

### OpenCode 扩展点 → status 对应表

| OpenCode 扩展点 | 触发机制 | status | 说明 |
|----------------|---------|--------|------|
| `session.created` | `event` hook | `thinking` | 会话创建/用户发送消息 |
| `session.status` | `event` hook | `thinking` | 会话状态变更 |
| `session.idle` | `event` hook | `idle` | 会话空闲，等待用户 |
| `session.error` | `event` hook | `error` | 会话发生错误 |
| `tool.read` / `glob` / `grep` | `tool.execute.before` | `reading` | 读取文件/搜索 |
| `tool.edit` / `write` | `tool.execute.before` | `writing` | 编辑/写入文件 |
| `tool.bash` / 其他工具 | `tool.execute.before` | `working` | 执行命令/其他操作 |
| 任意工具执行完毕 | `tool.execute.after` | `thinking` | 工具完成，回到思考 |

## Event-to-Status Mapping Logic

| Trigger | How Detected | Default Status |
|---------|-------------|----------------|
| `session.created` or any message received | `event` hook → `event.type` | `thinking` |
| `session.idle` | `event` hook → `event.type` | `idle` |
| `session.error` | `event` hook → `event.type` | `error` |
| Tool `read`, `glob`, `grep` executes | `tool.execute.before` → `input.tool` | `reading` |
| Tool `edit`, `write` executes | `tool.execute.before` → `input.tool` | `writing` |
| Any other tool executes (bash, etc.) | `tool.execute.before` → `input.tool` | `working` |
| Tool completes (non-error state) | `tool.execute.after` | `thinking` |

All mappings are defined in `opencode-status-sync.json` — no hardcoded mappings in code.

## OpenCode Extension Points Used

| Hook | Event Types | Purpose |
|------|------------|---------|
| `event` | `session.*`, `message.*`, `file.*`, `tui.*` | Core status detection from session lifecycle |
| `tool.execute.before` | All tool names | Detect what tool is about to execute |
| `tool.execute.after` | All tool names | Reset state after tool completion |

All other hooks (`shell.env`, custom `tool`, `experimental.session.compacting`) documented for user extension but not activated in default config.

## Success Criteria

| ID | Criterion | Target |
|----|-----------|--------|
| SC-01 | Plugin loads without errors | 100% of startups |
| SC-02 | All 6 API endpoints correctly mapped in default config | 6/6 endpoints |
| SC-03 | Project rename complete (no `opencode-status-sync` references remain in code/config) | 0 occurrences |
| SC-04 | Config file renamed to `opencode-status-sync.json` | ✓ |
| SC-05 | Zero TypeScript compilation errors | 0 errors |
| SC-06 | Missing config results in clean degradation | No API calls, no crashes |
| SC-07 | External service unreachable does not affect OpenCode | No errors, no delays |

## Out of Scope

- Pet visualization/rendering (handled by external service)
- External service implementation
- WebSocket or persistent connections
- Config hot-reload (requires restart)
- UI for configuring the plugin
- npm publishing

## Assumptions

1. The external status service runs at the configured `baseURL`
2. The external service accepts GET requests
3. OpenCode's Bun runtime provides a standards-compliant `fetch`
4. The plugin is loaded as a local plugin (`.opencode/plugins/`)
5. Users are responsible for starting the external service separately

## Dependencies

| Dependency | Type | Required |
|------------|------|----------|
| OpenCode (with plugin support) | Runtime | Yes |
| Bun (bundled with OpenCode) | Runtime | Yes |
| External Status Service (HTTP API) | Runtime | Yes (for functionality) |
| `@opencode-ai/plugin` | Dev | Yes (for type checking) |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Service unreachable | Plugin degrades gracefully | Try-catch all API calls |
| OpenCode plugin API changes | Plugin may break on upgrade | Use documented event names |
| Config format changes | Backward compatibility | Support both old and new formats during migration |
| High-frequency events flood API | Many rapid requests | Dedup + debounce mechanism |
