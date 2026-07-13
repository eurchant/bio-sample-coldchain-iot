# 后端 MVP 统一设计

## 目标

在不破坏 UniKnect 开发板上传和现有演示看板的前提下，为 PC Web 与微信小程序提供一套稳定、统一、可测试的 `/api/v1` 接口。

## 采用方案

采用兼容式统一：

- 保留现有 `/api/device/*`、`/api/task/*` 和 `/`，开发板与当前看板继续使用。
- 新增 `/api/v1`，供唐凯烜、刘佳雨和周瑞琪开发前端。
- 新接口统一返回 `{code, message, data}`。
- 新接口统一使用英文状态枚举；中文只用于页面显示。
- 本机 Web 开发来源通过 CORS 白名单正则开放，部署来源由环境变量配置。
- `TASK-001` 明确绑定 `CLD-001`，错误设备数据不会进入该任务追溯记录。
- MVP 继续使用 SQLite，不引入 JWT、MySQL、Redis、Alembic 或复杂权限。
- 先稳定 `TASK-001` 一条完整链路，再扩展多任务 CRUD。

## 统一状态

任务状态：

- `pending_pack`：待装箱或待发出
- `pending_handoff`：待承运确认
- `in_transit`：运输中
- `arrived`：已到达待签收
- `signed`：已签收
- `rejected`：已拒收
- `canceled`：已取消（保留值，MVP 暂无操作接口）

设备状态：

- 箱体：`BOX_OPEN`、`BOX_CLOSED`
- 运动：`STABLE`、`MILD`、`SEVERE`、`IMPACT`、`FREE_FALL`
- 温度：`TEMP_OK`、`TEMP_ALERT`

兼容规则：旧数据中的 `CLOSED` 和 `NORMAL` 在 `/api/v1` 输出时分别规范为 `BOX_CLOSED` 和 `TEMP_OK`，数据库原始上传值不被改写。

## `/api/v1` MVP 接口

- `GET /api/v1/meta/contracts`：返回状态枚举和统一字段约定。
- `GET /api/v1/tasks/{task_id}`：返回任务详情。
- `GET /api/v1/tasks/{task_id}/telemetry/latest`：返回任务最新监测数据。
- `GET /api/v1/tasks/{task_id}/telemetry/history?limit=100`：返回监测历史。
- `GET /api/v1/tasks/{task_id}/alarms?limit=100`：返回异常事件。
- `POST /api/v1/tasks/{task_id}/start`：发出交接并进入运输中。
- `POST /api/v1/tasks/{task_id}/sign`：到达签收。
- `POST /api/v1/tasks/{task_id}/reject`：拒收，必须填写原因。
- `GET /api/v1/tasks/{task_id}/trace-report`：返回统一追溯报告。

## 数据流

1. 开发板继续向 `POST /api/device/data` 上传原始 JSON。
2. 后端保存原始监测数据并生成异常事件。
3. Web 与小程序通过 `/api/v1/tasks/TASK-001/...` 查询同一份数据。
4. 发出、签收或拒收操作由后端校验状态并记录时间。
5. 追溯报告汇总任务、最新数据、统计摘要和异常时间线。

## 错误处理

- 成功：HTTP 2xx，`code` 为 `0`。
- 参数错误：HTTP 422 或 400。
- 任务不存在：HTTP 404，`code` 为非 0。
- 状态不允许：HTTP 409，`code` 为非 0。
- 前端不得通过解析中文错误文字判断业务状态。

## 测试范围

- 旧设备上传与旧查询接口持续通过。
- `/api/v1` 返回格式、状态规范化和任务过滤正确。
- 发出、签收、拒收状态流转正确，重复或非法操作被拒绝。
- 追溯报告与监测、异常接口使用同一任务数据。
- 测试使用临时 SQLite，不写入比赛演示数据库。

## MVP 外功能

完整用户权限、多任务 CRUD、组织管理、SQLAlchemy/Alembic 重构、MySQL、Redis、文件上传、PDF、GNSS、MQTT 和数据防篡改全部保留为后续阶段，不阻塞本次统一。

第一阶段写接口尚无正式身份认证，不应用于无人看管的真实公网业务；竞赛联调地址和访问范围由负责人统一管理。
