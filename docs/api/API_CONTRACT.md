# MVP 接口契约

## 约定

- 本地基础地址：`http://127.0.0.1:8000`
- 正式联调时只替换域名，不改变接口路径。
- 字段使用 `snake_case`。
- 时间使用 ISO 8601 字符串，例如 `2026-07-13T10:30:00+08:00`。
- `/api/v1` 成功响应统一包含 `code`、`message`、`data`。查询接口的 `message` 为 `success`，操作接口可以返回对应动作说明。
- 任务不存在：HTTP 404，业务码 `40401`。
- 任务状态不允许操作：HTTP 409，业务码 `40901`。
- FastAPI 参数校验失败：HTTP 422，响应使用框架的 `detail` 列表；拒收原因只有空白时返回 HTTP 400 和统一业务错误结构。

## 状态枚举

任务：`pending_pack`、`pending_handoff`、`in_transit`、`arrived`、`signed`、`rejected`、`canceled`。

箱体：`BOX_OPEN`、`BOX_CLOSED`。

运动：`STABLE`、`MILD`、`SEVERE`、`IMPACT`、`FREE_FALL`。

温度：`TEMP_OK`、`TEMP_ALERT`。

前端应保存英文值，页面显示时再映射为中文。完整枚举也可从 `GET /api/v1/meta/contracts` 实时读取。

第一阶段实际流程产生 `pending_pack`、`in_transit`、`signed`、`rejected`；`pending_handoff`、`arrived`、`canceled` 是已冻结的后续预留值。

## 查询接口

### 任务详情

`GET /api/v1/tasks/{task_id}`

MVP 使用 `TASK-001`，绑定设备为 `CLD-001`。响应 `data` 包含任务名称、设备编号、发出单位、接收单位、承运人员、状态和交接时间。

### 最新监测

`GET /api/v1/tasks/{task_id}/telemetry/latest`

还没有监测数据时 `data` 为 `null`。

### 监测历史

`GET /api/v1/tasks/{task_id}/telemetry/history?limit=100`

`limit` 范围为 1 到 100，结果按最新到最早排列。

### 异常列表

`GET /api/v1/tasks/{task_id}/alarms?limit=100`

返回开箱、温度异常、晃动、碰撞或跌落等事件，按最新到最早排列。

### 追溯报告

`GET /api/v1/tasks/{task_id}/trace-report`

返回 `task`、`latest`、`summary`、`events` 和 `handoff_nodes`，Web 与小程序应直接使用这一接口生成追溯展示。`handoff_nodes` 根据实际状态包含 `started`、`signed` 或 `rejected` 节点；尚未交接时可以为空数组。

## 操作接口

### 发出交接

`POST /api/v1/tasks/{task_id}/start`

无请求体。任务从待发出进入 `in_transit`，重复发出返回 HTTP 409。

### 到达签收

`POST /api/v1/tasks/{task_id}/sign`

无请求体。只有运输中或已到达任务允许签收。

### 拒收

`POST /api/v1/tasks/{task_id}/reject`

请求体：

```json
{"reason": "温度异常"}
```

只有运输中或已到达任务允许拒收，`reason` 不能为空。

## 开发板兼容接口

开发板仍向 `POST /api/device/data` 上传，不改 MicroPython 代码。请求字段为：

```json
{
  "device_id": "CLD-001",
  "task_id": "TASK-001",
  "temperature": 4.2,
  "humidity": 62.5,
  "light_raw": 120,
  "box_status": "BOX_CLOSED",
  "move_status": "STABLE",
  "temp_status": "TEMP_OK",
  "acc_total": 9.81,
  "motion_score": 0.2
}
```

`timestamp` 可选，不传时使用服务器时间。

演示任务 `TASK-001` 绑定设备 `CLD-001`。设备编号不匹配时返回 HTTP 409：

```json
{"ok": false, "error": "device does not match task"}
```

## Mock 文件

- `mock/task-001.json`
- `mock/telemetry-latest.json`
- `mock/alarms.json`
- `mock/trace-report.json`

Mock 只供前端页面开发；联调后应切换到真实接口。
