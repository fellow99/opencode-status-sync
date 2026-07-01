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

/** Log levels used by the plugin */
type LogLevel = "debug" | "info" | "warn" | "error"

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
async function readConfig(
  directory: string,
  log: (level: LogLevel, message: string, extra?: Record<string, unknown>) => Promise<void>,
): Promise<PetsConfig | null> {
  const configPath = `${directory}/opencode.json`
  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) {
      await log("debug", "opencode.json not found")
      return null
    }

    const content = await file.json()
    const baseURL: unknown = content?.pets?.baseURL

    if (!baseURL || typeof baseURL !== "string" || baseURL.trim().length === 0) {
      await log("debug", "pets.baseURL missing or empty in opencode.json")
      return null
    }

    return { baseURL: baseURL.trim() }
  } catch (err) {
    await log("warn", `Failed to parse ${configPath}: ${String(err)}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Plugin Entry Point
// ---------------------------------------------------------------------------

export const OpenCodePetsPlugin: Plugin = async ({ client, directory }) => {
  // ── Logging helper ──────────────────────────────────────────────────
  async function log(
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    await client.app.log({ body: { service: "opencode-pets", level, message, extra } } as any)
  }

  // ── Read configuration ──────────────────────────────────────────────
  const config = await readConfig(directory, log)

  if (!config) {
    await log("warn", "No valid pets.baseURL configured. Plugin disabled.")
    return {}
  }

  await log("info", "opencode-pets initialized", { baseURL: config.baseURL })

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

      if (response.ok) {
        await log("debug", `Notified pet service: ${state}`, { url, status: response.status })
      } else {
        await log("warn", `Pet service returned non-OK status: ${state}`, {
          url,
          status: response.status,
        })
      }
    } catch (err) {
      await log("error", `Failed to notify pet service: ${state}`, {
        url,
        error: String(err),
      })
    }
  }

  async function transitionTo(newState: PetState): Promise<void> {
    if (newState === currentState) return // dedup consecutive identical states

    const prevState = currentState
    currentState = newState

    await log("debug", `State: ${prevState || "none"} → ${newState}`, {
      from: prevState || null,
      to: newState,
    })

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
     * After a tool completes: back to thinking, unless in terminal error state.
     * Guard against overriding "sleeping" set by session.error.
     */
    "tool.execute.after": async () => {
      if (currentState !== "sleeping") {
        await transitionTo("thinking")
      }
    },
  }
}
