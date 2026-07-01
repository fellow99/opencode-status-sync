import type { Plugin } from "@opencode-ai/plugin"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration read from opencode-pets.json */
interface PetsConfig {
  baseURL: string
  debug: boolean
}

/** Valid pet states that map to API endpoints */
type PetState = "thinking" | "idle" | "error" | "reading" | "writing" | "working"

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
}

/** Map OpenCode session event types to pet states */
const SESSION_STATE_MAP: Record<string, PetState> = {
  "session.created": "thinking",
  "session.idle": "idle",
  "session.error": "error",
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

    const debug = content?.debug === true
    return { baseURL: baseURL.trim(), debug }
  } catch (err) {
    await log("warn", `Failed to parse ${configPath}: ${String(err)}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Plugin Entry Point
// ---------------------------------------------------------------------------

export const OpenCodePetsPlugin: Plugin = async ({ client, directory }) => {
  // ── Debug logging (captured via let to avoid TDZ with const destructuring) ─
  let debugEnabled = false
  function dlog(...args: unknown[]): void {
    if (debugEnabled) console.info(...args)
  }

  dlog("[🐱 pets] ──────────────────────────────────")
  dlog(`[🐱 pets] 🚀 Plugin loading...`)
  dlog(`[🐱 pets] 📂 Project dir: ${directory}`)

  // ── Logging helper ──────────────────────────────────────────────────
  async function log(
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    await client.app.log({ body: { service: "opencode-pets", level, message, extra } } as any)
  }

  // ── Read configuration ──────────────────────────────────────────────
  const configPath = `${directory}/opencode-pets.json`
  dlog(`[🐱 pets] 📋 Reading config: ${configPath}`)

  const config = await readConfig(directory, log)

  if (!config) {
    console.warn(`[🐱 pets] ⚠️  opencode-pets.json not found or baseURL missing`)
    console.warn(`[🐱 pets] ⚠️  Plugin disabled — add {"baseURL":"http://..."} to ${configPath}`)
    console.warn("[🐱 pets] ──────────────────────────────────")
    await log("warn", "No valid baseURL in opencode-pets.json. Plugin disabled.")
    return {}
  }

  dlog(`[🐱 pets] ✅ Config loaded: baseURL = ${config.baseURL}`)
  dlog(`[🐱 pets] 🌐 Pet service endpoints:`)
  const allStates: PetState[] = ["thinking", "idle", "error", "reading", "writing", "working"]
  for (const s of allStates) {
    dlog(`[🐱 pets]    ${config.baseURL}/${s}`)
  }

  await log("info", "opencode-pets initialized", { baseURL: config.baseURL })

  // ── State tracking ──────────────────────────────────────────────────
  const { baseURL } = config
  debugEnabled = config.debug
  const DEBOUNCE_MS = 1000
  const IMMEDIATE_STATES: ReadonlySet<PetState> = new Set(["idle", "error"])

  let currentState: PetState | "" = ""
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pendingDebounceState: PetState | null = null

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
        dlog(`[🐱 pets] 📡 GET ${url} → ${response.status} OK`)
        await log("debug", `Notified pet service: ${state}`, { url, status: response.status })
      } else {
        dlog(`[🐱 pets] ⚠️  GET ${url} → ${response.status}`)
        await log("warn", `Pet service returned non-OK status: ${state}`, {
          url,
          status: response.status,
        })
      }
    } catch (err) {
      dlog(`[🐱 pets] ❌ GET ${url} → ${String(err)}`)
      await log("error", `Failed to notify pet service: ${state}`, {
        url,
        error: String(err),
      })
    }
  }

  function flushDebounce(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
      pendingDebounceState = null
    }
  }

  async function transitionTo(newState: PetState): Promise<void> {
    if (newState === currentState || newState === pendingDebounceState) {
      dlog(`[🐱 pets] ⏭️  ${newState} (dup, skipped)`)
      return
    }

    if (IMMEDIATE_STATES.has(newState)) {
      flushDebounce()
      const prevState = currentState
      currentState = newState
      dlog(`[🐱 pets] 🔄 ${prevState || "none"} → ${newState} (immediate)`)
      await log("debug", `State: ${prevState || "none"} → ${newState}`, {
        from: prevState || null,
        to: newState,
      })
      await notify(newState)
      return
    }

    pendingDebounceState = newState
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      const target = pendingDebounceState
      pendingDebounceState = null
      if (target === null || target === currentState) return

      const prevState = currentState
      currentState = target
      dlog(`[🐱 pets] 🔄 ${prevState || "none"} → ${target} (debounced ${DEBOUNCE_MS}ms)`)
      await log("debug", `State: ${prevState || "none"} → ${target}`, {
        from: prevState || null,
        to: target,
      })
      await notify(target)
    }, DEBOUNCE_MS)
  }

  // ── Hooks ───────────────────────────────────────────────────────────

  return {
    /**
     * Session-level events: created → thinking, idle → idle, error → error.
     */
    event: async ({ event }) => {
      const state = SESSION_STATE_MAP[event.type]
      if (state) {
        dlog(`[🐱 pets] 📨 event: ${event.type}`)
        await transitionTo(state)
      }
    },

    /**
     * Before a tool executes: map tool name to pet state.
     */
    "tool.execute.before": async (input) => {
      const state: PetState = TOOL_STATE_MAP[input.tool] ?? "working"
      dlog(`[🐱 pets] 🔧 tool: ${input.tool}`)
      await transitionTo(state)
    },

    /**
     * After a tool completes: back to thinking, unless in terminal error state.
     */
    "tool.execute.after": async () => {
      if (currentState !== "error") {
        dlog(`[🐱 pets] ✅ tool done → thinking`)
        await transitionTo("thinking")
      } else {
        dlog(`[🐱 pets] ⏸️  tool done but error (guarded)`)
      }
    },
  }

  // ── Hooks registered ────────────────────────────────────────────────
  dlog("[🐱 pets] 🎧 Hooks registered: event, tool.execute.before, tool.execute.after")
  dlog("[🐱 pets] ✅ Plugin ready — watching for OpenCode events...")
  dlog("[🐱 pets] ──────────────────────────────────")
}
