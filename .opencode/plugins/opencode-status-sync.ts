import type { Plugin } from "@opencode-ai/plugin"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single mapping entry: logical status name → API endpoint */
interface MappingEntry {
  status: string
  url: string
  method?: string
  body?: string
}

/** Configuration read from opencode-status-sync.json */
interface StatusSyncConfig {
  debug: boolean
  baseURL: string
  headers: Record<string, string>
  mapping: MappingEntry[]
}

/** Log levels used by the plugin */
type LogLevel = "debug" | "info" | "warn" | "error"

/** Narrowed type for client.app.log input — avoids `as any` */
interface AppLogInput {
  body: {
    service: string
    level: LogLevel
    message: string
    extra?: Record<string, unknown>
  }
}

// ---------------------------------------------------------------------------
// Default mappings — applied when config.mapping is empty for built-in statuses
// ---------------------------------------------------------------------------

/** Tool name → default status (used as fallback, overridable via config) */
const DEFAULT_TOOL_STATUS: Record<string, string> = {
  read: "reading",
  glob: "reading",
  grep: "reading",
  edit: "writing",
  write: "writing",
}

/** Session event type → default status */
const DEFAULT_SESSION_STATUS: Record<string, string> = {
  "session.created": "thinking",
  "session.status": "thinking",
  "session.idle": "idle",
  "session.error": "error",
}

/** Status after any tool completes (unless in error) */
const POST_TOOL_STATUS = "thinking"

// ---------------------------------------------------------------------------
// Config Reader
// ---------------------------------------------------------------------------

/**
 * Read plugin configuration from opencode-status-sync.json.
 * Returns null if no valid config is found — plugin operates in disabled mode.
 */
