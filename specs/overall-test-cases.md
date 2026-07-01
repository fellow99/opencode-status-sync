# Test Cases: opencode-pets

## Feature ID
`001-opencode-pets-plugin`

## Test Environment

| Component | Version/Tool |
|-----------|-------------|
| OpenCode | Latest (with plugin + ACP support) |
| Test Framework | Manual + ACP-based integration |
| Pet Service Mock | Custom HTTP echo server |
| Log Verification | OpenCode log output |

---

## Category 1: Configuration Tests

### TC-CFG-01: Valid Configuration
- **Description**: Plugin loads successfully with valid `baseURL in opencode-pets.json` in `opencode.json`
- **Precondition**: `opencode.json` contains `{ "pets": { "baseURL": "http://192.168.137.197" } }`
- **Steps**:
  1. Place plugin in `.opencode/plugins/`
  2. Start OpenCode
- **Expected Result**: Plugin initializes, logs "Initialized with baseURL: http://192.168.137.197" at info level
- **Priority**: P0

### TC-CFG-02: Missing Configuration
- **Description**: Plugin loads gracefully when `pets` key is absent from `opencode.json`
- **Precondition**: `opencode.json` does NOT contain a `pets` key
- **Steps**:
  1. Place plugin in `.opencode/plugins/`
  2. Start OpenCode
- **Expected Result**: Plugin logs warning about missing config, operates in disabled mode, no API calls
- **Priority**: P1

### TC-CFG-03: Empty baseURL
- **Description**: Plugin handles empty `baseURL` string
- **Precondition**: `opencode.json` contains `{ "pets": { "baseURL": "" } }`
- **Steps**:
  1. Place plugin in `.opencode/plugins/`
  2. Start OpenCode
- **Expected Result**: Plugin logs warning, operates in disabled mode
- **Priority**: P1

### TC-CFG-04: Invalid baseURL (Malformed URL)
- **Description**: Plugin handles malformed baseURL
- **Precondition**: `opencode.json` contains `{ "pets": { "baseURL": "not-a-valid-url" } }`
- **Steps**:
  1. Place plugin in `.opencode/plugins/`
  2. Start OpenCode
- **Expected Result**: Plugin logs warning, operates in disabled mode
- **Priority**: P2

---

## Category 2: State Transition Tests

### TC-STATE-01: Session Created → Thinking
- **Description**: New session triggers `/thinking` API call
- **Precondition**: Plugin loaded with valid config, pet service mock running
- **Steps**:
  1. Start a new OpenCode session (send a message)
  2. Observe pet service mock logs
- **Expected Result**: `GET /thinking` received by pet service
- **Priority**: P0

### TC-STATE-02: Session Idle → Idle
- **Description**: Session idle triggers `/idle` API call
- **Precondition**: Plugin loaded, AI has finished responding
- **Steps**:
  1. Wait for AI to complete a response
  2. Observe pet service mock logs
- **Expected Result**: `GET /idle` received by pet service
- **Priority**: P0

### TC-STATE-03: Session Error → Error
- **Description**: Session error triggers `/error` API call
- **Precondition**: Plugin loaded with valid config
- **Steps**:
  1. Trigger a condition that causes a session error (e.g., tool execution failure)
  2. Observe pet service mock logs
- **Expected Result**: `GET /error` received by pet service
- **Priority**: P1

### TC-STATE-04: Read Tool → Reading
- **Description**: File read triggers `/reading` API call
- **Precondition**: Plugin loaded with valid config
- **Steps**:
  1. Ask AI to read a file (triggering `read` tool)
  2. Observe pet service mock logs
- **Expected Result**: `GET /reading` received by pet service
- **Priority**: P0

### TC-STATE-05: Write Tool → Writing
- **Description**: File write triggers `/writing` API call
- **Precondition**: Plugin loaded with valid config
- **Steps**:
  1. Ask AI to create/edit a file (triggering `write` or `edit` tool)
  2. Observe pet service mock logs
- **Expected Result**: `GET /writing` received by pet service
- **Priority**: P0

### TC-STATE-06: Bash Tool → Working
- **Description**: Bash execution triggers `/working` API call
- **Precondition**: Plugin loaded with valid config
- **Steps**:
  1. Ask AI to run a command (triggering `bash` tool)
  2. Observe pet service mock logs
- **Expected Result**: `GET /working` received by pet service
- **Priority**: P0

### TC-STATE-07: Other Tool → Working
- **Description**: Non-standard tool (not read/edit/write) triggers `/working` API call
- **Precondition**: Plugin loaded with valid config
- **Steps**:
  1. Trigger a tool that is not read/write/edit (e.g., a custom tool)
  2. Observe pet service mock logs
- **Expected Result**: `GET /working` received by pet service
- **Priority**: P1

---

## Category 3: Deduplication & Debounce Tests

### TC-DEDUP-01: Consecutive Same-State Calls Deduplicated
- **Description**: Plugin does not send duplicate API calls for consecutive same-state events
- **Precondition**: Plugin loaded with valid config, pet service mock running
- **Steps**:
  1. Trigger two consecutive `read` tool executions
  2. Observe pet service mock logs
- **Expected Result**: Only ONE `GET /reading` call sent (not two)
- **Priority**: P1

