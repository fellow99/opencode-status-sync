# opencode-pets

OpenCode 插件 — 将 AI 助手的工作状态实时推送给宠物可视化服务。

AI 在思考 🤔、读文件 📖、写代码 ✍️、执行命令 ⚙️、空闲发呆 💤 还是出错了 💥——你的桌面宠物都会同步表现出来。

---

## 工作原理

插件监听 OpenCode 的事件系统（`session.*` 和 `tool.execute.*`），将 AI 活动映射为宠物状态，通过 HTTP GET 请求通知宠物服务：

| 触发条件 | 宠物状态 | API 端点 | 含义 |
|---------|---------|----------|------|
| 用户发送消息 / 工具执行完毕 | `thinking` | `GET /thinking` | 思考中 |
| 会话进入空闲 | `idle` | `GET /idle` | 发呆中 |
| 会话发生错误 | `error` | `GET /error` | 出错 |
| 调用 `read` / `glob` / `grep` 工具 | `reading` | `GET /reading` | 阅读中 |
| 调用 `edit` / `write` 工具 | `writing` | `GET /writing` | 书写中 |
| 调用 `bash` 或其他工具 | `working` | `GET /working` | 工作中 |

### 防抖机制

AI 经常在短时间内连续调用多个工具（读文件→搜索→写代码→执行命令），为避免宠物在状态间反复跳跃产生视觉抖动，插件对非终结状态（`thinking`、`reading`、`writing`、`working`）启用了 **1000ms 防抖**——快速连串的状态变更只发送最后一次。

`idle`（发呆）和 `error`（出错）是终结状态，**不防抖**，一旦触发立刻发送，同时取消所有待处理的防抖定时器。

```
reading → writing → thinking（200ms 内连续发生）
                        ↓
              1000ms 后发送 "thinking"

但如果是：
reading → idle（200ms 内）
           ↓
     立刻发送 "idle"，取消防抖
```

---

## 快速开始

### 1. 放置插件文件

将 `.opencode/plugins/opencode-pets.ts` 复制到以下任一位置：

- **项目级**：`<你的项目>/.opencode/plugins/opencode-pets.ts`
- **全局级**：`~/.config/opencode/plugins/opencode-pets.ts`

### 2. 创建配置文件

在项目根目录（或全局配置目录）创建 `opencode-pets.json`：

```json
{
  "baseURL": "http://192.168.137.197",
  "debug": true
}
```

### 3. 重启 OpenCode

插件会在启动时自动加载。

---

## 配置项

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `baseURL` | 是 | — | 宠物服务的根地址（如 `http://192.168.137.197`） |
| `debug` | 否 | `false` | 启用调试日志（`console.info`） |

如果 `opencode-pets.json` 不存在或 `baseURL` 无效，插件会打印警告并进入禁用模式——不影响 OpenCode 的正常运行。

---

## 宠物服务 API

插件期望在 `baseURL` 上运行一个 HTTP 服务，提供以下端点：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/thinking` | GET | 思考中 — AI 正在生成回复 |
| `/idle` | GET | 发呆中 — AI 空闲，等待用户输入 |
| `/error` | GET | 出错 — AI 遇到错误 |
| `/reading` | GET | 阅读中 — AI 正在读取文件 |
| `/writing` | GET | 书写中 — AI 正在编辑/写入文件 |
| `/working` | GET | 工作中 — AI 正在执行命令或使用其他工具 |

所有端点均为 GET 请求，无需认证，无需请求体。

---

## 项目结构

```
opencode-pets/
├── .opencode/plugins/
│   └── opencode-pets.ts      # 插件源码（单文件，~250 行）
├── specs/                     # 规范文档目录
│   ├── README.md              # 文档索引入口
│   ├── constitution.md        # 项目原则与质量门禁
│   ├── overall-spec.md        # 功能规范（场景/需求/映射）
│   ├── overall-plan.md        # 实现计划与状态机
│   ├── overall-data-model.md  # 数据模型与类型定义
│   ├── overall-test-cases.md  # 测试用例（23 条）
│   ├── ARCHITECTURE.md        # 系统架构与组件设计
│   ├── TECH.md                # 技术选型说明
│   └── STRUCTURE.md           # 目录结构说明
├── logs/                      # 开发与测试日志
├── opencode-pets.json         # 插件配置文件
├── package.json               # 项目元数据
├── tsconfig.json              # TypeScript 配置
└── README.md                  # 本文件
```

---

## 开发

```bash
# 安装开发依赖（类型检查用）
bun install

# 类型检查
bun x tsc --noEmit
```

插件运行时**零外部依赖**——仅使用 Bun 内置 `fetch` 和 OpenCode 插件上下文提供的 `client`、`$` 等 API。

---

## License

MIT
