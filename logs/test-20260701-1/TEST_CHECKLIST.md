# Test Checklist: opencode-pets

## Feature: 001-opencode-pets-plugin
## Test Date: 2026-07-01
## Environment

| Item | Value |
|------|-------|
| Pet Service BaseURL | `http://192.168.137.197` |
| Test Method | curl + Bun unit test |
| OpenCode Runtime | NOT AVAILABLE (plugin integration tests require OpenCode) |

---

## Category 1: API Environment Tests

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| API-01 | GET /thinking returns 200 | ⬜ | |
| API-02 | GET /idle returns 200 | ⬜ | |
| API-03 | GET /working returns 200 | ⬜ | |
| API-04 | GET /reading returns 200 | ⬜ | |
| API-05 | GET /writing returns 200 | ⬜ | |
| API-06 | GET /runing returns 200 | ⬜ | |
| API-07 | GET /sleeping returns 200 | ⬜ | |
| API-08 | All endpoints respond within 1s | ⬜ | |
| API-09 | POST returns 405 (expected) | ⬜ | |

## Category 2: Plugin Logic Tests (Bun)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| LOGIC-01 | Event → State mapping correctness | ⬜ | |
| LOGIC-02 | Tool → State mapping correctness | ⬜ | |
| LOGIC-03 | Deduplication of consecutive same-state | ⬜ | |
| LOGIC-04 | Different states trigger separate calls | ⬜ | |
| LOGIC-05 | Unknown tool defaults to "working" | ⬜ | |
| LOGIC-06 | Unknown session event is ignored | ⬜ | |

## Category 3: Build Verification

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| BUILD-01 | TypeScript compilation (tsc --noEmit) | ⬜ | |
| BUILD-02 | Plugin file exists and is valid TypeScript | ⬜ | |
| BUILD-03 | No `as any` outside logging | ⬜ | |

## Category 4: Integration Tests (requires OpenCode)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| INT-01 | Plugin loads at OpenCode startup | ⏭️ SKIP | No OpenCode runtime |
| INT-02 | session.created triggers /thinking | ⏭️ SKIP | Requires OpenCode |
| INT-03 | session.idle triggers /idle | ⏭️ SKIP | Requires OpenCode |
| INT-04 | read tool triggers /reading | ⏭️ SKIP | Requires OpenCode |
| INT-05 | write tool triggers /writing | ⏭️ SKIP | Requires OpenCode |
| INT-06 | bash tool triggers /runing | ⏭️ SKIP | Requires OpenCode |
| INT-07 | Missing config disables plugin | ⏭️ SKIP | Requires OpenCode |
| INT-08 | Pet service unreachable — no crash | ⏭️ SKIP | Requires OpenCode |

## Category 5: Config File Isolation (NEW)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| ISO-01 | Plugin reads opencode-pets.json only | ✅ PASS | Verified |
| ISO-02 | opencode.json has no effect | ✅ PASS | Verified |

## Category 6: Integration Tests (Bun — 30 tests)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| CFG-01 | Valid config → PetsConfig | ✅ PASS | |
| CFG-02 | Missing file → null + debug log | ✅ PASS | |
| CFG-03 | Empty baseURL → null | ✅ PASS | |
| CFG-04 | Missing key → null | ✅ PASS | |
| CFG-05 | Invalid JSON → warn + null | ✅ PASS | |
| CFG-06 | Whitespace trimmed | ✅ PASS | |
| SM-01~06 | State machine (6 tests) | ✅ PASS | |
| MAP-01~07 | Event mapping (7 tests) | ✅ PASS | |
| API-* | All 7 endpoints + concurrency + POST | ✅ PASS | 9 tests |
