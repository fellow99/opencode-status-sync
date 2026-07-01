import type { Plugin } from "@opencode-ai/plugin"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration read from opencode-pets.json */
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
 * Read pets configuration from opencode-pets.json in the project directory.
 * Returns null if no valid config is found — the plugin operates in disabled mode.
 */
async function readConfig(
  directory: string,
  log: (level: LogLevel, message: string, extra?: Record<string, unknown>) => Promise<void>,
): Promise<PetsConfig | null> {
  const configPath = `${directory}/opencode-pets.json`
  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) {
      await log("debug", "opencode-pets.json not found")
      return null
    }

    const content = await file.json()
    const baseURL: unknown = content?.baseURL

    if (!baseURL || typeof baseURL !== "string" || baseURL.trim().length === 0) {
      await log("debug", "baseURL missing or empty in opencode-pets.json")
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
    console.log("[🐱 pets] ⚠️  No valid baseURL in opencode-pets.json. Plugin disabled.")
    await log("warn", "No valid baseURL in opencode-pets.json. Plugin disabled.")
    return {}
  }

  console.log(`[🐱 pets] ✅ Initialized — baseURL: ${config.baseURL}`)
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
        method: "GET",
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok) {
        console.log(`[🐱 pets] 📡 GET ${url} → ${response.status} OK`)
        await log("debug", `Notified pet service: ${state}`, { url, status: response.status })
      } else {
        console.log(`[🐱 pets] ⚠️  GET ${url} → ${response.status}`)
        await log("warn", `Pet service returned non-OK status: ${state}`, {
          url,
          status: response.status,
        })
      }
    } catch (err) {
      console.log(`[🐱 pets] ❌ GET ${url} → ${String(err)}`)
      await log("error", `Failed to notify pet service: ${state}`, {
        url,
        error: String(err),
      })
    }
  }

  async function transitionTo(newState: PetState): Promise<void> {
    if (newState === currentState) {
      console.log(`[🐱 pets] ⏭️  ${newState} (dup, skipped)`)
      return // dedup consecutive identical states
    }

    const prevState = currentState
    currentState = newState

    console.log(`[🐱 pets] 🔄 ${prevState || "none"} → ${newState}`)

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
        console.log(`[🐱 pets] 📨 event: ${event.type}`)
        await transitionTo(state)
      }
    },

    /**
     * Before a tool executes: map tool name to pet state.
     */
    "tool.execute.before": async (input) => {
      const state: PetState = TOOL_STATE_MAP[input.tool] ?? "working"
      console.log(`[🐱 pets] 🔧 tool: ${input.tool}`)
      await transitionTo(state)
    },

    /**
     * After a tool completes: back to thinking, unless in terminal error state.
     * Guard against overriding "sleeping" set by session.error.
     */
    "tool.execute.after": async () => {
      if (currentState !== "sleeping") {
        console.log(`[🐱 pets] ✅ tool done → thinking`)
        await transitionTo("thinking")
      } else {
        console.log(`[🐱 pets] ⏸️  tool done but sleeping (guarded)`)
      }
    },
  }
}
