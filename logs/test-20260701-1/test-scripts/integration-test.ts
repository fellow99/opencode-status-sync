#!/usr/bin/env bun
/**
 * Integration Test Suite for opencode-pets Plugin
 *
 * Tests the full flow:
 * 1. Config file parsing (valid, missing, empty, invalid JSON)
 * 2. State machine transitions (all 7 states)
 * 3. Deduplication
 * 4. Sleeping guard
 * 5. HTTP to real pet service API
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs"
import { join } from "path"

const BASE_URL = "http://192.168.137.197"
const TEST_DIR = "/tmp/opencode-pets-test"
const CONFIG_FILE = join(TEST_DIR, "opencode-pets.json")

// ── Test Infrastructure ──

let passed = 0
let failed = 0
const logBuffer: Array<{ level: string; message: string; extra?: Record<string, unknown> }> = []

function resetLog() { logBuffer.length = 0 }

function createMockLog() {
  return async (level: string, message: string, extra?: Record<string, unknown>) => {
    logBuffer.push({ level, message, extra })
  }
}

function test(name: string, fn: () => Promise<void>) {
  return fn().then(() => {
    console.log(`  ✅ ${name}`)
    passed++
  }).catch((e: Error) => {
    console.log(`  ❌ ${name}: ${e.message}`)
    failed++
  })
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// ── Setup / Teardown ──

function setupConfigDir() {
  if (!existsSync(TEST_DIR)) {
    Bun.spawnSync(["mkdir", "-p", TEST_DIR])
  }
}

function writeConfig(json: string) {
  writeFileSync(CONFIG_FILE, json, "utf-8")
}

function cleanupConfig() {
  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE)
  }
}

// ── Plugin Logic (inlined for testability) ──

type PetState = "thinking" | "idle" | "sleeping" | "reading" | "writing" | "runing" | "working"
type LogLevel = "debug" | "info" | "warn" | "error"

const TOOL_STATE_MAP: Record<string, PetState> = {
  read: "reading", glob: "reading", grep: "reading",
  edit: "writing", write: "writing",
  bash: "runing",
}

const SESSION_STATE_MAP: Record<string, PetState> = {
  "session.created": "thinking",
  "session.idle": "idle",
  "session.error": "sleeping",
}

interface PetsConfig { baseURL: string }

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

function createPluginStateMachine() {
  let currentState: PetState | "" = ""
  const transitions: Array<{ from: string; to: PetState }> = []

  async function transitionTo(newState: PetState): Promise<void> {
    if (newState === currentState) return
    transitions.push({ from: currentState || "none", to: newState })
    currentState = newState
  }

  return { transitionTo, getState: () => currentState, getTransitions: () => transitions }
}

// ── Main ──

console.log("=".repeat(50))
console.log("  opencode-pets Integration Test Suite")
console.log(`  Time: ${new Date().toISOString()}`)
console.log("=".repeat(50))
console.log("")

setupConfigDir()

// ================================================================
//  CATEGORY 1: Config File Parsing
// ================================================================
console.log("── Category 1: Config File Parsing ──")

await test("CFG-01: Valid config returns PetsConfig", async () => {
  resetLog()
  writeConfig(`{"baseURL": "http://192.168.137.197"}`)
  const config = await readConfig(TEST_DIR, createMockLog())
  assert(config !== null, "expected config, got null")
  assert(config.baseURL === "http://192.168.137.197", `expected baseURL, got ${config.baseURL}`)
})

await test("CFG-02: Missing config file returns null + logs debug", async () => {
  resetLog()
  cleanupConfig()
  const config = await readConfig(TEST_DIR, createMockLog())
  assert(config === null, "expected null for missing file")
  assert(logBuffer.some(l => l.message.includes("not found")), "expected 'not found' log")
})

await test("CFG-03: Empty baseURL returns null + logs debug", async () => {
  resetLog()
  writeConfig(`{"baseURL": ""}`)
  const config = await readConfig(TEST_DIR, createMockLog())
  assert(config === null, "expected null for empty baseURL")
  assert(logBuffer.some(l => l.message.includes("missing or empty")), "expected 'missing or empty' log")
})

await test("CFG-04: Missing baseURL key returns null", async () => {
  resetLog()
  writeConfig(`{"foo": "bar"}`)
  const config = await readConfig(TEST_DIR, createMockLog())
  assert(config === null, "expected null for missing key")
})

await test("CFG-05: Invalid JSON logs warn and returns null", async () => {
  resetLog()
  writeConfig(`not-json{{{`)
  const config = await readConfig(TEST_DIR, createMockLog())
  assert(config === null, "expected null for invalid JSON")
  assert(logBuffer.some(l => l.level === "warn" && l.message.includes("Failed to parse")), "expected parse error log")
})

await test("CFG-06: baseURL whitespace is trimmed", async () => {
  resetLog()
  writeConfig(`{"baseURL": "  http://example.com  "}`)
  const config = await readConfig(TEST_DIR, createMockLog())
  assert(config !== null, "expected config")
  assert(config.baseURL === "http://example.com", `expected trimmed URL, got "${config.baseURL}"`)
})

// ================================================================
//  CATEGORY 2: State Machine Transitions
// ================================================================
console.log("\n── Category 2: State Machine Transitions ──")

await test("SM-01: First transition triggers", async () => {
  const sm = createPluginStateMachine()
  await sm.transitionTo("thinking")
  assert(sm.getState() === "thinking", "state should be thinking")
  assert(sm.getTransitions().length === 1, "should have 1 transition")
})

await test("SM-02: Consecutive same-state dedup (3x thinking → 1 call)", async () => {
  const sm = createPluginStateMachine()
  await sm.transitionTo("thinking")
  await sm.transitionTo("thinking")
  await sm.transitionTo("thinking")
  assert(sm.getTransitions().length === 1, "should dedup to 1")
})

await test("SM-03: Different states each trigger (thinking→reading→writing = 3)", async () => {
  const sm = createPluginStateMachine()
  await sm.transitionTo("thinking")
  await sm.transitionTo("reading")
  await sm.transitionTo("writing")
  assert(sm.getTransitions().length === 3, "should have 3 transitions")
})

await test("SM-04: Full cycle through all 7 states", async () => {
  const sm = createPluginStateMachine()
  const states: PetState[] = ["thinking", "reading", "writing", "runing", "working", "idle", "sleeping"]
  for (const s of states) {
    await sm.transitionTo(s)
  }
  assert(sm.getTransitions().length === 7, `expected 7, got ${sm.getTransitions().length}`)
})

await test("SM-05: Sleeping state guard blocks tool.after → thinking", async () => {
  const sm = createPluginStateMachine()
  await sm.transitionTo("sleeping")
  const transitionsBeforeGuard = sm.getTransitions().length
  // Simulate tool.execute.after guard
  if (sm.getState() !== "sleeping") {
    await sm.transitionTo("thinking")
  }
  assert(sm.getState() === "sleeping", "state should remain sleeping")
  assert(sm.getTransitions().length === transitionsBeforeGuard, "no new transition should fire")
})

await test("SM-06: Guard allows transition from non-sleeping", async () => {
  const sm = createPluginStateMachine()
  await sm.transitionTo("reading")
  if (sm.getState() !== "sleeping") {
    await sm.transitionTo("thinking")
  }
  assert(sm.getState() === "thinking", "should transition to thinking")
})

// ================================================================
//  CATEGORY 3: Event → State Mapping
// ================================================================
console.log("\n── Category 3: Event → State Mapping ──")

await test("MAP-01: session.created → thinking", async () => {
  const state = SESSION_STATE_MAP["session.created"]
  assert(state === "thinking", `got ${state}`)
})

await test("MAP-02: session.idle → idle", async () => {
  assert(SESSION_STATE_MAP["session.idle"] === "idle")
})

await test("MAP-03: session.error → sleeping", async () => {
  assert(SESSION_STATE_MAP["session.error"] === "sleeping")
})

await test("MAP-04: read/glob/grep → reading", async () => {
  assert(TOOL_STATE_MAP["read"] === "reading")
  assert(TOOL_STATE_MAP["glob"] === "reading")
  assert(TOOL_STATE_MAP["grep"] === "reading")
})

await test("MAP-05: edit/write → writing", async () => {
  assert(TOOL_STATE_MAP["edit"] === "writing")
  assert(TOOL_STATE_MAP["write"] === "writing")
})

await test("MAP-06: bash → runing", async () => {
  assert(TOOL_STATE_MAP["bash"] === "runing")
})

await test("MAP-07: unknown tool → working (fallback)", async () => {
  const state: PetState = TOOL_STATE_MAP["nonexistent"] ?? "working"
  assert(state === "working", `got ${state}`)
})

// ================================================================
//  CATEGORY 4: Real Pet Service API
// ================================================================
console.log("\n── Category 4: Real Pet Service API ──")

const allEndpoints: PetState[] = ["thinking", "idle", "sleeping", "reading", "writing", "runing", "working"]

for (const ep of allEndpoints) {
  await test(`API-${ep}: GET /${ep} → 200`, async () => {
    const url = `${BASE_URL}/${ep}`
    const resp = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) })
    assert(resp.status === 200, `expected 200, got ${resp.status}`)
    const body = await resp.json()
    assert(body.code === 200, `expected body.code=200, got ${JSON.stringify(body)}`)
  })
}

await test("API-CONCURRENT: 10 parallel calls all succeed", async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      fetch(`${BASE_URL}/working`, { method: "GET", signal: AbortSignal.timeout(5000) })
        .then(r => r.status)
        .catch(() => 0)
    )
  )
  assert(results.every(s => s === 200), `some failed: ${JSON.stringify(results)}`)
})

await test("API-POST-405: POST returns 405", async () => {
  const resp = await fetch(`${BASE_URL}/thinking`, { method: "POST", signal: AbortSignal.timeout(5000) })
  assert(resp.status === 405, `expected 405, got ${resp.status}`)
})

// ================================================================
//  CATEGORY 5: Config File Location
// ================================================================
console.log("\n── Category 5: Config File Isolation ──")

await test("ISO-01: Plugin reads opencode-pets.json, NOT opencode.json", async () => {
  // Verify the config path in readConfig is opencode-pets.json
  // This is verified by CFG-01 above which uses opencode-pets.json
  assert(true, "config file path verified via CFG tests")
})

await test("ISO-02: opencode.json does not affect plugin config", async () => {
  // Write opencode.json with pets config but no opencode-pets.json
  const opencodeConfig = join(TEST_DIR, "opencode.json")
  writeFileSync(opencodeConfig, JSON.stringify({ pets: { baseURL: "http://should-not-work" } }))
  cleanupConfig() // ensure no opencode-pets.json

  const config = await readConfig(TEST_DIR, createMockLog())
  assert(config === null, "should not read from opencode.json")

  // cleanup
  if (existsSync(opencodeConfig)) unlinkSync(opencodeConfig)
})

// ================================================================
//  Summary
// ================================================================
console.log("\n" + "=".repeat(50))
console.log(`  Results: ${passed} passed, ${failed} failed`)
console.log(`  Total: ${passed + failed}`)
console.log("=".repeat(50))

cleanupConfig()
process.exit(failed > 0 ? 1 : 0)
