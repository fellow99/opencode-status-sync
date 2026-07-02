# Technology Selection: opencode-status-sync

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Runtime | **Bun** | OpenCode 插件运行环境，不可选 |
| Language | **TypeScript** (strict) | 类型安全；`.ts` 原生支持 |
| HTTP Client | **Native `fetch`** | Bun 内建，零依赖 |
| Config | **JSON** (`opencode-status-sync.json`) | OpenCode 生态标准 |
| Types | `@opencode-ai/plugin` ^1.17.12 | 官方类型定义（dev only） |
| Dev Tools | `typescript` ^5.7, `@types/bun` ^1.3.14 | 编译+IDE 支持 |

### Runtime Dependencies: 0

仅使用 Bun 内建 `fetch` 和 OpenCode 插件上下文 (`client`, `$`)。

### 源文件

| 文件 | 行数 | 用途 |
|------|------|------|
| `.opencode/plugins/opencode-status-sync.ts` | 368 | 插件全部逻辑 |
| `opencode-status-sync.json` | 18 | 默认配置（11 条映射） |

## 参考文档

- [OpenCode 插件机制](https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/plugins.mdx) — 官方插件开发指南
- [OpenCode 文档](https://opencode.ai/docs/) — 官方文档入口
- [OpenCode 代码库](https://github.com/anomalyco/opencode) — 源码仓库
