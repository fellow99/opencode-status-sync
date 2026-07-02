# Quickstart: opencode-status-sync

## Installation

### 1. Place Plugin File

Copy to your OpenCode project:
```bash
cp .opencode/plugins/opencode-status-sync.ts <your-project>/.opencode/plugins/
```

Or install globally:
```bash
cp .opencode/plugins/opencode-status-sync.ts ~/.config/opencode/plugins/
```

### 2. Create Configuration

Create `opencode-status-sync.json` in your project root:

```json
{
  "debug": true,
  "baseURL": "http://192.168.137.197",
  "headers": {},
  "mapping": [
    { "status": "idle",     "url": "/idle",     "body": "" },
    { "status": "error",    "url": "/error",    "body": "" },
    { "status": "thinking", "url": "/thinking", "body": "" },
    { "status": "reading",  "url": "/reading",  "body": "" },
    { "status": "writing",  "url": "/writing",  "body": "" },
    { "status": "working",  "url": "/working",  "body": "" }
  ]
}
```

### 3. Restart OpenCode

The plugin loads automatically at startup. Debug logs appear in the console if `"debug": true`.

## Configuration Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `debug` | boolean | No | `false` | Enable console debug output |
| `baseURL` | string | Yes | — | Base URL of status service |
| `headers` | object | No | `{}` | HTTP headers for all requests |
| `mapping` | array | Yes | — | Status-to-endpoint mappings |
| `mapping[].status` | string | Yes | — | Logical status name |
| `mapping[].url` | string | Yes | — | Relative endpoint path |
| `mapping[].body` | string | No | `""` | Request body content |

## Status Names

Built-in statuses (auto-detected by the plugin):
- `thinking` — AI is generating a response
- `idle` — AI is waiting for user input
- `error` — AI encountered an error
- `reading` — AI is reading files
- `writing` — AI is writing/editing files
- `working` — AI is running commands or using other tools

Custom statuses can be added by including additional mapping entries.

## How Statuses Are Detected

| OpenCode Behavior | Detected Via | Maps To |
|-------------------|-------------|---------|
| Session created / message received | `event` hook | `thinking` |
| Session idle | `event` hook | `idle` |
| Session error | `event` hook | `error` |
| Tool: read, glob, grep | `tool.execute.before` | `reading` |
| Tool: edit, write | `tool.execute.before` | `writing` |
| Tool: bash and others | `tool.execute.before` | `working` |
| Tool completed (no error) | `tool.execute.after` | `thinking` |

## Development

```bash
# Install dev dependencies
bun install

# Type check
bun x tsc --noEmit
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Plugin not loading | Verify file is in `.opencode/plugins/` |
| No API calls | Check `opencode-status-sync.json` has valid `baseURL` and `mapping` |
| Service unreachable | Plugin degrades gracefully — check service is running at `baseURL` |
| Debug logs missing | Set `"debug": true` in config |
