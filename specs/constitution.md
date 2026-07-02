# Constitution: opencode-status-sync

## Project Identity

**opencode-status-sync** is an OpenCode plugin that visualizes the AI agent's current activity state by sending status updates to a pet service API. Each state corresponds to a visual representation (sleeping, idle, thinking, reading, writing, running commands, working).

## Core Principles

### 1. Non-Intrusive Operation
The plugin MUST operate as a side-effect observer. It SHALL NOT:
- Intercept or modify any OpenCode tool execution
- Block or delay any OpenCode operation
- Throw unhandled errors that affect OpenCode's normal functioning
- Require user interaction during normal operation

### 2. Fail-Safe Design
- API call failures SHALL be silently logged and never propagated
- If the pet service is unreachable, the plugin SHALL degrade gracefully
- The plugin SHALL function correctly even without the pet service running

### 3. Minimal Dependencies
- Prefer zero external runtime dependencies
- Use only OpenCode-provided runtime APIs (fetch, Bun shell)
- TypeScript types from `@opencode-ai/plugin` are dev-only

### 4. Configurable
- The baseURL of the pet service SHALL be user-configurable
- Configuration SHALL be read from `opencode-status-sync.json`
- Sensible defaults SHALL be provided where applicable

### 5. Observable
- All status changes SHALL be logged via `client.app.log()` at debug level
- Plugin initialization SHALL log the configured baseURL at info level
- Errors SHALL be logged at error level with context

### 6. Single Responsibility
The plugin does ONE thing: map OpenCode events to pet service API calls. It does NOT:
- Manage pet state or animations
- Provide UI components
- Handle authentication or complex API flows
- Cache or batch requests beyond basic deduplication

## Quality Gates

| Gate | Criteria |
|------|----------|
| Type Safety | Zero TypeScript errors, no `as any` or `@ts-ignore` |
| Build | Plugin file parses without syntax errors |
| Runtime | Plugin loads in OpenCode without crashing |
| Config | Missing or invalid config degrades gracefully |
| API Failure | Pet service unreachable does not affect OpenCode |

## Development Standards

- Language: TypeScript (strict mode)
- Runtime: Bun (OpenCode's runtime)
- Testing: ACP-based integration testing where applicable
- Versioning: Semantic versioning (0.x.y during initial development)
