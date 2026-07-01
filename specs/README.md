# opencode-pets — Specification Documents

## Project Overview

**opencode-pets** is an OpenCode plugin that monitors the AI agent's activity in real-time and sends status updates to a pet visualization service. When OpenCode is thinking, reading files, writing code, running commands, or idling — the pet reflects that state visually.

## Document Index

| Document | Description | Status |
|----------|-------------|--------|
| [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) | Specification document completion checklist | ✅ Complete |
| [STRUCTURE.md](./STRUCTURE.md) | Project directory and file structure | ✅ Complete |
| [TECH.md](./TECH.md) | Technology selection and rationale | ✅ Complete |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and component design | ✅ Complete |
| [constitution.md](./constitution.md) | Project principles and quality gates | ✅ Complete |
| [overall-spec.md](./overall-spec.md) | Feature specification (requirements, scenarios) | ✅ Complete |
| [overall-plan.md](./overall-plan.md) | Implementation plan and task breakdown | ✅ Complete |
| [overall-data-model.md](./overall-data-model.md) | Data models, types, and state transitions | ✅ Complete |
| [overall-test-cases.md](./overall-test-cases.md) | Test cases index (20 test cases) | ✅ Complete |

## Reading Order (Recommended)

1. **constitution.md** — Understand project principles
2. **overall-spec.md** — Understand what we're building
3. **ARCHITECTURE.md** — Understand how it works
4. **overall-plan.md** — Understand implementation steps
5. **TECH.md** — Understand technology choices
6. **overall-data-model.md** — Understand data structures
7. **overall-test-cases.md** — Understand test coverage
8. **STRUCTURE.md** — Navigate the codebase

## Feature ID
`001-opencode-pets-plugin`

## Key Links

- **OpenCode Plugin Documentation**: [plugins.mdx](https://opencode.ai/docs/plugins)
- **OpenCode ACP Documentation**: [acp.mdx](https://opencode.ai/docs/acp)
- **Pet Service API**: `http://192.168.137.197` (configurable)
