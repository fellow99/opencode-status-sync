# Data Model: opencode-status-sync

> 详细数据模型见：[001-status-sync/plan.md](./001-status-sync/plan.md) 第 4 节

## 核心类型

```typescript
interface StatusSyncConfig {
  debug: boolean
  baseURL: string
  headers: Record<string, string>
  mapping: MappingEntry[]
}

interface MappingEntry {
  status: string   // OpenCode 扩展点名称（session.idle, read, tool.execute.after, *）
  url: string      // API 路径（/idle, /reading, /thinking, /working）
  method?: string  // HTTP 方法，默认 GET
  body?: string    // 请求体，默认 ""
}
```

## 扩展点映射

| 扩展点 | status key | 接口 |
|--------|-----------|------|
| `session.idle` | `session.idle` | `/idle` |
| `session.error` | `session.error` | `/error` |
| `session.created` | `session.created` | `/thinking` |
| `session.status` | `session.status` | `/thinking` |
| `tool.read/glob/grep` | `read`/`glob`/`grep` | `/reading` |
| `tool.edit/write` | `edit`/`write` | `/writing` |
| `tool.execute.after` | `tool.execute.after` | `/thinking` |
| 其他工具 | `*` (通配符) | `/working` |

## 状态机

无持久化状态。运行时追踪：`currentStatus`、`debounceTimer`、`pendingDebounceStatus`。
终端状态（`session.idle`、`session.error`）即时触发并阻塞非终端覆盖。
