# Post-`zy` PC Web Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Goal

将 `upstream/zy` 的正式认证和多任务后端能力接入 PC Web 管理端；保持 Mock 演示模式可用，并不把未获得契约确认的字段或权限规则写死到页面。

## Design decisions

- API 模式只在浏览器会话内保存 Bearer Token，关闭标签页后失效；不将密码、Token 或远程地址提交进仓库。
- API 模式登录后的首页是“我的任务”，不再默认请求 `TASK-001`。该演示任务在携带普通用户 Token 时可能无权访问。
- 任务详情、地图、追溯报告从路由中的 `taskId` 读取；任务状态、操作权限和最终结果始终以服务端响应为准。
- Mock 模式继续提供原演示身份和 `TASK-001`，用于前端离线开发，不模拟写操作状态机。

## Implementation tasks

### 1. Formal authentication and session boundary

Files:

- Create `web-admin/src/services/session.ts`
- Modify `web-admin/src/services/api.ts`
- Modify `web-admin/src/stores/auth.ts`
- Modify `web-admin/src/views/LoginView.vue`
- Modify `web-admin/src/App.vue`, `web-admin/src/router/index.ts`
- Add focused unit tests

Steps:

1. Add safe session-storage adapters and a session-invalidated browser event.
2. Add `/auth/login`、`/me`、`/permissions`、`/logout` clients and automatic Bearer header injection.
3. Restore and validate an existing API session before protected routing; clear it and return to login on 401.
4. Preserve Mock-mode role selection separately from API-mode username/password login.
5. Show the authenticated user and backend role in the shell; never render token values.

### 2. Dynamic task loading and task directory

Files:

- Modify `web-admin/src/stores/task.ts`
- Create `web-admin/src/stores/taskDirectory.ts`
- Create `web-admin/src/views/TaskListView.vue`
- Modify detail/map/report views and routes
- Extend `web-admin/src/services/api.ts` and `web-admin/src/types/contracts.ts`

Steps:

1. Make task data loading accept a route task ID instead of always using `VITE_DEMO_TASK_ID`.
2. Add authenticated task list search, status filter and backend pagination.
3. Route each returned task into the existing monitoring, map and trace pages.
4. Keep polling limited to the currently opened authorized task.
5. Test route-task selection and list failure/recovery behavior.

### 3. Sender/admin task creation and editing

Files:

- Create reusable task form helpers/components as needed
- Extend task client/store and task list view
- Add tests for client-side field validation and button availability

Steps:

1. Consume only documented `CreateTaskIn`/`UpdateTaskIn` fields.
2. Create a one-time `Idempotency-Key` for task creation.
3. Allow sender/admin to create a task and then navigate to its returned task ID.
4. Add edit only while the server returns an editable state; display server validation and 403/409 messages.

### 4. Real PDF download and map data migration

Files:

- Modify `web-admin/src/views/TraceReportView.vue`
- Modify map data types/adapters and `TaskMapView.vue`

Steps:

1. Use `/trace-report.pdf` for server-generated download, retaining browser print as a fallback.
2. Surface true telemetry `lat`/`lng`/`accuracy` only when returned by the backend.
3. Do not claim a map is real until hardware has uploaded actual location values and the team has selected a tile/privacy policy.

### 5. Documentation, verification and handoff

Files:

- Create `docs/handoffs/2026-07-23-cross-client-integration-and-backend-requests.md`
- Update `web-admin/README.md` and the previous roadmap status

Steps:

1. Record what the `zy` merge made immediately implementable and what the Web branch completed.
2. Give backend, hardware and mini-program owners endpoint-level tasks, acceptance checks and P0 risks.
3. Explicitly flag stale API docs, permissions gaps, real file-upload gap, and WeChat AppID/HTTPS requirements.
4. Run frontend tests, production build, backend syntax/tests where safe, and a sensitive-file check before local commit.

### 6. Device ledger and authoritative task binding

Files:

- Create `web-admin/src/stores/device.ts` and focused tests
- Create `web-admin/src/views/DeviceListView.vue`
- Extend `web-admin/src/services/api.ts`, routes and navigation

Steps:

1. Use the existing authenticated device ledger, registration, binding, unbinding and binding-history endpoints; URL-encode device IDs.
2. Never render, retain or submit a device secret in the browser. The page accepts only device ID, name and model.
3. Remove direct `device_id` writes from the task form, because the current backend does not synchronize them with device bindings.
4. Refresh the ledger after each mutation and show server errors instead of optimistically claiming a successful binding.
5. Record device response leakage, anonymous upload and data-consistency gaps as a P0 backend handoff before any true-device demo.

## Completion criteria for this batch

- API-mode login, logout, reload restoration and 401 recovery work without exposing tokens.
- An authorized user can query their task list and open the corresponding dynamic task details.
- A sender/admin can submit a real task-create request with no invented fields.
- A sender/admin can manage the device ledger through the existing endpoint without putting a secret into Web state or claiming a direct task-field write is a binding.
- Existing Mock MVP remains usable.
- The detailed cross-client handoff document identifies all work that cannot be truthfully completed by PC Web alone.
