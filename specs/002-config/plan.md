# Implementation Plan: opencode-status-sync Config-Driven Refactoring

## Feature ID
`002-config`

## Technical Context

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Runtime | Bun | OpenCode plugin runtime, non-negotiable |
| Language | TypeScript (strict) | Type safety, native Bun .ts support |
| HTTP Client | Bun native `fetch` | Zero dependencies |
| Config Format | JSON (`opencode-status-sync.json`) | Standard for OpenCode ecosystem |
| Plugin SDK | `@opencode-ai/plugin` | Official type definitions (dev only) |

## Architecture Decision: Config-Driven Mapping

**Decision**: Replace all hardcoded state mappings with a `mapping` array in `opencode-status-sync.json`. The plugin reads the mapping at startup and uses it to determine which events trigger which API calls.

**Rationale**: The existing hardcoded approach limits extensibility. Users who want to add custom endpoints or remap states must modify the plugin source. A config-driven approach allows any `status` string to be mapped to any URL with any body and headers — no code changes needed.

### Config Schema

```typescript
interface StatusSyncConfig {
  debug: boolean
  baseURL: string
  headers: Record<string, string>
  mapping: MappingEntry[]
}

interface MappingEntry {
  status: string
  url: string
  body?: string
}
```

### State Detection Strategy

1. **`event` hook**: session.created/session.status → thinking, session.idle → idle, session.error → error
2. **`tool.execute.before` hook**: read/glob/grep → reading, edit/write → writing, bash/others → working
3. **`tool.execute.after` hook**: Reset to thinking (unless in error state)

### State Management

- Dedup: Skip consecutive identical states
- Debounce: 1000ms for non-terminal states
- Immediate: idle and error fire immediately

## Constitution Check

| Principle | Status |
|-----------|--------|
| Non-Intrusive | ✅ PASS |
| Fail-Safe | ✅ PASS |
| Minimal Dependencies | ✅ PASS |
| Fully Configurable | ✅ PASS |
| Observable | ✅ PASS |
| Extension-Ready | ✅ PASS |

## Implementation Phases

### Phase 1: Project Rename & Scaffolding
| Step | Description |
|------|-------------|
| 1.1 | Rename all `opencode-status-sync` references in source |
| 1.2 | Rename config file to `opencode-status-sync.json` |
| 1.3 | Update `package.json` |
| 1.4 | Update `README.md` |

### Phase 2: Config Schema & Parser
| Step | Description |
|------|-------------|
| 2.1 | Define TypeScript config types |
| 2.2 | Implement config reader with validation |
| 2.3 | Generate default config with 6 endpoint mappings |

### Phase 3: Core Plugin Logic Refactor
| Step | Description |
|------|-------------|
| 3.1 | Replace hardcoded maps with config-driven mapping |
| 3.2 | Refactor HTTP notifier for headers + body support |
| 3.3 | Refactor state management for dynamic statuses |
| 3.4 | Wire all hooks (event, tool.execute.before, tool.execute.after) |

### Phase 4: Integration & Polish
| Step | Description |
|------|-------------|
| 4.1 | Update `opencode.json` |
| 4.2 | Update spec documents |
| 4.3 | Type check (`bun x tsc --noEmit`) |
| 4.4 | Final review |

## File Manifest

| File | Action |
|------|--------|
| `.opencode/plugins/opencode-status-sync.ts` | Create (rename) |
| `opencode-status-sync.json` | Create (rename) |
| `package.json` | Edit |
| `README.md` | Edit |
| `opencode.json` | Edit |
| `tsconfig.json` | Verify |