### TC-DEDUP-02: Different States Trigger Separate Calls
- **Description**: Plugin sends new API call when state actually changes
- **Precondition**: Plugin loaded with valid config, pet service mock running
- **Steps**:
  1. Trigger a `read` tool → expect `/reading`
  2. Then trigger a `bash` tool → expect `/working`
  3. Observe pet service mock logs
- **Expected Result**: Both `/reading` and `/working` received (two distinct calls)
- **Priority**: P1

### TC-DEBOUNCE-01: Rapid Tool Calls Debounced
- **Description**: Rapid state oscillation within 1000ms sends only the final state
- **Precondition**: Plugin loaded with valid config, pet service mock running
- **Steps**:
  1. Trigger rapid sequence: `read` → `edit` → `bash` (within 1000ms)
  2. Observe pet service mock logs
- **Expected Result**: Only the final state (`/working`) is sent
- **Priority**: P1

### TC-DEBOUNCE-02: Idle Fires Immediately
- **Description**: `idle` state fires immediately, cancels pending debounce
- **Precondition**: Plugin loaded, AI is working (debounce timer pending)
- **Steps**:
  1. Trigger a tool call (debounce timer starts)
  2. Immediately let session become idle
  3. Observe pet service mock logs
- **Expected Result**: `GET /idle` received immediately, pending debounce timer cancelled
- **Priority**: P1

### TC-DEBOUNCE-03: Error Fires Immediately
- **Description**: `error` state fires immediately, cancels pending debounce
- **Precondition**: Plugin loaded, AI is working (debounce timer pending)
- **Steps**:
  1. Trigger a tool call (debounce timer starts)
  2. Immediately trigger a session error
  3. Observe pet service mock logs
- **Expected Result**: `GET /error` received immediately, pending debounce timer cancelled
- **Priority**: P1

---

## Category 4: Error Handling Tests

### TC-ERR-01: Pet Service Unreachable
- **Description**: Plugin handles unreachable pet service gracefully
- **Precondition**: Plugin loaded with valid config, pet service is DOWN
- **Steps**:
  1. Send a message to OpenCode to trigger activity
  2. Check OpenCode behavior
- **Expected Result**: OpenCode operates normally. Plugin logs errors. No crashes, no delays.
- **Priority**: P0

### TC-ERR-02: Pet Service Returns Error
- **Description**: Plugin handles HTTP error responses from pet service
- **Precondition**: Plugin loaded, pet service returns 500 for all endpoints
- **Steps**:
  1. Send a message to OpenCode to trigger activity
  2. Check OpenCode behavior
- **Expected Result**: OpenCode operates normally. Plugin logs the error.
- **Priority**: P1

### TC-ERR-03: Pet Service Timeout
- **Description**: Plugin handles slow pet service response
- **Precondition**: Plugin loaded, pet service has 10-second response delay
- **Steps**:
  1. Send a message to OpenCode to trigger activity
  2. Check if OpenCode remains responsive
- **Expected Result**: OpenCode does not freeze or become unresponsive. Plugin may log timeout.
- **Priority**: P2

---

## Category 5: Non-Interference Tests

### TC-NI-01: Plugin Does Not Block Tool Execution
- **Description**: Tool execution time is unaffected by plugin
- **Precondition**: Plugin loaded with valid config
- **Steps**:
  1. Measure time to execute `bash echo hello` WITHOUT plugin
  2. Measure time to execute `bash echo hello` WITH plugin
  3. Compare
- **Expected Result**: Execution time difference ≤ 100ms
- **Priority**: P0

### TC-NI-02: Plugin Does Not Affect OpenCode Startup
- **Description**: OpenCode startup time is unaffected by plugin
- **Precondition**: Plugin file in `.opencode/plugins/`
- **Steps**:
  1. Measure OpenCode startup time WITHOUT plugin
  2. Measure OpenCode startup time WITH plugin
  3. Compare
- **Expected Result**: Startup time difference ≤ 500ms
- **Priority**: P1

---

## Category 6: Plugin Lifecycle Tests

### TC-LIFE-01: Plugin Loads at Startup
- **Description**: Plugin is loaded when OpenCode starts
- **Precondition**: Plugin file exists in `.opencode/plugins/`
- **Steps**:
  1. Start OpenCode
  2. Check logs for plugin initialization message
- **Expected Result**: Log contains "opencode-pets" service log entry at info level
- **Priority**: P0

### TC-LIFE-02: Plugin Unloads Cleanly
- **Description**: Plugin does not leave hanging resources on OpenCode exit
- **Precondition**: Plugin loaded and active
- **Steps**:
  1. Use OpenCode normally (trigger various states)
  2. Exit OpenCode
- **Expected Result**: Clean exit, no hanging processes or error messages
- **Priority**: P2

---

## Test Case Summary

| Category | Count | P0 | P1 | P2 |
|----------|-------|----|----|-----|
| Configuration | 4 | 1 | 2 | 1 |
| State Transitions | 7 | 4 | 2 | 1 |
| Dedup & Debounce | 5 | 0 | 5 | 0 |
| Error Handling | 3 | 1 | 1 | 1 |
| Non-Interference | 2 | 1 | 1 | 0 |
| Plugin Lifecycle | 2 | 1 | 0 | 1 |
| **Total** | **23** | **8** | **11** | **4** |
