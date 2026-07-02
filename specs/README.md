# 规格文档索引

**项目名称：** opencode-status-sync
**版本：** 0.2.0
**技术栈：** TypeScript (strict) + Bun + OpenCode Plugin SDK
**文档生成时间：** 2026-07-02

---

## 一、文档总览

| 层级 | 分类 | 文档数量 | 说明 |
|------|------|---------|------|
| 整体 | 项目级顶层文档 | 6 | 架构、技术、宪法等全局文档 |
| 整体 | 整体规格文档 | 4 | overall-* 系列摘要文档 |
| 模块 | 功能模块 | 2 | 001-status-sync 模块规格+方案 |
| **合计** | **1 模块目录 / 14 文件** | | |

---

## 二、项目级顶层文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **方案总纲** | [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统整体架构与组件设计 |
| **技术选型** | [TECH.md](./TECH.md) | 核心技术栈、版本、依赖 |
| **宪法原则** | [constitution.md](./constitution.md) | 开发原则与质量门禁 |
| **检查清单** | [SPECS_CHECKLIST.md](./SPECS_CHECKLIST.md) | 文档完成度追踪 |

### 整体规格文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **整体规格** | [overall-spec.md](./overall-spec.md) | 系统级功能规格摘要 |
| **整体方案** | [overall-plan.md](./overall-plan.md) | 系统级技术方案摘要 |
| **数据模型** | [overall-data-model.md](./overall-data-model.md) | 核心类型与扩展点映射 |
| **测试用例** | [overall-test-cases.md](./overall-test-cases.md) | 测试用例索引 |

---

## 三、功能模块

### 001 — 状态同步插件 (Status Sync Plugin)

> 监听 OpenCode AI 活动，通过配置驱动 HTTP 映射同步到外部状态服务。

| 文档 | 链接 | 说明 |
|------|------|------|
| 功能规格 | [001-status-sync/spec.md](./001-status-sync/spec.md) | 6 组功能需求、用户故事、验收场景 |
| 技术方案 | [001-status-sync/plan.md](./001-status-sync/plan.md) | 架构、数据模型、关键算法、错误处理 |

---

## 四、模块编号一览

| 编号 | 模块名 | 英文名 | 分类 |
|------|--------|--------|------|
| 001 | 状态同步插件 | Status Sync Plugin | 功能模块 |

---

## 五、快速导航

| 目标读者 | 推荐阅读顺序 |
|---------|-------------|
| **新加入开发者** | constitution.md → ARCHITECTURE.md → overall-spec.md → 001-status-sync/spec.md |
| **架构师** | ARCHITECTURE.md → TECH.md → 001-status-sync/plan.md |
| **测试/QA** | overall-test-cases.md → 001-status-sync/spec.md |
| **产品经理** | overall-spec.md → 001-status-sync/spec.md |
