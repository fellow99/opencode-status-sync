# Overall Implementation Plan: opencode-status-sync

> 详细技术方案见模块目录：[001-status-sync/plan.md](./001-status-sync/plan.md)

## 概述

单文件 TypeScript 插件（368 行），运行于 Bun 运行时，通过 OpenCode 的 `event`、`tool.execute.before`、`tool.execute.after` 三个钩子监听 AI 活动，将原始扩展点名称直接映射到配置的 HTTP 端点。

## 架构

```
Config (JSON) → Config Reader (validation) → State Manager (dedup + debounce)
                                                   ↓
OpenCode Events → Hook Dispatcher → transitionTo() → HTTP Notifier (fetch)
```

## 关键技术决策

| 决策 | 理由 |
|------|------|
| 原始扩展点名称作为 status key | 消除翻译层，配置即真相 |
| `*` 通配符兜底 | 未知工具自动走 `/working` |
| 事件过滤器（仅 session.* 事件） | 防止 `message.updated` 等噪声污染终端状态 |
| 终端状态守卫 | `session.idle/error` 后拒绝非终端覆盖 |

## 文档引用

| 文档 | 路径 |
|------|------|
| 技术方案 | [001-status-sync/plan.md](./001-status-sync/plan.md) |
| 功能规格 | [001-status-sync/spec.md](./001-status-sync/spec.md) |
