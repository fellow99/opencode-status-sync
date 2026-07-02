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
    { "status": "idle",     "url": "/idle",     "body": "" },
    { "status": "error",    "url": "/error",    "body": "" },
    { "status": "thinking", "url": "/thinking", "body": "" },
    { "status": "reading",  "url": "/reading",  "body": "" },
    { "status": "writing",  "url": "/writing",  "body": "" },
    { "status": "working",  "url": "/working",  "body": "" }
  ]
}
```

### 状态检测

| OpenCode 行为 | 如何检测 | 默认映射到 |
|---------------|---------|-----------|
| 会话创建 / 用户发送消息 | `event` hook → `session.created` | `thinking` |
| 会话进入空闲 | `event` hook → `session.idle` | `idle` |
| 会话发生错误 | `event` hook → `session.error` | `error` |
| 工具: read, glob, grep | `tool.execute.before` | `reading` |
| 工具: edit, write | `tool.execute.before` | `writing` |
| 工具: bash 及其他 | `tool.execute.before` | `working` |
| 工具执行完毕（无错误） | `tool.execute.after` | `thinking` |

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
    { "status": "idle",     "url": "/idle",     "body": "" },
    { "status": "error",    "url": "/error",    "body": "" },
    { "status": "thinking", "url": "/thinking", "body": "" },
    { "status": "reading",  "url": "/reading",  "body": "" },
    { "status": "writing",  "url": "/writing",  "body": "" },
    { "status": "working",  "url": "/working",  "body": "" }
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
| `mapping[].status` | 是 | — | 逻辑状态名称 |
| `mapping[].url` | 是 | — | 相对 URL 路径 |
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
