# Tasks: opencode-status-sync Config-Driven Refactoring

## Feature ID
`002-config`

---

## Phase 1: Setup — Project Rename

**Goal**: Rename all project identifiers from `opencode-status-sync` to `opencode-status-sync`.

- [ ] T001 [P] Rename config file `opencode-status-sync.json` → `opencode-status-sync.json` with new schema format (debug, baseURL, headers, mapping with 6 endpoints)
- [ ] T002 [P] Update `package.json`: change name to `opencode-status-sync`, update description and keywords
- [ ] T003 [P] Update `README.md`: replace all `opencode-status-sync` references with `opencode-status-sync`, update config format documentation

---

## Phase 2: Foundational — Config Types & Parser

**Goal**: Define the new config schema types and implement config reading/validation. This blocks all user story phases.

- [ ] T004 Define TypeScript types for `StatusSyncConfig` and `MappingEntry` in `.opencode/plugins/opencode-status-sync.ts` — replace old `PetsConfig` interface
- [ ] T005 Implement `readConfig()` function in `.opencode/plugins/opencode-status-sync.ts` — read `opencode-status-sync.json`, validate schema, return null on invalid config

---

## Phase 3: User Story 1 — Config-Driven Status Mapping (P1)

**Goal**: Replace all hardcoded state-to-endpoint mappings with lookups from the `mapping` array in config. The plugin must work exactly as before but driven by JSON config.

**Independent Test**: Start OpenCode with `opencode-status-sync.json` configured; verify that session events and tool calls trigger correct HTTP requests to mapped endpoints.

- [ ] T006 [US1] Refactor plugin entry in `.opencode/plugins/opencode-status-sync.ts` — rename from `OpenCodePetsPlugin` to `OpenCodeStatusSync`, update all log service names from `opencode-status-sync` to `opencode-status-sync`, update all console prefixes from `[🐱 pets]` to `[📡 status-sync]`
- [ ] T007 [US1] Replace hardcoded `SESSION_STATE_MAP` and `TOOL_STATE_MAP` constants in `.opencode/plugins/opencode-status-sync.ts` with dynamic lookups from `config.mapping` — implement `findMappingByStatus(config, statusName)` helper
- [ ] T008 [US1] Refactor `notify()` HTTP function in `.opencode/plugins/opencode-status-sync.ts` — construct URL from `baseURL + mapping.url`, include `config.headers` in fetch options, include `mapping.body` as request body
- [ ] T009 [US1] Refactor state management in `.opencode/plugins/opencode-status-sync.ts` — `currentState` type changed from `PetState` to `string`, `IMMEDIATE_STATES` detected from mapping config entries for "idle" and "error"
- [ ] T010 [US1] Wire all hooks (`event`, `tool.execute.before`, `tool.execute.after`) in `.opencode/plugins/opencode-status-sync.ts` — use config-driven mapping for all state transitions, preserve dedup and debounce logic

---

## Phase 4: Polish & Cross-Cutting Concerns

**Goal**: Final integration, documentation updates, and verification.

- [ ] T011 [P] Update `opencode.json` in project root — remove any `opencode-status-sync` references if present
- [ ] T012 [P] Update `specs/constitution.md` — change project name from `opencode-status-sync` to `opencode-status-sync`
- [ ] T013 Run TypeScript type check: `bun x tsc --noEmit` — fix any type errors
- [ ] T014 [P] Update `specs/TECH.md` — update project name references
- [ ] T015 [P] Update `specs/ARCHITECTURE.md` — update project name and config file references
- [ ] T016 [P] Update `specs/overall-spec.md` — update project name and config references
- [ ] T017 [P] Update `specs/overall-plan.md` — update project name references
- [ ] T018 [P] Update `specs/README.md` — update project name and document references
- [ ] T019 Final verification — build passes, all old `opencode-status-sync` references removed, config file renamed

---

## Dependencies

```
Phase 1 (Setup) ──┐
                  ├──→ Phase 2 (Foundational) ──→ Phase 3 (US1) ──→ Phase 4 (Polish)
                  │
                  └──→ T001-T003 can run in parallel
                                    
Phase 2 blocks Phase 3 (config types needed for refactoring)
Phase 3 blocks Phase 4 (code must work before polish)

Within Phase 3: T006 → T007 → T008 → T009 → T010 (sequential, same file)
```

## Parallel Execution Opportunities

| Group | Tasks | Reason |
|-------|-------|--------|
| Setup | T001, T002, T003 | Different files, no dependencies |
| Polish | T011, T012, T014-T018 | Different files, independent |
| Polish | T013 | Depends on T010 (all code changes done) |

## Implementation Strategy

**MVP Scope** (Phases 1-3): Project renamed, config-driven, all 6 endpoints working. This is the minimum viable deliverable.

**Full Scope** (Phase 4): Documentation cleanup, type check, final verification.
