# PC Web 路线图状态与实施计划

**Goal:** 按《PC Web 管理端负责人详细任务书》的原始路线图，记录每项任务的当前状态、外部依赖和可独立推进事项，并完成本轮无需后端协作的 Web 增强。

**Architecture:** `web-admin/` 继续只消费既有 API 契约；任务状态、告警判定和追溯结论始终由后端负责。Mock 模式仍以 `TASK-001` 为离线演示对象，API 模式以当前账号授权的动态任务为准；路线图能力按“已完成 / 前端骨架 / 等待契约 / 未开始”透明标记，不能用 Mock、静态坐标或单任务数据冒充正式能力。

**Tech Stack:** Vue 3、TypeScript、Vite、Pinia、Axios、Vitest、Apache ECharts（本轮仅使用已有遥测历史绘制单任务趋势）。

---

## 0. 范围与协作规则

- 责任边界：只修改 `web-admin/`、文档与前端依赖；不修改 `backend/`、`miniprogram/`、接口字段、状态枚举或设备上报格式。
- 当前分支：`tkx`；本轮完成本地提交但不推送，后续如需推送仅允许目标为个人 fork 的 `origin/tkx`，不创建上游仓库 Pull Request。
- 数据边界：保留 `VITE_DATA_SOURCE=mock|api` 切换；生产联调只通过组长提供的 `VITE_API_BASE_URL`，不提交 `.env.local`、Token、密码、数据库或运行缓存。
- 术语：**已完成** 指当前已有契约内可验证的能力；**骨架** 指 UI/前端逻辑存在但不能替代服务端能力；**等待契约** 指必须先由后端/设备/小程序交付数据或规则。

## 1. 当前验收基线

| 项目 | 当前结论 | 验证/限制 |
| --- | --- | --- |
| 分支 | `tkx`，已本地合并 `upstream/zy`（`2fc2aeb`） | 本轮不推送，不操作 upstream。 |
| 自动化测试 | 52 项通过 | 覆盖状态映射、轮询失败恢复、签收更新、按钮限制、正式会话、任务列表、GNSS 轨迹、设备台账/绑定历史、主题、趋势、统一状态面板与打印入口。 |
| 生产构建 | 通过 | `pnpm build` 已执行。 |
| 当前联调范围 | Mock：`TASK-001`；API：当前账号授权任务 | 本机 API 已冒烟覆盖正式登录、任务创建和设备绑定；远程联调地址仍待组长提供。 |

## 2. 原路线图状态

### MVP 必做（第一阶段）

| 编号 | 原任务 | 当前状态 | 说明与下一步 |
| --- | --- | --- | --- |
| M1 | Vue 3 + TS + Vite、布局、路由、Axios、环境变量、简化登录入口 | 已完成 | `web-admin/`、`.env.example`、Mock/API 网关和演示身份均已具备。 |
| M2 | 任务列表、TASK-001 详情、样本/设备/人员摘要、状态时间线 | 部分完成（按单任务 MVP 可验收） | 详情、摘要、时间线已完成；当前契约没有 `GET /api/v1/tasks`，所以不把单任务入口称作正式多任务列表。 |
| M3 | 实时温湿度、箱体、运动、状态、最近记录、3–5 秒刷新、断网提示 | 已完成 | 使用现有任务、遥测、历史、告警接口；保留最近成功数据并自动恢复轮询。 |
| M4 | 异常列表/时间线、发出与签收操作及反馈 | 已完成 | 已接现有 `start/sign/reject`；前端不推断状态机，Mock 禁止写操作。 |
| M5 | 任务摘要、监测统计、交接节点、异常、最终状态的屏幕追溯报告 | 已完成 | 数据来自现有 `trace-report`，可供比赛投屏。 |

### 第二阶段

