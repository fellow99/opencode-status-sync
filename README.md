# opencode-status-sync

OpenCode 插件 — 将 AI 助手的工作状态实时同步到外部可视化服务。

AI 在思考 🤔、读文件 📖、写代码 ✍️、执行命令 ⚙️、空闲发呆 💤 还是出错了 💥——你的外部服务都会同步收到通知。

---

## 工作原理

插件监听 OpenCode 的事件系统（`session.*` 和 `tool.execute.*`），将 AI 活动映射为逻辑状态，通过 HTTP GET 请求通知外部服务。所有映射关系可配置。

### 配置驱动映射

所有状态到 API 端点的映射都定义在 `opencode-status-sync.json` 中，无硬编码：

```json
{
  "debug": true,
  "baseURL": "http://192.168.137.197",
  "headers": {},
  "mapping": [
    { "status": "session.idle",          "url": "/idle"      },
    { "status": "session.error",         "url": "/error"     },
    { "status": "session.created",       "url": "/thinking"  },
    { "status": "session.status",        "url": "/thinking"  },
    { "status": "read",                  "url": "/reading"   },
    { "status": "glob",                  "url": "/reading"   },
    { "status": "grep",                  "url": "/reading"   },
    { "status": "edit",                  "url": "/writing"   },
    { "status": "write",                 "url": "/writing"   },
    { "status": "tool.execute.after",    "url": "/thinking"  },
    { "status": "*",                     "url": "/working"   }
  ]
}
```

### 状态检测

`status` 使用 OpenCode 原始扩展点名称，不做翻译。`"*"` 为通配符，匹配所有未精确命中的扩展点。

| OpenCode 扩展点 | status（原始名称） | 触发方式 | 接口 |
|----------------|-------------------|---------|------|
| `session.idle` | `session.idle` | `event` hook | `/idle` |
| `session.error` | `session.error` | `event` hook | `/error` |
| `session.created` | `session.created` | `event` hook | `/thinking` |
| `session.status` | `session.status` | `event` hook | `/thinking` |
| `tool.read` | `read` | `tool.execute.before` | `/reading` |
| `tool.glob` | `glob` | `tool.execute.before` | `/reading` |
| `tool.grep` | `grep` | `tool.execute.before` | `/reading` |
| `tool.edit` | `edit` | `tool.execute.before` | `/writing` |
| `tool.write` | `write` | `tool.execute.before` | `/writing` |
| 工具执行完毕 | `tool.execute.after` | hook 触发 | `/thinking` |
| 其他工具（bash等） | `*` 通配符 | `tool.execute.before` | `/working` |

### 防抖机制

AI 经常在短时间内连续调用多个工具，为避免状态反复跳跃，插件对非终结状态启用了 **1000ms 防抖**。`idle` 和 `error` 是终结状态，**不防抖**，一旦触发立刻发送。

---

## 快速开始

### 1. 放置插件文件

将 `.opencode/plugins/opencode-status-sync.ts` 复制到以下任一位置：

- **项目级**：`<你的项目>/.opencode/plugins/opencode-status-sync.ts`
- **全局级**：`~/.config/opencode/plugins/opencode-status-sync.ts`

### 2. 创建配置文件

在项目根目录创建 `opencode-status-sync.json`：

```json
{
  "debug": true,
  "baseURL": "http://192.168.137.197",
  "headers": {},
  "mapping": [
    { "status": "idle",     "url": "/idle"     },
    { "status": "error",    "url": "/error"    },
    { "status": "thinking", "url": "/thinking" },
    { "status": "reading",  "url": "/reading"  },
    { "status": "writing",  "url": "/writing"  },
    { "status": "working",  "url": "/working"  }
  ]
}
```

### 3. 重启 OpenCode

插件会在启动时自动加载。

---

## 配置项

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `debug` | 否 | `false` | 启用调试日志 |
| `baseURL` | 是 | — | 外部服务根地址 |
| `headers` | 否 | `{}` | 所有请求携带的 HTTP 头 |
| `mapping` | 是 | — | 状态到端点的映射数组 |
| `mapping[].status` | 是 | — | **OpenCode 原始扩展点名称**（事件类型/工具名），`"*"` 通配兜底 |
| `mapping[].url` | 是 | — | 接口环境的接口路径 |
| `mapping[].method` | 否 | `"GET"` | HTTP 方法（GET/POST 等） |
| `mapping[].body` | 否 | `""` | 请求体内容 |

如果 `opencode-status-sync.json` 不存在或配置无效，插件会打印警告并进入禁用模式——不影响 OpenCode 的正常运行。

---

## 外部服务 API

插件期望在 `baseURL` 上运行一个 HTTP 服务，提供以下端点：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/thinking` | GET | 思考中 — AI 正在生成回复 |
| `/idle` | GET | 发呆中 — AI 空闲，等待用户输入 |
| `/error` | GET | 出错 — AI 遇到错误 |
| `/reading` | GET | 阅读中 — AI 正在读取文件 |
| `/writing` | GET | 书写中 — AI 正在编辑/写入文件 |
| `/working` | GET | 工作中 — AI 正在执行命令或使用其他工具 |

所有端点均为 GET 请求。

---

## 项目结构

```
opencode-status-sync/
├── .opencode/plugins/
│   └── opencode-status-sync.ts  # 插件源码
├── specs/                        # 规范文档目录
├── opencode-status-sync.json     # 插件配置文件
├── package.json
├── tsconfig.json
└── README.md
```

---

## 开发

```bash
# 安装开发依赖
bun install

# 类型检查
bun x tsc --noEmit
```

插件运行时**零外部依赖**——仅使用 Bun 内置 `fetch` 和 OpenCode 插件上下文 API。

---

## License

MIT
