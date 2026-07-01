import type { Plugin } from "@opencode-ai/plugin"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration read from opencode.json → pets key */
interface PetsConfig {
  baseURL: string
}

/** Valid pet states that map to API endpoints */
type PetState = "thinking" | "idle" | "sleeping" | "reading" | "writing" | "runing" | "working"

// ---------------------------------------------------------------------------
// Event → State Mappings
// ---------------------------------------------------------------------------

/** Map OpenCode tool names to pet states */
const TOOL_STATE_MAP: Record<string, PetState> = {
  read: "reading",
  glob: "reading",
  grep: "reading",
  edit: "writing",
  write: "writing",
  bash: "runing",
}

/** Map OpenCode session event types to pet states */
const SESSION_STATE_MAP: Record<string, PetState> = {
  "session.created": "thinking",
  "session.idle": "idle",
  "session.error": "sleeping",
}

// ---------------------------------------------------------------------------
// Config Reader
// ---------------------------------------------------------------------------

/**
 * Read pets configuration from opencode.json in the project directory.
 * Returns null if no valid config is found — the plugin operates in disabled mode.
 */
async function readConfig(directory: string): Promise<PetsConfig | null> {
  const configPath = `${directory}/opencode.json`
  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) return null

    const content = await file.json()
    const baseURL: unknown = content?.pets?.baseURL

    if (!baseURL || typeof baseURL !== "string" || baseURL.trim().length === 0) {
      return null
    }

    return { baseURL: baseURL.trim() }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Plugin Entry Point
// ---------------------------------------------------------------------------

export const OpenCodePetsPlugin: Plugin = async ({ client, directory }) => {
  // ── Read configuration ──────────────────────────────────────────────
  const config = await readConfig(directory)

  if (!config) {
    await client.app.log({
      body: {
        service: "opencode-pets",
        level: "warn",
        message:
          "opencode-pets: No valid pets.baseURL configured in opencode.json. Plugin disabled.",
      },
    } as any)
    // Return empty hooks object — plugin is effectively disabled
    return {}
  }

  await client.app.log({
    body: {
      service: "opencode-pets",
      level: "info",
      message: "opencode-pets initialized",
      extra: { baseURL: config.baseURL },
    },
  } as any)

  // ── State tracking (deduplication) ──────────────────────────────────
  const baseURL = config.baseURL
  let currentState: PetState | "" = ""

  async function notify(state: PetState): Promise<void> {
    const normalizedBase = baseURL.replace(/\/+$/, "")
    const url = `${normalizedBase}/${state}`

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
      })
      clearTimeout(timeout)

      await client.app.log({
        body: {
          service: "opencode-pets",
          level: "debug",
          message: `Notified pet service: ${state}`,
          extra: { url, status: response.status },
        },
      } as any)
    } catch (err) {
      await client.app.log({
        body: {
          service: "opencode-pets",
          level: "error",
          message: `Failed to notify pet service: ${state}`,
          extra: { url, error: String(err) },
        },
      } as any)
    }
  }

  async function transitionTo(newState: PetState): Promise<void> {
    if (newState === currentState) return // dedup consecutive identical states

    const prevState = currentState
    currentState = newState

    await client.app.log({
      body: {
        service: "opencode-pets",
        level: "debug",
        message: `State: ${prevState || "none"} → ${newState}`,
        extra: { from: prevState || null, to: newState },
      },
    } as any)

    await notify(newState)
  }

  // ── Hooks ───────────────────────────────────────────────────────────

  return {
    /**
     * Session-level events: created → thinking, idle → idle, error → sleeping.
     */
    event: async ({ event }) => {
      const state = SESSION_STATE_MAP[event.type]
      if (state) {
        await transitionTo(state)
      }
    },

    /**
     * Before a tool executes: map tool name to pet state.
     */
    "tool.execute.before": async (input) => {
      const state: PetState = TOOL_STATE_MAP[input.tool] ?? "working"
      await transitionTo(state)
    },

    /**
     * After a tool completes: back to thinking (AI is generating next response).
     */
    "tool.execute.after": async () => {
      await transitionTo("thinking")
    },
  }
}
