# Test Cases: opencode-status-sync

> 完整验收场景见模块规格：[001-status-sync/spec.md](./001-status-sync/spec.md) 第 5 节

## 测试类型

| 类型 | 工具 | 说明 |
|------|------|------|
| 类型检查 | `bun x tsc --noEmit` | TypeScript 严格模式 |
| 配置验证 | Bun script | JSON schema + 映射完整性 |
| 接口连通 | `curl` | 6 端点 200 响应 |
| 运行时 | OpenCode 加载 | 插件启动/降级/事件调度 |

## 自动化测试

```bash
# TypeScript 编译
bun x tsc --noEmit

# 配置验证
bun -e "const c=JSON.parse(require('fs').readFileSync('opencode-status-sync.json','utf8')); ..."

# 接口连通
for ep in idle error thinking reading writing working; do
  curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://192.168.137.188/$ep"
done
```

## 手动测试场景

| 场景 | 预期 |
|------|------|
| 插件加载（有效配置） | info 日志 + 3 hooks 注册 |
| 插件加载（无配置） | warn 日志 + 禁用模式 |
| AI 读文件 | `/reading` 调用（防抖后） |
| AI 写文件 | `/writing` 调用（防抖后） |
| AI 执行命令 | `/working` 调用（防抖后） |
| AI 响应完成 | 防抖→`/thinking`→`session.idle`→`/idle` |
| 服务不可达 | OpenCode 正常运行，日志记录错误 |
