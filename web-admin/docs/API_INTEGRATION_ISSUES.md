# Web 管理端接口联调问题清单

验证日期：2026-07-21
验证任务：TASK-001
本地联调地址：http://127.0.0.1:8020

## 结论

**当前未发现阻塞问题。**

## 已验证项

| 场景 | 调用/行为 | 结果 |
| --- | --- | --- |
| 初始加载 | GET /api/v1/tasks/{task_id}、遥测、历史、告警 | 能读取 TASK-001 与设备上报数据。 |
| Web 轮询 | 每 3 秒同时刷新任务、遥测、历史、告警 | 外部签收后，Web 无需手动刷新即可显示“已签收”。 |
| 后端断开 | 停止本地 FastAPI 服务 | 页面提示“监测刷新暂时中断”，保留最近成功数据。 |
| 恢复连接 | 重启同一后端和测试数据库 | 下一轮轮询自动恢复为“监测连接正常”。 |
| 发出与签收 | POST /start，再由外部客户端调用 POST /sign | Web 状态、时间线和按钮禁用状态均按后端响应更新。 |
| 追溯报告 | GET /trace-report | 已显示最终“已签收”状态以及发出、签收两个交接节点。 |

## 证据

- docs/evidence/task-001-monitoring.png：任务监控与设备上报。
- docs/evidence/task-001-network-recovery.png：后端断开后的明确提示与最近成功数据。
- docs/evidence/task-001-signed-monitoring.png：外部签收后 Web 自动更新为“已签收”。
- docs/evidence/task-001-signed-trace-report.png：签收后的可信追溯报告。

## 后续联调注意项

- 127.0.0.1 仅指运行后端的本机；等待组长提供远程联调域名后，只替换 VITE_API_BASE_URL，不修改接口路径、字段或状态枚举。
- 本次验证使用临时 SQLite 数据库和临时 Python 虚拟环境，均未写入或提交到仓库。
