# opencode-pets

OpenCode plugin that sends AI agent status updates to a pet visualization service.

When OpenCode is thinking, reading files, writing code, running commands, or idling — your pet shows it! 🐱

## How It Works

The plugin hooks into OpenCode's event system and sends HTTP POST requests to a pet service API whenever the AI's state changes:

| OpenCode Activity | Pet State | API Endpoint |
|-------------------|-----------|-------------|
| Starting to think | Thinking | `/thinking` |
| Reading files | Reading | `/reading` |
| Writing/editing code | Writing | `/writing` |
| Running commands | Runing | `/runing` |
| Using other tools | Working | `/working` |
| Finished, waiting | Idle | `/idle` |
| Error occurred | Sleeping | `/sleeping` |

## Installation

### As a local plugin

1. Copy `.opencode/plugins/opencode-pets.ts` to your project's `.opencode/plugins/` directory:
   ```
   <your-project>/.opencode/plugins/opencode-pets.ts
   ```
   
   Or globally:
   ```
   ~/.config/opencode/plugins/opencode-pets.ts
   ```

2. Create an `opencode-pets.json` config file in your project's root directory:
   ```json
   {
     "baseURL": "http://192.168.137.197"
   }
   ```

3. Restart OpenCode. The plugin loads automatically.

## Configuration

The plugin reads its configuration from `opencode-pets.json` in the project root.

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `baseURL` | Yes | — | Base URL of the pet service API |

If `opencode-pets.json` is missing or `baseURL` is invalid, the plugin logs a warning and disables itself. OpenCode continues to work normally.

## Pet Service API

The plugin expects a pet service running at the configured `baseURL` with these endpoints:

- `POST /thinking` — Pet enters thinking state
- `POST /idle` — Pet enters idle state
- `POST /working` — Pet enters working state
- `POST /reading` — Pet enters reading state
- `POST /writing` — Pet enters writing state
- `POST /runing` — Pet enters running state
- `POST /sleeping` — Pet enters sleeping state

All endpoints accept POST requests (body is optional). No authentication required.

## Development

```bash
# Install dev dependencies (for type checking)
bun install

# Type check
bun x tsc --noEmit
```

## License

MIT
