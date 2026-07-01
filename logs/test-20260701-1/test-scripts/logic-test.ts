#!/usr/bin/env bun
/**
 * Plugin Logic Unit Tests
 * Tests event→state mapping, deduplication, and fallback logic
 * without requiring a running OpenCode instance.
 */

// ── Constants replicated from plugin ──

type PetState = "thinking" | "idle" | "sleeping" | "reading" | "writing" | "runing" | "working"

const TOOL_STATE_MAP: Record<string, PetState> = {
  read: "reading",
  glob: "reading",
  grep: "reading",
  edit: "writing",
  write: "writing",
  bash: "runing",
}

const SESSION_STATE_MAP: Record<string, PetState> = {
  "session.created": "thinking",
  "session.idle": "idle",
  "session.error": "sleeping",
}

// ── Test helpers ──

let passed = 0
let failed = 0

function test(name: string, fn: () => void | Promise<void>) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${e.message}`)
    failed++
  }
}

function assertEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) {
    throw new Error(msg || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

console.log("========================================")
console.log("  opencode-pets Logic Unit Tests")
console.log(`  Time: ${new Date().toISOString()}`)
console.log("========================================\n")

// ── Event → State Mapping ──

console.log("── Session Event → State Mapping ──")
test("session.created → thinking", () => {
  assertEqual(SESSION_STATE_MAP["session.created"], "thinking")
})
test("session.idle → idle", () => {
  assertEqual(SESSION_STATE_MAP["session.idle"], "idle")
})
test("session.error → sleeping", () => {
  assertEqual(SESSION_STATE_MAP["session.error"], "sleeping")
})
test("unknown session event → undefined", () => {
  assertEqual(SESSION_STATE_MAP["session.deleted"], undefined as any)
})

console.log("\n── Tool → State Mapping ──")
test("read → reading", () => assertEqual(TOOL_STATE_MAP["read"], "reading"))
test("glob → reading", () => assertEqual(TOOL_STATE_MAP["glob"], "reading"))
test("grep → reading", () => assertEqual(TOOL_STATE_MAP["grep"], "reading"))
test("edit → writing", () => assertEqual(TOOL_STATE_MAP["edit"], "writing"))
test("write → writing", () => assertEqual(TOOL_STATE_MAP["write"], "writing"))
test("bash → runing", () => assertEqual(TOOL_STATE_MAP["bash"], "runing"))
test("unknown tool → undefined", () => {
  assertEqual(TOOL_STATE_MAP["unknown_tool"], undefined as any)
})

console.log("\n── Unknown Tool Fallback → working ──")
test("unknown tool defaults to working", () => {
  const state: PetState = TOOL_STATE_MAP["some_future_tool"] ?? "working"
  assertEqual(state, "working")
})

// ── Deduplication Logic ──

console.log("\n── State Deduplication ──")

// Simulate the plugin's transitionTo logic
function createStateMachine() {
  let currentState: PetState | "" = ""
  const calls: PetState[] = []

  async function transitionTo(newState: PetState): Promise<void> {
    if (newState === currentState) return
    currentState = newState
    calls.push(newState)
  }

  return { transitionTo, getState: () => currentState, getCalls: () => calls }
}

test("first transition triggers call", async () => {
  const sm = createStateMachine()
  await sm.transitionTo("thinking")
  assertEqual(sm.getCalls().length, 1)
  assertEqual(sm.getCalls()[0], "thinking")
})

test("consecutive same state is deduplicated", async () => {
  const sm = createStateMachine()
  await sm.transitionTo("thinking")
  await sm.transitionTo("thinking")
  await sm.transitionTo("thinking")
  assertEqual(sm.getCalls().length, 1, "should only have 1 call, not 3")
})

test("different states trigger separate calls", async () => {
  const sm = createStateMachine()
  await sm.transitionTo("thinking")
  await sm.transitionTo("reading")
  await sm.transitionTo("writing")
  assertEqual(sm.getCalls().length, 3)
  assertEqual(sm.getCalls()[0], "thinking")
  assertEqual(sm.getCalls()[1], "reading")
  assertEqual(sm.getCalls()[2], "writing")
})

test("back to same state after different → new call", async () => {
  const sm = createStateMachine()
  await sm.transitionTo("thinking")
  await sm.transitionTo("reading")
  await sm.transitionTo("thinking") // back to thinking → should trigger
  assertEqual(sm.getCalls().length, 3)
})

// ── Sleeping guard logic ──

console.log("\n── Sleeping State Guard ──")
test("tool.after does NOT override sleeping", async () => {
  const sm = createStateMachine()
  await sm.transitionTo("sleeping")
  // Simulate tool.execute.after guard
  if (sm.getState() !== "sleeping") {
    await sm.transitionTo("thinking")
  }
  assertEqual(sm.getState(), "sleeping")
  // Only one call: the initial sleeping
  assertEqual(sm.getCalls().length, 1)
})

test("tool.after DOES override non-sleeping states", async () => {
  const sm = createStateMachine()
  await sm.transitionTo("reading")
  if (sm.getState() !== "sleeping") {
    await sm.transitionTo("thinking")
  }
  assertEqual(sm.getState(), "thinking")
  assertEqual(sm.getCalls().length, 2)
  assertEqual(sm.getCalls()[1], "thinking")
})

// ── All PetState values are valid ──

console.log("\n── PetState Values ──")
const allStates: PetState[] = ["thinking", "idle", "sleeping", "reading", "writing", "runing", "working"]
test("all 7 states defined", () => assertEqual(allStates.length, 7))
for (const s of allStates) {
  test(`state "${s}" is valid`, () => {
    assertEqual(typeof s, "string")
  })
}

// ── Summary ──

console.log("\n========================================")
console.log(`  Results: ${passed} passed, ${failed} failed`)
console.log(`  Total: ${passed + failed}`)
console.log("========================================")
process.exit(failed > 0 ? 1 : 0)