| 原任务 | 当前状态 | 阻塞或说明 |
| --- | --- | --- |
| 正式登录、角色菜单 | 演示骨架 | 菜单/路由可按演示角色限制；缺登录、会话/JWT、用户资料、服务端 RBAC 和 401/403 契约。 |
| 样本管理 | 未开始 | 缺样本模型与 CRUD/列表接口。 |
| 任务创建编辑 | 未开始 | 缺任务创建、更新、列表与权限接口。 |
| 设备管理 | 未开始 | 缺设备台账、绑定编辑、在线状态与管理接口。 |
| 告警处理备注 | 未开始 | 缺处理状态、处理人、备注字段及写入接口。 |
| 交接记录详情 | 前端展示骨架 | 已有交接时间线/追溯节点；缺独立详情、交接人、签名、备注、附件、审核字段与接口。 |

### 第三阶段

| 原任务 | 当前状态 | 本轮处理方式 |
| --- | --- | --- |
| 完整数据驾驶舱 | 单任务骨架 | 现有 `/screen` 只显示 `TASK-001`，不能冒充多任务运营统计。 |
| ECharts 趋势与分布 | 已完成单任务趋势 | 使用已有遥测历史实现温湿度趋势；分布图和全局指标等待多任务/聚合接口。 |
| 搜索分页 | 未开始 | 等待任务列表接口。 |
| 批量操作 | 未开始 | 等待列表、选择集合、批量操作和权限接口。 |
| 细化空状态和异常恢复 | 已完成单任务页面增强 | 已有轮询断网恢复；本轮统一单任务页面的加载、空、断网和可重试反馈。 |

### 展示增强

| 原任务 | 当前状态 | 本轮处理方式 |
| --- | --- | --- |
| 地图轨迹 | 交接路径骨架 | 当前明确显示 GNSS 缺失；真实地图需 `latitude`、`longitude`、`timestamp`、轨迹接口和地图服务决策。 |
| PDF 导出 | 浏览器打印/保存 PDF | 已实现当前追溯页打印；后端正式生成、下载、签章或归档仍等待新契约。 |
| 主题切换 | 已完成 | 仅影响客户端呈现，持久化到浏览器，不改变业务数据。 |
| 全屏大屏 | 已完成（单任务） | 已使用 Fullscreen API；不称为完整运营大屏。 |
| 更多动画 | 本轮实现克制动效 | 仅增强信息层级，尊重 `prefers-reduced-motion`，不能影响监控读数。 |
| 可配置看板 | 未开始 | 需要看板配置模型、持久化规则及完整数据源。 |

## 后续状态更新：合并 `zy` 后（2026-07-23）

本节以 `tkx` 当前工作区为准，覆盖本文件上方 2026-07-21 的“接口尚未提供”结论。详细跨端依赖见 `docs/handoffs/2026-07-23-cross-client-integration-and-backend-requests.md`。

| 路线图阶段 | 任务 | 当前状态 | 真实边界 |
| --- | --- | --- | --- |
| MVP | 任务列表、动态任务详情 | 已完成 | API 模式从 `GET /tasks` 读取当前账号授权任务；不再固定访问 `TASK-001`。 |
| MVP | 实时监控、状态轮询、故障恢复 | 已完成 | 只轮询当前打开任务，保留最近成功数据；最终状态由后端返回。 |
| MVP | 发出、签收、拒收、追溯 | 已完成 | 写操作带幂等键；报告支持后端 PDF 下载和浏览器打印降级。 |
| 第二阶段 | 正式登录、角色菜单 | 已完成 | 接 `/auth/login/me/permissions/logout`；Token 仅保存当前浏览器会话，401 自动清会话。 |
| 第二阶段 | 任务创建与编辑 | 已完成 | 只提交后端定义字段；发货方/管理员可见入口，后端仍决定归属与状态。 |
| 第二阶段 | 样本管理 | 等待后端 | 当前只有任务内 `sample_name/batch`，没有独立样本模型或 CRUD。 |
| 第二阶段 | 设备管理 | 已完成基础能力 | 已接设备台账、登记、绑定、解绑和绑定历史；真实在线/低电量依赖硬件正式遥测/心跳，设备密钥、授权和绑定事务问题见 B-10。 |
| 第二阶段 | 告警处置备注 | 可继续，但未完成 | 后端已有 ACK/resolve 基础接口，仍需权限矩阵和处置状态契约。 |
| 第二阶段 | 交接记录详情 | 等待后端 | 缺按任务列出完整 handoff 会话及 QR/人脸/证据原子校验。 |
| 第三阶段 | 搜索与分页 | 已完成 | 使用后端 `status/keyword/page/page_size`。 |
| 第三阶段 | 完整驾驶舱、全局趋势/分布 | 等待后端聚合 | 现有大屏仍是单任务真实数据屏，不能称为全局运营驾驶舱。 |
| 第三阶段 | 批量操作 | 等待后端 | 缺批量操作契约、部分失败结果和权限规则。 |
| 展示增强 | 地图轨迹 | 已完成数据适配 | 历史遥测有真实 `lat/lng/accuracy` 时显示相对轨迹；底图服务和真实硬件定位仍是外部依赖。 |
| 展示增强 | PDF | 已完成 | 使用 `/trace-report.pdf` 下载，浏览器打印保留为降级方案。 |
| 展示增强 | 主题、全屏、单任务 ECharts | 已完成 | 均只展示真实当前任务返回数据。 |

