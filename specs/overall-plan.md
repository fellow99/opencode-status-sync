# Overall Implementation Plan: opencode-pets

## Feature ID
`001-opencode-pets-plugin`

## Overview

Implementation plan for the OpenCode status pet plugin. The plugin is a single TypeScript file that hooks into OpenCode's event system and sends HTTP requests to a pet service API.

## Architecture Decision: Event Hook Approach

The plugin uses OpenCode's `event` hook to subscribe to all events, combined with `tool.execute.before` for tool-specific detection. This provides the broadest coverage of OpenCode state changes.

**Decision**: Use a single `event` hook that inspects `event.type` for session-level events, plus a `tool.execute.before` hook for tool-level events.

**Rationale**: The `event` hook is the most comprehensive event source, receiving all session, message, and lifecycle events. The `tool.execute.before` hook provides tool name inspection before execution.

## Implementation Plan

### Phase 1: Project Scaffolding

| Step | Description | Output |
|------|-------------|--------|
| 1.1 | Create `.opencode/plugins/` directory | Directory structure |
| 1.2 | Create `opencode-pets.ts` skeleton | Plugin entry file |
| 1.3 | Create root `package.json` with dev dependencies | Package manifest |
| 1.4 | Create `tsconfig.json` for IDE support | TypeScript config |
| 1.5 | Create root `README.md` | Project documentation |

### Phase 2: Core Plugin Logic

| Step | Description | Output |
|------|-------------|--------|
| 2.1 | Implement config reading from `opencode-pets.json` | `readConfig()` function |
| 2.2 | Implement HTTP request helper | `notifyPet()` function with error handling |
| 2.3 | Implement state deduplication | `currentState` tracking variable |
| 2.4 | Implement event → state mapping | Mapping logic |
| 2.5 | Implement session event handler | `session.created` → `/thinking`, `session.idle` → `/idle`, `session.error` → `/error` |
| 2.6 | Implement tool event handler | Tool name → `/reading`, `/writing`, `/working` |
| 2.7 | Implement plugin initialization and logging | Startup log with config status |
| 2.8 | Implement debounce logic | 1000ms debounce for thinking/reading/writing/working; idle/error fire immediately |

### Phase 3: Integration & Polish

| Step | Description | Output |
|------|-------------|--------|
| 3.1 | Wire all hooks together in plugin export | Complete plugin |
| 3.2 | Add JSDoc comments and type annotations | Documented code |
| 3.3 | Test with mock pet service | Verification |

## Implementation Order

```
Phase 1 (Scaffolding) → Phase 2 (Core Logic) → Phase 3 (Integration)
```

## File Manifest

| File | Purpose |
|------|---------|
| `.opencode/plugins/opencode-pets.ts` | Main plugin source code |
| `package.json` | Project metadata and dev dependencies |
| `tsconfig.json` | TypeScript configuration for IDE support |
| `opencode.json` | OpenCode project configuration (example) |
| `README.md` | Project README with usage instructions |

## Plugin Design

### State Machine

```
                    ┌──────────┐
         ┌─────────→│ THINKING │←─────────┐
         │          └────┬─────┘          │
         │               │                │
    session.created   tool calls     tool complete
         │               │           (debounced)
         │          ┌────▼─────┐          │
         │   ┌─────→│ READING  │─────┐    │
         │   │      └──────────┘     │    │
         │   │      ┌──────────┐     │    │
         │   └─────→│ WRITING  │─────┤    │
         │          └──────────┘     │    │
         │          ┌──────────┐     │    │
         │          │ WORKING  │─────┘    │
         │          └────┬─────┘          │
         │               │                │
         │          ┌────▼─────┐          │
         │          │  IDLE    │          │
         │          └──────────┘          │
         │                               │
         │          ┌──────────┐         │
         └──────────│  ERROR   │←────────┘
                    └──────────┘
                  session.error
                  (immediate)
```

### Config Schema

```typescript
interface PetsConfig {
  baseURL: string  // e.g., "http://192.168.137.197"
}
```

### Plugin Context Usage

```typescript
export const OpenCodePetsPlugin: Plugin = async ({ client, directory }) => {
  // 1. Read config from opencode.json
  const config = await readConfig(directory)
  
  // 2. Initialize logging
  await client.app.log({ body: { service: "opencode-pets", level: "info", message: `Initialized with baseURL: ${config.baseURL}` } })
  
  // 3. Track current state for dedup + debounce
  let currentState = ""
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pendingDebounceState: string | null = null
  const DEBOUNCE_MS = 1000
  const IMMEDIATE_STATES = new Set(["idle", "error"])
  
  return {
    // Session events via event hook
    event: async ({ event }) => {
      const newState = mapSessionEventToState(event.type)
      if (newState) await transitionTo(newState)
    },
    // Tool events via tool.execute.before hook
    "tool.execute.before": async (input) => {
      const newState = mapToolToState(input.tool)
      if (newState) await transitionTo(newState)
    },
  }
  
  async function transitionTo(newState: string) {
    if (newState === currentState || newState === pendingDebounceState) return
    if (IMMEDIATE_STATES.has(newState)) {
      if (debounceTimer) clearTimeout(debounceTimer)
      currentState = newState
      await notifyPet(config.baseURL, newState)
      return
    }
    pendingDebounceState = newState
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      const target = pendingDebounceState!
      pendingDebounceState = null
      currentState = target
      await notifyPet(config.baseURL, target)
    }, DEBOUNCE_MS)
  }
}
```

## Testing Strategy

### Unit Testing (Manual)
- Config parsing with valid and invalid inputs
- Event-to-state mapping logic
- State deduplication logic
- Debounce logic (rapid state changes within 1000ms window)
- Immediate fire for idle/error states

### Integration Testing (ACP-based)
- Start OpenCode in ACP mode
- Trigger various operations
- Verify HTTP requests reach pet service
- Verify debounce prevents rapid oscillation
- Verify idle/error fire immediately
- Verify error handling when pet service is down

### Test Environment
- Pet service mock: simple HTTP server that logs received requests
- OpenCode: ACP mode for programmatic interaction

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Plugin API changes in OpenCode | Pin to documented event names; version-gate if needed |
| Bun fetch behavior differences | Use standards-compliant fetch API only |
| Config file not readable | Graceful fallback with warning log |
| High-frequency duplicate events | State deduplication + 1000ms debounce (already designed) |
