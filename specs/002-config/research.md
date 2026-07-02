# Research: opencode-status-sync Config-Driven Refactoring

## Decision: Config Format

**Decision**: Use a `mapping` array in `opencode-status-sync.json` with `status`, `url`, and optional `body` fields.

**Rationale**: An array of mapping objects is the most flexible format. Each entry maps a logical status name to an API endpoint. Users can add new statuses without touching plugin code.

**Alternatives considered**:
- Nested object with status keys: More compact but less extensible. Array format allows metadata per entry.
- Separate config file for each status: Too fragmented.

## Decision: HTTP Method

**Decision**: Continue using GET for all requests. Body support added for future use cases but not required by default.

**Rationale**: The external status service at `192.168.137.197` uses simple GET endpoints. Adding body support in the config schema doesn't force its use — it's there for flexibility.

**Alternatives considered**:
- POST for all requests: Would break backward compatibility with the existing service.
- Configurable method per mapping entry: Over-engineering for current scope.

## Decision: State Detection

**Decision**: Use `event` hook for session events + `tool.execute.before` / `tool.execute.after` for tool-specific states.

**Rationale**: This is the same detection strategy as the original plugin, proven to work. The `event` hook catches all session lifecycle events. The `tool.execute.before` hook provides tool name before execution.

**Additional hooks available but not activated**:
- `shell.env`: Can inject env vars for external tools. Not needed for status sync.
- `tool`: Can register custom tools. Not needed for status sync.
- `experimental.session.compacting`: Session compaction customization. Not needed.

## Decision: Config File Location

**Decision**: Read `opencode-status-sync.json` from the project directory (`directory` from plugin context).

**Rationale**: This is where OpenCode looks for project-level config. Same location as the old `opencode-pets.json`.

## Decision: Headers Support

**Decision**: Support a `headers` object at the config root level that applies to all API calls.

**Rationale**: Some external services require authentication headers (e.g., `Authorization: Bearer xxx`). A single headers config is simpler than per-mapping-entry headers for the current scope.

## Decision: Status Deduplication & Debounce

**Decision**: Keep the existing deduplication (skip consecutive identical states) and debounce (1000ms for non-terminal states) logic.

**Rationale**: These are proven mechanisms that prevent API flood and visual flicker. The only change is that status names are now config-driven rather than hardcoded — the "immediate" states (idle, error) are detected by their config mapping presence.
