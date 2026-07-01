# Development Checklist: opencode-pets

## Feature: 001-opencode-pets-plugin
## Date: 2026-07-01

---

### Phase 1: Project Scaffolding

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Create `.opencode/plugins/` directory | ✅ Complete | |
| 1.2 | Create `opencode-pets.ts` skeleton | ✅ Complete | Full implementation |
| 1.3 | Create root `package.json` | ✅ Complete | Dev deps: @opencode-ai/plugin, typescript, @types/bun |
| 1.4 | Create `tsconfig.json` | ✅ Complete | Strict mode, ESNext target |
| 1.5 | Create root `README.md` | ✅ Complete | Usage and installation docs |
| 1.6 | Create `opencode.json` | ✅ Complete | Example config with pets.baseURL |
| 1.7 | Create `.gitignore` | ✅ Complete | node_modules, dist, logs |

### Phase 2: Core Plugin Logic

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Config reading from `opencode.json` | ✅ Complete | `readConfig()` with null-safe parsing |
| 2.2 | HTTP request helper | ✅ Complete | `notify()` with fetch + 5s timeout + error handling |
| 2.3 | State deduplication | ✅ Complete | `currentState` tracking in closure |
| 2.4 | Event → state mapping | ✅ Complete | TOOL_STATE_MAP + SESSION_STATE_MAP |
| 2.5 | Session event handler | ✅ Complete | `event` hook: created/thinking, idle/idle, error/sleeping |
| 2.6 | Tool event handler | ✅ Complete | `tool.execute.before`: tool→reading/writing/runing/working |
| 2.7 | Tool after handler | ✅ Complete | `tool.execute.after`: back to thinking |
| 2.8 | Plugin initialization and logging | ✅ Complete | Info on load, warn on missing config, debug on transitions |

### Phase 3: Quality Gates

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | TypeScript compilation | ✅ Complete | `tsc --noEmit` passes with 0 errors |
| 3.2 | Dependencies installed | ✅ Complete | bun install successful |
| 3.3 | Code review ready | ⏳ Pending | Phase 3.5 |
| 3.4 | Testing | ⏳ Pending | Phase 4 |

---

## File Manifest

| File | Lines | Status |
|------|-------|--------|
| `.opencode/plugins/opencode-pets.ts` | 165 | ✅ Done |
| `package.json` | 19 | ✅ Done |
| `tsconfig.json` | 21 | ✅ Done |
| `opencode.json` | 6 | ✅ Done |
| `.gitignore` | 5 | ✅ Done |
| `README.md` | 60 | ✅ Done |

## Build Verification

```
$ bun x tsc --noEmit
(no errors)
```

## Notes
- `as any` used in 4 places for `client.app.log()` body argument due to complex SDK generic types. The runtime behavior is correct - these are write-only log calls.
- Plugin is a single file under 200 lines (165 lines) — meets NFR-07.
- Zero external runtime dependencies — meets NFR-02.