async function readConfig(
  directory: string,
  log: (level: LogLevel, message: string, extra?: Record<string, unknown>) => Promise<void>,
): Promise<StatusSyncConfig | null> {
  const configPath = `${directory}/opencode-status-sync.json`
  try {
    const file = Bun.file(configPath)
    if (!(await file.exists())) {
      await log("debug", "opencode-status-sync.json not found")
      return null
    }

    const content = await file.json()

    // Validate baseURL
    const baseURL: unknown = content?.baseURL
    if (!baseURL || typeof baseURL !== "string" || baseURL.trim().length === 0) {
      await log("debug", "baseURL missing or empty in opencode-status-sync.json")
      return null
    }

    // Validate mapping — filter entries missing required fields
    const mapping: unknown = content?.mapping
    if (!Array.isArray(mapping) || mapping.length === 0) {
      await log("debug", "mapping missing or empty in opencode-status-sync.json")
      return null
    }

    const validMapping: MappingEntry[] = []
    for (const entry of mapping) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>).status === "string" &&
        (entry as Record<string, unknown>).status !== "" &&
        typeof (entry as Record<string, unknown>).url === "string" &&
        (entry as Record<string, unknown>).url !== ""
      ) {
        validMapping.push(entry as MappingEntry)
      }
    }

    if (validMapping.length === 0) {
      await log("debug", "mapping has no valid entries in opencode-status-sync.json")
      return null
    }

    // Validate headers
    const headers: unknown = content?.headers
    const validHeaders: Record<string, string> = {}
    if (headers && typeof headers === "object" && !Array.isArray(headers)) {
      for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        if (typeof value === "string") {
          validHeaders[key] = value
        }
      }
    }

    const debug = content?.debug === true

    return {
      baseURL: baseURL.trim(),
      debug,
      headers: validHeaders,
      mapping: validMapping,
    }
  } catch (err) {
    await log("warn", `Failed to parse ${configPath}: ${String(err)}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a mapping entry by status name in the config mapping array */
function findMapping(config: StatusSyncConfig, status: string): MappingEntry | undefined {
  return config.mapping.find((m) => m.status === status)
}

/** Determine if a status is a terminal (immediate) status — idle & error fire immediately */
function isImmediateStatus(status: string): boolean {
  return status === "idle" || status === "error"
}

/** Resolve the status name for a given tool name */
function resolveToolStatus(toolName: string): string {
  return DEFAULT_TOOL_STATUS[toolName] ?? "working"
}

/** Resolve the status name for a session event type */
function resolveSessionStatus(eventType: string): string | undefined {
  return DEFAULT_SESSION_STATUS[eventType]
}

// ---------------------------------------------------------------------------
// Plugin Entry Point
// ---------------------------------------------------------------------------

export const OpenCodeStatusSync: Plugin = async ({ client, directory }) => {
  // ── Debug logging ────────────────────────────────────────────────────
  let debugEnabled = false
  function dlog(...args: unknown[]): void {
    if (debugEnabled) console.info(...args)
  }

  // ── Logging helper ──────────────────────────────────────────────────
  async function log(
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    const logInput: AppLogInput = { body: { service: "opencode-status-sync", level, message, extra } }
    await client.app.log(logInput as Parameters<typeof client.app.log>[0])
  }

  // ── Read configuration ──────────────────────────────────────────────
  const configPath = `${directory}/opencode-status-sync.json`
  const config = await readConfig(directory, log)
  debugEnabled = config?.debug ?? false

  dlog("[📡 status-sync] ──────────────────────────────────")
  dlog("[📡 status-sync] 🚀 Plugin loading...")
  dlog(`[📡 status-sync] 📂 Project dir: ${directory}`)
  dlog(`[📡 status-sync] 📋 Reading config: ${configPath}`)

  if (!config) {
    console.warn(`[📡 status-sync] ⚠️  opencode-status-sync.json not found or invalid`)
    console.warn(`[📡 status-sync] ⚠️  Plugin disabled — configure ${configPath} with baseURL and mapping`)
    console.warn("[📡 status-sync] ──────────────────────────────────")
    await log("warn", "No valid config in opencode-status-sync.json. Plugin disabled.")
    return {}
  }

  const cfg = config // narrowed non-null reference after early return

  dlog(`[📡 status-sync] ✅ Config loaded: baseURL = ${cfg.baseURL}`)
  dlog(`[📡 status-sync] 📋 ${cfg.mapping.length} mapping entries:`)
  for (const m of cfg.mapping) {
    dlog(`[📡 status-sync]    ${m.status} → ${cfg.baseURL}${m.url}`)
  }

  await log("info", "opencode-status-sync initialized", {
    baseURL: cfg.baseURL,
    mappingCount: cfg.mapping.length,
  })

  // ── State tracking ──────────────────────────────────────────────────
  const { baseURL, headers: configHeaders } = cfg
  const DEBOUNCE_MS = 1000

  let currentStatus = ""
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pendingDebounceStatus: string | null = null

  // ── HTTP Notifier ───────────────────────────────────────────────────
  async function notify(status: string): Promise<void> {
    const mappingEntry = findMapping(cfg, status)
    if (!mappingEntry) {
      dlog(`[📡 status-sync] ⚠️  No mapping found for status "${status}"`)
      return
    }

    const normalizedBase = baseURL.replace(/\/+$/, "")
    const url = `${normalizedBase}${mappingEntry.url}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const method = mappingEntry.method ?? "GET"

    try {
      const fetchOptions: RequestInit = {
        method,
        signal: controller.signal,
      }

      const headerKeys = Object.keys(configHeaders)
      if (headerKeys.length > 0) {
        const headers = new Headers()
        for (const key of headerKeys) {
          headers.set(key, configHeaders[key]!)
        }
        fetchOptions.headers = headers
      }

      if (mappingEntry.body && mappingEntry.body.length > 0) {
        fetchOptions.body = mappingEntry.body
      }

      const response = await fetch(url, fetchOptions)

      if (response.ok) {
        dlog(`[📡 status-sync] 📡 ${method} ${url} → ${response.status} OK`)
        await log("debug", `Notified status service: ${status}`, { url, status: response.status })
      } else {
        dlog(`[📡 status-sync] ⚠️  ${method} ${url} → ${response.status}`)
        await log("warn", `Status service returned non-OK: ${status}`, {
          url,
          status: response.status,
        })
      }
    } catch (err) {
      dlog(`[📡 status-sync] ❌ ${method} ${url} → ${String(err)}`)
      await log("error", `Failed to notify status service: ${status}`, {
        url,
        error: String(err),
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  // ── State Transition ────────────────────────────────────────────────
  function flushDebounce(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
      pendingDebounceStatus = null
    }
  }

  async function transitionTo(newStatus: string): Promise<void> {
    // Verify this status has a valid mapping
    if (!findMapping(cfg, newStatus)) {
      dlog(`[📡 status-sync] ⏭️  "${newStatus}" (no mapping, skipped)`)
      return
    }

    // Deduplicate: skip if same as current or pending
    if (newStatus === currentStatus || newStatus === pendingDebounceStatus) {
      dlog(`[📡 status-sync] ⏭️  ${newStatus} (dup, skipped)`)
      return
    }

    // Terminal states fire immediately (fire-and-forget to avoid blocking)
    if (isImmediateStatus(newStatus)) {
      flushDebounce()
      const prevStatus = currentStatus
      currentStatus = newStatus
      dlog(`[📡 status-sync] 🔄 ${prevStatus || "none"} → ${newStatus} (immediate)`)
      await log("debug", `State: ${prevStatus || "none"} → ${newStatus}`, {
        from: prevStatus || null,
        to: newStatus,
      })
      notify(newStatus).catch(() => {}) // fire-and-forget; errors logged inside notify
      return
    }

    // Non-terminal states: debounce
    pendingDebounceStatus = newStatus
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      const target = pendingDebounceStatus
      pendingDebounceStatus = null
      if (target === null || target === currentStatus) return

      const prevStatus = currentStatus
      currentStatus = target
      dlog(`[📡 status-sync] 🔄 ${prevStatus || "none"} → ${target} (debounced ${DEBOUNCE_MS}ms)`)
      await log("debug", `State: ${prevStatus || "none"} → ${target}`, {
        from: prevStatus || null,
        to: target,
      })
      await notify(target)
    }, DEBOUNCE_MS)
  }

  // ── Hooks ───────────────────────────────────────────────────────────

  // ── Hooks registered ────────────────────────────────────────────────
  dlog("[📡 status-sync] 🎧 Hooks registered: event, tool.execute.before, tool.execute.after")
  dlog("[📡 status-sync] ✅ Plugin ready — watching for OpenCode events...")
  dlog("[📡 status-sync] ──────────────────────────────────")

  return {
    /**
     * Session-level events via the generic event hook.
     * Maps session.created/session.status → thinking, session.idle → idle, session.error → error.
     */
    event: async ({ event }) => {
      const status = resolveSessionStatus(event.type)
      if (status) {
        dlog(`[📡 status-sync] 📨 event: ${event.type} → ${status}`)
        await transitionTo(status)
      }
    },

    /**
     * Before a tool executes: map tool name to status.
     * read/glob/grep → reading, edit/write → writing, bash/others → working.
     */
    "tool.execute.before": async (input) => {
      const status = resolveToolStatus(input.tool)
      dlog(`[📡 status-sync] 🔧 tool: ${input.tool} → ${status}`)
      await transitionTo(status)
    },

    /**
     * After a tool completes: back to thinking, unless in terminal error state.
     */
    "tool.execute.after": async () => {
      if (currentStatus !== "error") {
        dlog("[📡 status-sync] ✅ tool done → thinking")
        await transitionTo(POST_TOOL_STATUS)
      } else {
        dlog("[📡 status-sync] ⏸️  tool done but error (guarded)")
      }
    },
  }
}
