# 后端 MVP 统一实施计划

**目标：** 保持旧接口兼容，提供前端可直接使用的 `/api/v1` 统一契约、Mock 数据和验证说明。

**架构：** 当前阶段继续由 `backend/main.py` 承载 FastAPI 应用，避免为了目录美观进行高风险重构。统一状态转换、响应封装和 v1 路由使用小函数隔离；测试稳定后再决定是否拆分模块。

**技术栈：** Python、FastAPI、Pydantic、SQLite、Pytest、HTTPX。

## 全局约束

- 不修改 `开发板/` 中的 MicroPython 代码。
- 不删除现有接口、数据库表或历史数据。
- 不改变 `POST /api/device/data` 的请求字段。
- 新测试使用临时数据库。
- MVP 不加入登录、MySQL、Redis、PDF 或 GNSS。

## 任务 1：冻结统一契约

**文件：**

- 修改：`backend/test_api.py`
- 修改：`backend/main.py`

步骤：

1. 添加 `GET /api/v1/meta/contracts` 的失败测试，断言统一响应格式和所有状态枚举。
2. 运行测试，确认因为接口不存在而失败。
3. 实现 `api_success()`、状态常量和契约接口。
4. 运行全部测试，确认新旧接口同时通过。

## 任务 2：统一任务与监测查询

**文件：**

- 修改：`backend/test_api.py`
- 修改：`backend/main.py`

步骤：

1. 添加任务详情、latest、history、alarms 的失败测试。
2. 运行测试，确认因 v1 路由不存在而失败。
3. 实现按 `task_id` 过滤的查询，并将旧状态规范为统一枚举。
4. 验证不存在任务返回 404，`limit` 只接受 1 到 100。
5. 运行全部测试。

## 任务 3：统一交接状态流转

**文件：**

- 修改：`backend/test_api.py`
- 修改：`backend/main.py`

步骤：

1. 添加 start、sign、reject 的失败测试。
2. 运行测试，确认接口或校验尚未实现。
3. 为 `task_handoff` 兼容增加 `rejected_at` 和 `rejection_reason` 字段。
4. 实现发出、签收和拒收；拒收原因不能为空，非法状态返回 409。
5. 保持旧 `/api/task/start` 和 `/api/task/sign` 可用。
6. 运行全部测试。

## 任务 4：统一追溯报告

**文件：**

- 修改：`backend/test_api.py`
- 修改：`backend/main.py`

步骤：

1. 添加 v1 追溯报告失败测试。
2. 实现任务、最新监测、统计摘要、异常事件和运输结果汇总。
3. 验证报告与其他 v1 接口状态和字段一致。
4. 运行全部测试。

## 任务 5：前端交付资料

**文件：**

- 创建：`docs/api/API_CONTRACT.md`
- 创建：`docs/api/mock/task-001.json`
- 创建：`docs/api/mock/telemetry-latest.json`
- 创建：`docs/api/mock/alarms.json`
- 创建：`docs/api/mock/trace-report.json`
- 修改：`backend/README.md`

步骤：

1. 根据真实 OpenAPI 和测试结果编写接口文档。
2. 提供与真实响应一致的 Mock JSON。
3. 写清楚小白可执行的安装、测试、启动和 Swagger 访问步骤。
4. 检查文档中没有临时 Cloudflare 地址、密码或 Token。

## 任务 6：最终验证

步骤：

1. 运行 `pytest -q`，要求零失败。
2. 运行 Python 语法检查。
3. 使用临时数据库启动 Uvicorn。
4. 通过 HTTP 验证契约、任务、监测、告警、交接和报告。
5. 停止临时服务，不修改比赛演示数据库。