本次新增验证：前端单元测试覆盖会话安全、任务目录筛选/创建幂等键、动态任务加载和 GNSS 轨迹不补造点；生产构建通过。后端 API 冒烟联调已覆盖注册、登录、授权任务查询、创建、详情、筛选和退出。后端完整 pytest 的 Windows SQLite 文件锁问题已写入交接清单，待后端修复。

## 3. 本轮独立实施任务

### Task 1: 路线图与状态文档

**Files:**
- Create: `docs/plans/2026-07-21-pc-web-roadmap-status-and-execution.md`
- Modify: `web-admin/README.md`

**Step 1:** 记录 MVP、第二阶段、第三阶段、展示增强的逐项状态和外部依赖。

**Step 2:** 记录本轮只推送 `origin/tkx`、不创建上游 PR 的交付边界。

**Step 3:** 在 README 链接该计划，避免把演示能力写成正式能力。

### Task 2: 客户端主题切换

**Files:**
- Create: `web-admin/src/lib/theme.ts`
- Create: `web-admin/src/lib/theme.spec.ts`
- Create: `web-admin/src/components/ThemeToggle.vue`
- Modify: `web-admin/src/App.vue`
- Modify: `web-admin/src/style.css`

**Step 1: Write the failing test**

测试“系统偏好、已保存主题、切换、持久化和 DOM `data-theme` 同步”的纯函数/适配层。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- theme.spec.ts`
Expected: FAIL，因为主题模块尚不存在。

**Step 3: Write minimal implementation**

实现 `light`、`dark`、`system` 三种偏好，默认跟随系统；只保存显示偏好，不保存账号或业务数据。根元素使用 `data-theme`，CSS 使用变量覆盖主背景、文字、面板、边框和交互色。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- theme.spec.ts`
Expected: PASS。

**Step 5: Commit**

纳入本轮功能提交；提交信息使用 `feat: 完善Web主题与单任务趋势展示`。

### Task 3: ECharts 单任务温湿度趋势

**Files:**
- Modify: `web-admin/package.json`
- Modify: `web-admin/pnpm-lock.yaml`
- Create: `web-admin/src/lib/telemetryChart.ts`
- Create: `web-admin/src/lib/telemetryChart.spec.ts`
- Create: `web-admin/src/components/TelemetryTrendChart.vue`
- Modify: `web-admin/src/views/DashboardView.vue`
- Modify: `web-admin/src/style.css`

**Step 1: Write the failing test**

用当前 `Telemetry[]` 样例测试：按时间排序、保留温度/湿度、空记录返回空系列；不生成任何补点或伪造数据。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- telemetryChart.spec.ts`
Expected: FAIL，因为趋势数据适配模块尚不存在。

**Step 3: Write minimal implementation**

安装并按需导入 Apache ECharts；组件用固定高度容器、`ResizeObserver`、卸载时 `dispose()`。数据只来自 store 中的当前任务历史记录，缺数据时显示明确空态。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- telemetryChart.spec.ts`
Expected: PASS。

