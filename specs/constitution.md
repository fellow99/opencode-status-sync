# Constitution: opencode-status-sync

## Project Identity

**opencode-status-sync** 是一个 OpenCode 插件，监听 AI 助手活动并通过配置驱动 HTTP 映射同步到外部服务。

## Core Principles

### 1. Non-Intrusive
插件 MUST 作为观察者运行。不可拦截/修改/延迟任何 OpenCode 操作。

### 2. Fail-Safe
HTTP 调用失败 MUST 静默记录。配置缺失→禁用模式。服务不可达→不抛错。

### 3. Minimal Dependencies
运行时零外部依赖。仅使用 Bun 内建 `fetch` 和 OpenCode 上下文。

### 4. Config-Driven
所有扩展点→接口映射在 `opencode-status-sync.json` 中定义。无硬编码。

### 5. Observable
状态变更 MUST 通过 `client.app.log()` 记录。debug 模式输出控制台日志。

### 6. Extension-Ready
使用原始 OpenCode 扩展点名称。`"*"` 通配符兜底未映射项。

## Quality Gates

| Gate | Criteria |
|------|----------|
| Type Safety | `bun x tsc --noEmit` 零错误，禁 `as any` / `@ts-ignore` |
| Build | 插件文件无语法错误 |
| Runtime | 加载不崩溃 |
| Config | 缺失/无效时降级 |
| API Failure | 服务不可达不影响 OpenCode |
