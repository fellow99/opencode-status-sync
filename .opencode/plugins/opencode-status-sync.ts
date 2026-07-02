import type { Plugin } from "@opencode-ai/plugin"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single mapping entry: OpenCode extension point → API endpoint */
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

/** OpenCode extension points that fire immediately (no debounce) */
const IMMEDIATE_STATUSES = new Set(["session.idle", "session.error"])

/** OpenCode extension points that represent error (guard tool.execute.after) */
const ERROR_STATUSES = new Set(["session.error"])

/** Wildcard status — fallback when no exact mapping found */
const WILDCARD_STATUS = "*"

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

/** Look up a mapping entry by extension point name. Falls back to "*" wildcard. */
function findMapping(config: StatusSyncConfig, status: string): MappingEntry | undefined {
  const exact = config.mapping.find((m) => m.status === status)
  if (exact) return exact
  // Fallback to wildcard for unmapped extension points (e.g. unknown tools → /working)
  return config.mapping.find((m) => m.status === WILDCARD_STATUS)
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

  const cfg = config

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
      dlog(`[📡 status-sync] ⚠️  No mapping found for extension point "${status}"`)
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
    // Verify this status has a valid mapping (exact or wildcard)
    if (!findMapping(cfg, newStatus)) {
      dlog(`[📡 status-sync] ⏭️  "${newStatus}" (no mapping, skipped)`)
      return
    }

    // Deduplicate: skip if same as current or pending
    if (newStatus === currentStatus || newStatus === pendingDebounceStatus) {
      dlog(`[📡 status-sync] ⏭️  ${newStatus} (dup, skipped)`)
      return
    }

    // Terminal extension points fire immediately
    if (IMMEDIATE_STATUSES.has(newStatus)) {
      flushDebounce()
      const prevStatus = currentStatus
      currentStatus = newStatus
      dlog(`[📡 status-sync] 🔄 ${prevStatus || "none"} → ${newStatus} (immediate)`)
      await log("debug", `State: ${prevStatus || "none"} → ${newStatus}`, {
        from: prevStatus || null,
        to: newStatus,
      })
      notify(newStatus).catch(() => {})
      return
    }

    // Non-terminal: debounce
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

  dlog("[📡 status-sync] 🎧 Hooks registered: event, tool.execute.before, tool.execute.after")
  dlog("[📡 status-sync] ✅ Plugin ready — watching for OpenCode events...")
  dlog("[📡 status-sync] ──────────────────────────────────")

  return {
    /**
     * OpenCode events: pass event.type directly as the extension point status.
     * e.g. session.created → lookup "session.created" in config.mapping
     */
    event: async ({ event }) => {
      dlog(`[📡 status-sync] 📨 event: ${event.type}`)
      await transitionTo(event.type)
    },

    /**
     * Before a tool executes: pass input.tool directly as the extension point status.
     * e.g. tool "read" → lookup "read" in config.mapping (falls back to "*" if unmapped)
     */
    "tool.execute.before": async (input) => {
      dlog(`[📡 status-sync] 🔧 tool: ${input.tool}`)
      await transitionTo(input.tool)
    },

    /**
     * After any tool completes: back to thinking state.
     * Uses "tool.execute.after" as the extension point — map it in config.
     * Guards against transitioning if currently in an error state.
     */
    "tool.execute.after": async () => {
      if (!ERROR_STATUSES.has(currentStatus)) {
        dlog(`[📡 status-sync] ✅ tool done → tool.execute.after`)
        await transitionTo("tool.execute.after")
      } else {
        dlog("[📡 status-sync] ⏸️  tool done but error (guarded)")
      }
    },
  }
}