**Step 5: Commit**

纳入本轮功能提交；不增加全局统计、分布图或未约定字段。

### Task 4: 单任务状态反馈与动效

**Files:**
- Create: `web-admin/src/components/AsyncStatePanel.vue`
- Create: `web-admin/src/components/AsyncStatePanel.spec.ts`
- Modify: `web-admin/src/views/OverviewView.vue`
- Modify: `web-admin/src/views/TaskDetailView.vue`
- Modify: `web-admin/src/views/TraceReportView.vue`
- Modify: `web-admin/src/views/TaskMapView.vue`
- Modify: `web-admin/src/views/DashboardView.vue`
- Modify: `web-admin/src/style.css`

**Step 1: Write the failing test**

覆盖 loading、empty、offline、error 四种视觉状态与“重试”事件；断网状态保留已有读数，不能清空成功数据。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- AsyncStatePanel.spec.ts`
Expected: FAIL，因为组件尚不存在。

**Step 3: Write minimal implementation**

建立可复用状态面板，替换页面中可替换的重复结构；为首屏、卡片和图表使用克制的进入动效，并在 `prefers-reduced-motion` 下关闭非必要动效。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- AsyncStatePanel.spec.ts`
Expected: PASS。

**Step 5: Commit**

纳入本轮功能提交；不改变轮询间隔、API 契约、状态枚举或任务操作权限。

### Task 5: 验证、文档和个人 fork 推送

**Files:**
- Modify: `web-admin/README.md`
- Modify: `web-admin/docs/VERIFICATION.md`

**Step 1:** 运行 `pnpm test`、`pnpm build`、`pnpm check:commit`。

**Step 2:** 用 Mock 数据检查亮/暗主题、趋势空态、趋势有数据、断网恢复；在本机浏览器完成关键画面验收。既有 `web-admin/docs/evidence/` 中的 MVP 关键截图继续保留。

**Step 3:** 执行敏感文件检查，确保没有 `.env`、密码、Token、数据库、虚拟环境、缓存和临时代码进入暂存区。

**Step 4:** 检查提交内容后，使用 `git push origin tkx` 推送个人 fork；不调用 GitHub PR 创建接口，不向 `upstream` 推送。

## 4. 本轮完成定义

- 路线图文档能让团队清楚看到每项任务、当前状态、边界和依赖。
- 用户可以在应用壳中切换亮色、暗色、跟随系统主题，刷新后偏好仍保留。
- `/screen` 使用已有 `TASK-001` 遥测历史显示真实温湿度趋势；无记录时有空态，断网时保留最后成功数据。
- 单任务页面的加载、空、断网和重试路径一致；动效不影响无障碍和数据可读性。
- 全量测试、生产构建和敏感文件检查通过；变更只出现在个人 `origin/tkx` 分支。

## 5. 本轮实施结果（2026-07-21）

| 事项 | 结果 |
| --- | --- |
| 路线图文档 | 已创建本文件，并在 `web-admin/README.md` 链接；逐项标注了可交付状态、外部依赖与禁止伪造的数据边界。 |
| 客户端主题 | 已实现浅色、深色、跟随系统与本地显示偏好保存；不影响认证、接口或业务状态。 |
| 单任务 ECharts | 已在 `/screen` 按需加载 Apache ECharts，使用已有 `TASK-001` 遥测历史。单条记录显示真实点位，不补造数据；图表卸载时释放实例并响应尺寸/主题变化。 |
| 单任务状态反馈 | 已创建可复用状态面板并接入总览、详情、路线、追溯与大屏的加载/空态/断网/错误重试路径；保留已有轮询恢复行为。 |
| 可访问性与动效 | 已为主题控制和状态面板提供语义/状态信息；新增动效遵循 `prefers-reduced-motion`。 |
| 验证与交付 | 已完成本机 Mock 浏览器验收；自动化测试、构建和提交前检查将在提交前再次执行。仅允许推送 `origin/tkx`，不创建上游 PR。 |
