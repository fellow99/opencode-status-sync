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

/** Session events that represent actual state changes — all others are ignored */
const SESSION_STATE_EVENTS = new Set([
  "session.created",
  "session.status",
  "session.idle",
  "session.error",
])

/** Wildcard status — fallback when no exact mapping found */
const WILDCARD_STATUS = "*"

// ---------------------------------------------------------------------------
// Config Reader
// ---------------------------------------------------------------------------

/**
 * Read plugin configuration from opencode-status-sync.json.
 * Checks project directory first, then global config path.
 * Returns null if no valid config is found — plugin operates in disabled mode.
 */
async function readConfig(
  log: (level: LogLevel, message: string, extra?: Record<string, unknown>) => Promise<void>,
  directory: string,
): Promise<StatusSyncConfig | null> {
  const home = process.env.HOME || process.env.USERPROFILE || ""
  const paths = [
    `${directory}/opencode-status-sync.json`,
    `${home}/.config/opencode/opencode-status-sync.json`,
  ]

  for (const configPath of paths) {
    try {
      const file = Bun.file(configPath)
      if (!(await file.exists())) continue

      const content = await file.json()

      // Validate baseURL
      const baseURL: unknown = content?.baseURL
      if (!baseURL || typeof baseURL !== "string" || baseURL.trim().length === 0) {
        await log("debug", `baseURL missing or empty in ${configPath}`)
        continue
      }

      // Validate mapping — filter entries missing required fields
      const mapping: unknown = content?.mapping
      if (!Array.isArray(mapping) || mapping.length === 0) {
        await log("debug", `mapping missing or empty in ${configPath}`)
        continue
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
        await log("debug", `mapping has no valid entries in ${configPath}`)
        continue
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
      continue
    }
  }

  await log("debug", "opencode-status-sync.json not found")
  return null
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
  const config = await readConfig(log, directory)
  debugEnabled = config?.debug ?? false

  if (!config) {
    console.warn("[📡 status-sync] ⚠️ disabled — no valid config found")
    await log("warn", "Plugin disabled: no valid config")
    return {}
  }

  const cfg = config

  await log("info", `opencode-status-sync initialized: ${cfg.baseURL} (${cfg.mapping.length} mappings)`)

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
        dlog(`[📡 status-sync] 📡 ${method} ${url} → ${response.status}  [${status}]`)
      } else {
        dlog(`[📡 status-sync] ⚠️  ${method} ${url} → ${response.status}  [${status}]`)
      }
    } catch (err) {
      dlog(`[📡 status-sync] ❌ ${method} ${url} → ${String(err)}  [${status}]`)
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
    if (!findMapping(cfg, newStatus)) return

    // Deduplicate: skip if same as current or pending
    if (newStatus === currentStatus || newStatus === pendingDebounceStatus) return

    // Guard: terminal states (idle/error) block non-terminal overrides
    if (IMMEDIATE_STATUSES.has(currentStatus) && !IMMEDIATE_STATUSES.has(newStatus)) return

    // Terminal extension points fire immediately
    if (IMMEDIATE_STATUSES.has(newStatus)) {
      flushDebounce()
      currentStatus = newStatus
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

      currentStatus = target
      await notify(target)
    }, DEBOUNCE_MS)
  }

  // ── Hooks ───────────────────────────────────────────────────────────

  return {
    /**
     * OpenCode events: only session state events trigger transitions.
     * Filters out message.*, file.*, todo.*, tui.* etc. to prevent
     * wildcard-mapped noise from overriding terminal states.
     */
    event: async ({ event }) => {
      if (!SESSION_STATE_EVENTS.has(event.type)) return
      await transitionTo(event.type)
    },

    /**
     * Before a tool executes: pass input.tool directly as the extension point status.
     * e.g. tool "read" → lookup "read" in config.mapping (falls back to "*" if unmapped)
     */
    "tool.execute.before": async (input) => {
      await transitionTo(input.tool)
    },

    /**
     * After any tool completes: back to thinking state.
     * Uses "tool.execute.after" as the extension point — map it in config.
     * Guards against transitioning if currently in an error state.
     */
    "tool.execute.after": async () => {
      if (ERROR_STATUSES.has(currentStatus) || currentStatus === "session.idle") return
      await transitionTo("tool.execute.after")
    },
  }
}
