# Technology Selection: opencode-pets

## Runtime Environment

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Runtime | **Bun** | OpenCode plugins run in Bun. This is non-negotiable. |
| Language | **TypeScript** | Type safety for plugin development. `.ts` files natively supported. |
| Package Manager | **Bun** (npm-compatible) | OpenCode uses `bun install` for plugin dependencies. |

## Plugin SDK

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Type Definitions | `@opencode-ai/plugin` | Official type package for `Plugin`, `tool()`, etc. Dev dependency only. |
| SDK Client | OpenCode `client` object | Provided via plugin context. Used for logging (`client.app.log()`). |
| Shell Execution | Bun `$` shell API | Provided via plugin context. Used for optional advanced operations. |

## HTTP Client

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| HTTP Library | **Native `fetch`** | Bun provides a built-in `fetch` implementation. Zero dependencies. |
| Alternative Considered | `node-fetch`, `axios` | Rejected: unnecessary dependency overhead. |

## Configuration

| Aspect | Choice | Rationale |
|--------|--------|-----------|
|  `opencode-pets.json` | `opencode-pets.json` | Native OpenCode config file. No separate config file needed. |
| Config Format | JSON | Standard for OpenCode ecosystem. |
| Required Fields | `baseURL` | URL of the pet service API. |
| Default | `http://localhost:3000` | Sensible local default. |

## Project Structure

```
opencode-pets/
├── .opencode/
│   └── plugins/
│       └── opencode-pets.ts       # Plugin entry point
├── specs/                         # Specification documents
├── logs/                          # Development and test logs
├── package.json                   # Root package (npm publishing)
└── opencode.json                  # OpenCode project config
```

Note: `.opencode/package.json` is NOT required because the plugin has no external runtime dependencies.

## TypeScript Configuration

The plugin is loaded directly by Bun as a `.ts` file. No separate `tsconfig.json` is required for the plugin itself, but one is recommended for IDE support.

## Dependencies

### Runtime (0)

None. The plugin uses only:
- Bun built-in `fetch`
- OpenCode plugin context (`client`, `$`)

### Development

| Package | Purpose |
|---------|---------|
| `@opencode-ai/plugin` | TypeScript type definitions for plugin development |
| `typescript` | TypeScript compiler (dev only) |
| `@types/bun` | Bun type definitions (dev only) |

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|----------------|
| `axios` / `got` | Adds dependency. Bun `fetch` is sufficient for simple HTTP calls. |
| JavaScript (no types) | Violates constitution principle of type safety. |
| Separate config file (`.petsrc`) | Unnecessary. `opencode.json` is the standard config source. |
| WebSocket connection | Over-engineering. Simple HTTP GET per state change is sufficient. |
| State management library | Over-engineering. Simple variable tracking current state is enough. |
