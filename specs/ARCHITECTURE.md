# Architecture: opencode-status-sync

> 详细架构见：[001-status-sync/plan.md](./001-status-sync/plan.md) 第 3 节

## 系统架构

```
OpenCode Runtime
  └── opencode-status-sync Plugin (368 lines)
        ├── Config Reader    — readConfig() from JSON
        ├── State Manager    — transitionTo() with dedup + debounce + terminal guard
        ├── HTTP Notifier    — notify() with fetch + AbortController + try/finally
        └── Hook Dispatcher  — event, tool.execute.before, tool.execute.after
              ↓ HTTP
        External Status Service (/idle, /error, /thinking, /reading, /writing, /working)
```

## 组件职责

| 组件 | 行号 | 职责 |
|------|------|------|
| Config Reader | L57-131 | 读取+验证 `opencode-status-sync.json`，返回 `StatusSyncConfig` 或 `null` |
| State Manager | L262-325 | `transitionTo()`: 去重→终端守卫→即时/防抖→通知 |
| HTTP Notifier | L205-260 | `notify()`: 映射查找→URL 构造→fetch（5s timeout+try/finally） |
| Hook Dispatcher | L333-367 | 事件过滤（仅 session.*）→ 工具名透传 → after 守卫 |

## 关键设计决策

| 决策 | 实现 |
|------|------|
| 配置驱动 | `mapping[]` 数组中 `status` → `url`，无硬编码 |
| 原始名称 | `event.type` / `input.tool` 直接作为 status key |
| 通配符 | `"*"` 条目兜底所有未精确匹配的扩展点 |
| 事件过滤 | `SESSION_STATE_EVENTS` 集合只允许 4 种 session 事件 |
| 终端守卫 | `IMMEDIATE_STATUSES.has(currentStatus)` 阻止非终端覆盖 |
| 防抖 | 1000ms，`setTimeout` + `clearTimeout` |
