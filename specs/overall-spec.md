# Overall Specification: opencode-status-sync

> 详细规格文档见模块目录：[001-status-sync/spec.md](./001-status-sync/spec.md)

## 概述

opencode-status-sync 是一个 OpenCode 插件，实时监听 AI 助手活动并通过 HTTP 通知外部状态服务。所有 OpenCode 扩展点（session 事件、tool 调用）到 API 端点的映射关系完全由 JSON 配置文件驱动，无硬编码。

## 核心能力

- **配置驱动映射**：`opencode-status-sync.json` 中定义 OpenCode 扩展点 → API 端点的对应关系
- **全扩展点覆盖**：监听 `session.*` 事件和 `tool.execute.before/after` 钩子
- **状态管理**：去重 + 防抖（1000ms），终端状态（idle/error）即时触发
- **失败安全**：服务不可达时静默降级，不影响 OpenCode 正常运行
- **零依赖**：仅使用 Bun 内建 `fetch` 和 OpenCode 插件上下文

## 文档引用

| 文档 | 路径 | 说明 |
|------|------|------|
| 功能规格 | [001-status-sync/spec.md](./001-status-sync/spec.md) | 模块完整功能需求、用户故事、验收场景 |
| 技术方案 | [001-status-sync/plan.md](./001-status-sync/plan.md) | 架构设计、数据模型、关键算法、错误处理 |
