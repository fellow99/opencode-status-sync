# Project Structure: opencode-status-sync

## Directory Tree

```
opencode-status-sync/
│
├── .opencode/                         # OpenCode project config
│   └── plugins/                       # Local plugin directory
│       └── opencode-status-sync.ts           # [PLANNED] Main plugin source
│
├── specs/                             # Specification documents
│   ├── README.md                      # ✅ Docs index & reading guide
│   ├── SPECS_CHECKLIST.md             # ✅ Spec completion checklist
│   ├── STRUCTURE.md                   # ✅ This file
│   ├── TECH.md                        # ✅ Technology selection
│   ├── ARCHITECTURE.md                # ✅ System architecture
│   ├── constitution.md                # ✅ Project principles
│   ├── overall-spec.md                # ✅ Feature specification
│   ├── overall-plan.md                # ✅ Implementation plan
│   ├── overall-data-model.md          # ✅ Data models & types
│   └── overall-test-cases.md          # ✅ Test cases (20 total)
│
├── logs/                              # Development & test logs
│   └── test-YYYYMMDD-N/              # [PLANNED] Per-session test logs
│       ├── TEST_CHECKLIST.md
│       ├── test-scripts/
│       ├── test-logs/
│       └── TEST_REPORT.md
│
├── .git/                              # Git repository
├── .gitignore                         # [PLANNED] Git ignore rules
├── package.json                       # [PLANNED] Project metadata
├── tsconfig.json                      # [PLANNED] TypeScript config
├── opencode.json                      # [PLANNED] OpenCode config (example)
└── README.md                          # [PLANNED] Project README
```

## File Purposes

### Plugin Source (to be created)
| File | Purpose |
|------|---------|
| `.opencode/plugins/opencode-status-sync.ts` | Plugin entry — event hooks, state management, HTTP notifier |

### Project Config (to be created)
| File | Purpose |
|------|---------|
| `package.json` | Project metadata, dev dependencies (`@opencode-ai/plugin`, `typescript`) |
| `tsconfig.json` | TypeScript configuration for IDE support |
| `opencode.json` | Example OpenCode config with `baseURL in opencode-status-sync.json` |
| `.gitignore` | Ignore patterns (node_modules, logs, etc.) |
| `README.md` | Project introduction and usage guide |

### Specification Documents (created)
| File | Lines | Purpose |
|------|-------|---------|
| `specs/constitution.md` | ~110 | Core principles and quality gates |
| `specs/overall-spec.md` | ~260 | Feature specification (FR, NFR, scenarios) |
| `specs/overall-plan.md` | ~230 | Implementation plan with state machine |
| `specs/ARCHITECTURE.md` | ~200 | Component architecture and data flow |
| `specs/TECH.md` | ~110 | Technology selection with rationale |
| `specs/overall-data-model.md` | ~190 | Type definitions and state transitions |
| `specs/overall-test-cases.md` | ~310 | 23 test cases in 6 categories |
| `specs/README.md` | ~50 | Document index |
| `specs/SPECS_CHECKLIST.md` | ~60 | Completion tracking |
| `specs/STRUCTURE.md` | ~60 | This file |

## Statistics

| Metric | Value |
|--------|-------|
| Spec documents | 10 |
| Total spec lines | ~1,700 |
| Plugin source files (planned) | 1 |
| Config files (planned) | 4 |
| Runtime dependencies | 0 |
| Dev dependencies | 2 |
