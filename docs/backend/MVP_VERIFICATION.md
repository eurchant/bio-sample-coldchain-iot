# 第一阶段后端 MVP 验证记录

## 基本信息

- 验证时间：2026-07-13 15:04:28 CST
- 项目目录：`/Users/zy/Downloads/竞赛/物联网设计大赛/code`
- 当前分支：`zy`
- 提交前基线 commit：`aca7d987ad059f79f44d6d43cbd921a64959c4a1`
- Python：`backend/.venv/bin/python`
- Python 版本：`3.9.6`

## 语法与测试

语法检查命令：

```bash
backend/.venv/bin/python -m py_compile backend/main.py backend/test_api.py
```

结果：通过，退出码 0。

完整测试命令：

```bash
backend/.venv/bin/python -m pytest backend/test_api.py -v
```

结果：12 项通过，0 项失败，退出码 0。测试使用临时 SQLite 文件，不覆盖演示数据库。

## Mock JSON

递归解析结果：4 个文件全部有效。

- `docs/api/mock/alarms.json`
- `docs/api/mock/task-001.json`
- `docs/api/mock/telemetry-latest.json`
- `docs/api/mock/trace-report.json`

## HTTP 冒烟测试

服务地址：`http://127.0.0.1:8020`。

| 方法 | 路径 | 状态码 | 结果 |
| --- | --- | --- | --- |
| GET | `/docs` | 200 | Swagger HTML 可访问 |
| GET | `/api/v1/meta/contracts` | 200 | JSON 和统一响应通过 |
| GET | `/api/v1/tasks/TASK-001` | 200 | `task_id`、状态枚举、`device_id` 通过 |
| GET | `/api/v1/tasks/TASK-001/telemetry/latest` | 200 | JSON 和统一响应通过 |
| GET | `/api/v1/tasks/TASK-001/telemetry/history?limit=10` | 200 | JSON 和统一响应通过 |
| GET | `/api/v1/tasks/TASK-001/alarms?limit=10` | 200 | JSON 和统一响应通过 |
| GET | `/api/v1/tasks/TASK-001/trace-report` | 200 | 统一响应和 `handoff_nodes` 通过 |
| GET | `/api/device/latest` | 200 | 旧版兼容 JSON 通过 |
| GET | `/api/device/history` | 200 | 旧版兼容 JSON 通过 |
| GET | `/api/device/events` | 200 | 旧版兼容 JSON 通过 |
| OPTIONS | `/api/v1/tasks/TASK-001` | 200 | 本机 Web CORS 预检通过 |
| POST | `/api/device/data`（错误设备编号） | 409 | 设备绑定校验通过，数据被拒绝 |

发出、签收、拒收和非法重复操作通过临时数据库自动测试验证；为避免改变当前演示任务状态，本轮 HTTP 冒烟未调用这些写接口。

## 安全与范围

- 未修改开发板代码；本次计划暂存路径不包含 `开发板/`。
- `git ls-files '开发板/**'` 无输出，当前开发板目录未纳入版本控制。
- 未发现大于 50 MB 的文件。
- 发现运行数据库 `backend/device_data.db`，已由 `*.db` 忽略，不允许提交。
- `.venv/`、`.pytest_cache/`、`__pycache__/`、`.env*`、密钥、日志和前端构建目录均有忽略规则。
- 敏感词扫描只命中团队规范中的“禁止提交密码、Token”等说明，没有发现真实 Token、密码、API Key 或私钥。

## M1-M5 验收

- M1 硬件数据链路：通过。开发板 POST、最新、历史、事件接口保留，旧字段兼容测试通过。
- M2 最小任务模型：通过。`TASK-001` 返回样本、设备 `CLD-001`、人员和统一状态；错误设备绑定由 HTTP 409 拒绝。
- M3 交接与告警：通过。发出、签收、拒收、非法重复操作、多类异常和新旧接口状态一致性均有自动测试。
- M4 统一追溯数据：通过。监测、告警、任务和交接节点使用同一 `task_id` 和统一枚举。
- M5 验证与说明：通过。pytest、README、API 契约和 4 个 Mock 均可用。

## 已知限制

- 第一阶段只保证 `TASK-001`、`CLD-001` 演示主链路。
- 当前使用 SQLite，没有正式登录和细粒度权限。
- 当前写接口没有正式身份认证，公网联调地址和访问范围必须由负责人控制。
- `127.0.0.1` 只能由后端所在电脑访问。
- 多任务 CRUD、MySQL、GNSS、MQTT、文件上传和正式报告导出属于后续阶段。

## 提交结论

本轮验证通过，允许将明确列出的第一阶段后端、测试和文档文件提交到 `zy` 分支。提交前仍需检查暂存区，确保不含数据库、缓存、凭据和开发板目录。
