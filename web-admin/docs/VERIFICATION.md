# MVP 验证记录

## 构建与测试

- pnpm test：通过，2 个状态展示映射测试。
- pnpm build：通过，Vue 类型检查和 Vite 生产构建均成功。

## 浏览器验收

- Mock 模式：任务总览、实时监控、异常时间线和追溯报告均使用 docs/api/mock 下的原始契约样例加载。
- API 模式：使用临时 SQLite 数据库启动现有后端，前端通过 VITE_API_BASE_URL=http://127.0.0.1:8020 联调。
- 已验证状态：pending_pack → in_transit → signed。发出与签收操作均弹出确认层，成功后由后端返回的任务状态更新页面并禁用不合法操作。
- 追溯页已验证展示后端 trace-report 聚合的已签收状态及 started、signed 交接节点。
- 浏览器控制台：无 error 或 warning。

## 联调配置

真实联调仅需创建不提交的 .env.local：

    VITE_DATA_SOURCE=api
    VITE_API_BASE_URL=https://组长提供的地址

页面不会在组件中写死后端地址。Mock 模式只提供查询数据，不模拟任务状态机。
