# 后端功能完成情况与交接说明

版本：2026-07-23
负责人：赵耀
适用范围：FastAPI 后端、Web 管理端联调、手机端/H5/小程序联调、UniKnect 设备上传联调

## 一、当前后端定位

当前后端是比赛联调和演示用的 FastAPI + SQLite 后端，目标是先支撑“硬件端上传、Web 端监看、手机端查询和交接”的完整 MVP 闭环。

本阶段重点是接口稳定、三端能接、演示能跑；不是企业生产级系统。真实人脸识别、对象存储、正式云服务器、短信验证码等重功能暂时不作为当前阻塞项。

## 二、运行方式

后端目录：

```bash
cd /Users/zy/Downloads/竞赛/物联网设计大赛/code/backend
```

启动：

```bash
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

本机地址：

```text
http://127.0.0.1:8000
```

局域网地址需要以负责人电脑当前 IPv4 为准，例如：

```text
http://10.24.77.29:8000
```

如果队友不在同一局域网，需要用 Cloudflare Tunnel 暴露公网地址。Cloudflare 的免费临时地址每次重启可能变化，硬件端和队友配置要同步更新。

## 三、已经完成的功能

### 1. 旧版硬件演示接口

这些接口继续保留，不能随便删除，因为开发板当前主要依赖它们上传数据。

- `POST /api/device/data`：接收 UniKnect 开发板上传数据。
- `GET /api/device/latest`：获取最新一条设备数据。
- `GET /api/device/history`：获取历史数据。
- `GET /api/device/events`：获取异常事件。
- `GET /api/task/current`：旧版任务状态。
- `POST /api/task/start`：旧版发出交接。
- `POST /api/task/sign`：旧版到达签收。
- `GET /api/task/report`：旧版追溯报告。
- `/`：本地演示看板。

### 2. 正式 `/api/v1` 响应格式

Web 端和小程序端统一使用 `/api/v1`。

成功响应：

```json
{"code": 0, "message": "success", "data": {}}
```

失败响应：

```json
{"code": 40401, "message": "task not found", "data": null}
```

注意：当前还没有统一返回 `request_id`，如果后续要严格对齐任务书，可以再补。

### 3. 账号与权限

已完成：

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/permissions`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

已支持角色：

- `admin`
- `sender`
- `carrier`
- `receiver`

已完成的安全点：

- 密码使用 PBKDF2-SHA256 加盐哈希。
- 登录 Token 只保存 SHA-256 哈希。
- 停用用户后，已有 Token 会失效。
- 默认禁止公开注册管理员；本地受控初始化才可临时开启。
- 发货方和管理员可通过 `GET /api/v1/users?role=carrier|receiver` 获取最小字段候选目录。

### 4. 运单管理

已完成：

- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/{task_id}`
- `PATCH /api/v1/tasks/{task_id}`
- `POST /api/v1/tasks/{task_id}/assign`
- `POST /api/v1/tasks/{task_id}/cancel`
- `POST /api/v1/tasks/{task_id}/precheck`
- `POST /api/v1/tasks/{task_id}/start`
- `POST /api/v1/tasks/{task_id}/arrive`
- `POST /api/v1/tasks/{task_id}/sign`
- `POST /api/v1/tasks/{task_id}/reject`

已支持：

- 新注册发货方默认看不到演示任务。
- 创建正式运单时后端生成 `WD-YYYYMMDD-NNN`。
- 发货方、承运方、接收方、管理员有基础权限隔离。
- 任务状态历史写入 `task_status_history`。
- `GET /api/v1/tasks` 支持 `status`、`keyword`、`page`、`page_size`、`updated_after`。
- 创建、发出、到达、签收、拒收支持 `Idempotency-Key`，避免重复点击造成重复业务。

### 5. 设备与遥测

已完成：

- `POST /api/v1/device/telemetry`
- `POST /api/v1/device/heartbeat`
- `GET /api/v1/tasks/{task_id}/telemetry/latest`
- `GET /api/v1/tasks/{task_id}/telemetry/history`
- `GET /api/v1/devices`
- `POST /api/v1/devices`
- `POST /api/v1/devices/{device_id}/bind`
- `POST /api/v1/devices/{device_id}/unbind`
- `GET /api/v1/devices/{device_id}/bindings`

已支持：

- `device_id + sequence` 去重。
- `captured_at` 和服务器接收时间同时保存。
- 电量 `battery`、位置 `lat/lng/accuracy` 保存。
- 设备状态、最后在线时间、当前绑定任务更新。
- 正式遥测和心跳强制已登记设备、有效密钥、HMAC-SHA256 签名与任务绑定。
- `X-Nonce` 防重放。
- 设备响应不返回密钥、密钥摘要或签名材料。
- 设备记录包含所有者，其他发货方不能覆盖、读取绑定历史或解绑。
- 绑定新设备会解除任务旧设备，解绑会同步清空任务 `device_id`。
- 设备所有者或管理员可轮换密钥，旧密钥立即失效，新密钥只返回一次。

历史数据查询已支持：

- `limit`
- `start_time`
- `end_time`
- `cursor`
- `downsample`

### 6. 告警

已完成：

- `GET /api/v1/tasks/{task_id}/alarms`
- `POST /api/v1/alarms/{alarm_id}/ack`
- `POST /api/v1/alarms/{alarm_id}/resolve`

当前能产生的告警：

- `BOX_OPEN`：开箱事件。
- `MILD`：轻微晃动。
- `SEVERE`：剧烈晃动或综合严重异常。
- `IMPACT`：疑似碰撞。
- `FREE_FALL`：疑似跌落。
- `TEMP_ALERT`：温度异常。
- `LOW_BATTERY`：低电量，当前阈值为 20%。
- `DEVICE_OFFLINE`：设备离线，当前阈值为 5 分钟无心跳或遥测。

### 7. 二维码与交接

已完成 MVP：

- `POST /api/v1/tasks/{task_id}/handoffs`
- `GET /api/v1/handoffs/{handoff_id}`
- `POST /api/v1/handoffs/{handoff_id}/confirm`
- `POST /api/v1/handoffs/{handoff_id}/reject`
- `POST /api/v1/tasks/{task_id}/qr-tokens`
- `POST /api/v1/qr-tokens/verify`
- `POST /api/v1/qr-tokens/{token_id}/revoke`

已支持：

- 动态二维码 Token 有过期时间。
- Token 验证成功后立即消费。
- 已消费或已撤销 Token 再验证会失败。
- 只有指定接收人可以消费二维码。
- 交接确认前强制校验对应二维码已经由指定接收人验证。
- 可按任务分页查询交接会话、参与人最小信息和证据状态。
- 正式签收前必须完成承运方向接收方的交接确认。

### 8. 人脸核验占位 MVP

已完成：

- `POST /api/v1/face/enroll`
- `GET /api/v1/face/profile`
- `DELETE /api/v1/face/profile`
- `POST /api/v1/face/verify`
- `GET /api/v1/admin/face-reviews`
- `POST /api/v1/admin/face-reviews/{review_id}/approve`
- `POST /api/v1/admin/face-reviews/{review_id}/reject`

注意：

- 当前是占位 MVP，不接真实人脸识别厂商。
- 不保存原始照片。
- 不保存人脸特征向量。
- 规则是 `liveness_passed = true` 且 `similarity_score >= 0.8` 判定通过。
- 失败进入人工复核。

### 9. 文件、证据、追溯报告

已完成：

- `POST /api/v1/files`
- `GET /api/v1/files/{file_id}`
- `GET /api/v1/tasks/{task_id}/trace-report`
- `GET /api/v1/tasks/{task_id}/trace-report.pdf`

当前实现：

- 支持 `multipart/form-data` 保存真实 JPEG、PNG、PDF 证据，最大 5 MB。
- 同时校验扩展名、MIME、文件头和可选 SHA-256。
- 重复文件按任务、用途和 SHA-256 去重。
- 下载重新校验任务权限，接口不暴露服务器磁盘路径。
- 旧元数据登记接口继续兼容。
- 追溯报告包含任务、最新数据、统计、异常、状态历史、证据文件和 `trace_hash`。
- PDF 是简版 PDF，适合 MVP 演示，不是正式精排报告。

### 10. 管理与通知

已完成：

- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{user_id}/status`
- `GET /api/v1/admin/tasks`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/notifications`
- `POST /api/v1/notifications/{notification_id}/read`

已支持：

- 管理员查看用户、任务、审计日志。
- 管理员停用用户。
- 异常事件会给相关用户生成通知。

## 四、还需要继续完成的功能

### 后续产品化增强

1. 所有 `/api/v1` 响应补 `request_id`。
2. 将内存/SQLite 限流升级为 Redis 等多实例共享限流。
3. 若比赛最终宣称真实人脸识别，再接入合规供应商并将其设为强制前置证据。
4. 将本地文件存储升级为对象存储和短期预签名 URL。

### P1 可以后做

1. PDF 报告中文字体和正式排版。
2. 路线偏离告警，需要先确定真实定位来源。
3. PostgreSQL/Redis 正式部署。

### 暂时不建议现在做

1. 真实短信验证码。
2. 真实第三方人脸识别。
3. PostgreSQL/Redis 正式部署。
4. 上链存证。
5. 复杂后台权限系统。

这些功能更偏正式产品，容易拖慢比赛 MVP。

## 五、重要注意事项

### 1. 不要破坏开发板旧接口

开发板当前主要使用：

```text
POST /api/device/data
```

这个接口必须保留。即使后续正式接口更完整，也不要直接删除旧接口。

### 2. Cloudflare 地址会变

如果使用：

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

每次重启都可能生成新的 `trycloudflare.com` 地址。地址变化后：

- 开发板 `SERVER_URL` 要同步改。
- Web 端和小程序端的 `VITE_API_BASE_URL` 也要同步改。
- 群里要重新发最新公网地址。

### 3. 不要提交数据库和临时文件

不要提交：

- `backend/device_data.db`
- `backend/device_data.db.bak.*`
- `.pytest_cache/`
- `.venv/`
- `node_modules/`
- 临时测试目录
- 本地 `.env.local`

### 4. 当前数据库是 SQLite

SQLite 适合本地演示和比赛 MVP。多人同时大量写入、正式云部署时，建议后续迁移到 PostgreSQL。

### 5. 测试必须通过再交接

后端提交前运行：

```bash
cd backend
source .venv/bin/activate
python -m pytest test_api.py -q
python3 -m py_compile main.py
```

当前最新验证结果：

```text
37 passed
```

## 六、推荐给新后端同学的接手顺序

1. 先本地启动后端，打开 `/docs` 看 Swagger。
2. 跑 `python -m pytest test_api.py -q`，确认环境没问题。
3. 读 `backend/README.md` 和本文档。
4. 先不要改旧接口 `/api/device/data`。
5. 优先补 `request_id`、限流、交接强校验。
6. 每补一个功能，同步补测试。
7. 跑通测试后再推分支。

## 七、给前端和小程序的当前联调口径

Web 和小程序优先使用：

```text
/api/v1
```

不要再新增只服务某一端的私有接口。确实需要新字段时，先在后端统一加，再通知三端同步。

当前演示固定任务仍可用：

```text
TASK-001
```

但正式业务流程应优先测试新建运单 `WD-YYYYMMDD-NNN`，避免所有账号共用演示任务导致权限测试不准确。
