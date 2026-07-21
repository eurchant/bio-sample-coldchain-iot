# Web 管理端增强功能 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不修改后端契约的前提下，为 TASK-001 管理端补齐演示身份登录、单任务实时大屏、打印/保存 PDF 与可接入 GNSS 的地图轨迹入口。

**Architecture:** 认证只保存前端演示身份，不发送或保存密码、Token；路由守卫和菜单仅用于演示体验，后端仍是操作状态的最终校验方。大屏、报告和路线页复用既有 Pinia 任务数据源；地图只渲染契约已提供的轨迹点，当前无定位数据时展示明确空态和需要的字段，避免把示意信息冒充真实坐标。

**Tech Stack:** Vue 3、TypeScript、Pinia、Vue Router、Vitest、现有原生 CSS/SVG 与浏览器打印能力。

---

### Task 1: 演示身份与路由边界

**Files:**
- Create: `web-admin/src/stores/auth.ts`
- Create: `web-admin/src/stores/auth.spec.ts`
- Create: `web-admin/src/views/LoginView.vue`
- Modify: `web-admin/src/router/index.ts`
- Modify: `web-admin/src/App.vue`

**Step 1: Write the failing test**

测试演示角色可写入 sessionStorage、恢复并退出；未登录访问受保护路由会返回登录页。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- auth.spec.ts`
Expected: FAIL，因为身份 store 与登录路由尚不存在。

**Step 3: Write minimal implementation**

创建只有 `admin`、`sender`、`carrier`、`receiver` 的演示身份 store；登录页明确标注“非后端认证”，不采集密码。给受保护路由添加守卫，侧栏按角色显示入口，并提供退出按钮。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- auth.spec.ts`
Expected: PASS。

**Step 5: Commit**

```bash
git add web-admin/src/stores/auth.ts web-admin/src/stores/auth.spec.ts web-admin/src/views/LoginView.vue web-admin/src/router/index.ts web-admin/src/App.vue
git commit -m "feat: 增加演示身份登录入口"
```

### Task 2: 轨迹数据适配与地图空态

**Files:**
- Create: `web-admin/src/lib/route.ts`
- Create: `web-admin/src/lib/route.spec.ts`
- Create: `web-admin/src/views/TaskMapView.vue`
- Modify: `web-admin/src/router/index.ts`
- Modify: `web-admin/src/App.vue`

**Step 1: Write the failing test**

测试所有后端任务状态都映射到稳定的交接进度；无轨迹点时返回空数组和“定位数据未接入”状态。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- route.spec.ts`
Expected: FAIL，因为路线工具尚不存在。

**Step 3: Write minimal implementation**

创建仅消费定位点的适配器，不给 `Telemetry` 自行添加经纬度字段。地图页用真实任务名称、交接节点和状态展示非地理交接进度，同时明确显示当前契约未提供 GNSS 数据的地图空态与所需字段。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- route.spec.ts`
Expected: PASS。

**Step 5: Commit**

```bash
git add web-admin/src/lib/route.ts web-admin/src/lib/route.spec.ts web-admin/src/views/TaskMapView.vue web-admin/src/router/index.ts web-admin/src/App.vue
git commit -m "feat: 增加轨迹地图展示入口"
```

### Task 3: TASK-001 全屏实时大屏

**Files:**
- Create: `web-admin/src/lib/metrics.ts`
- Create: `web-admin/src/lib/metrics.spec.ts`
- Create: `web-admin/src/views/DashboardView.vue`
- Modify: `web-admin/src/router/index.ts`
- Modify: `web-admin/src/App.vue`
- Modify: `web-admin/src/style.css`

**Step 1: Write the failing test**

测试历史记录按时间升序组成趋势数据、无遥测时返回可展示的空指标、告警统计复用后端数组。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- metrics.spec.ts`
Expected: FAIL，因为大屏指标工具尚不存在。

**Step 3: Write minimal implementation**

构建单任务大屏：任务状态、环境指标、温湿度 SVG 趋势、告警、交接节点和数据源/断网提示；通过浏览器 Fullscreen API 进入/退出全屏。只使用已有 TASK-001 查询结果，不显示“全网”或虚构总量。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- metrics.spec.ts`
Expected: PASS。

**Step 5: Commit**

```bash
git add web-admin/src/lib/metrics.ts web-admin/src/lib/metrics.spec.ts web-admin/src/views/DashboardView.vue web-admin/src/router/index.ts web-admin/src/App.vue web-admin/src/style.css
git commit -m "feat: 增加TASK-001实时大屏"
```

### Task 4: 追溯报告 PDF 导出体验

**Files:**
- Create: `web-admin/src/lib/reportExport.ts`
- Create: `web-admin/src/lib/reportExport.spec.ts`
- Modify: `web-admin/src/views/TraceReportView.vue`
- Modify: `web-admin/src/style.css`
- Modify: `web-admin/README.md`

**Step 1: Write the failing test**

测试导出文件名由实际任务编号与报告更新时间组成，且导出动作调用浏览器打印能力。

**Step 2: Run test to verify it fails**

Run: `pnpm test -- reportExport.spec.ts`
Expected: FAIL，因为导出工具尚不存在。

**Step 3: Write minimal implementation**

将既有打印入口升级为“打印 / 保存 PDF”，动态设置页面标题并调用 `window.print()`；保留打印 CSS，使浏览器的“另存为 PDF”直接得到任务、统计、交接和告警报告。

**Step 4: Run test to verify it passes**

Run: `pnpm test -- reportExport.spec.ts`
Expected: PASS。

**Step 5: Commit**

```bash
git add web-admin/src/lib/reportExport.ts web-admin/src/lib/reportExport.spec.ts web-admin/src/views/TraceReportView.vue web-admin/src/style.css web-admin/README.md
git commit -m "feat: 支持追溯报告保存为PDF"
```

### Task 5: 回归、可视化验证与交付

**Files:**
- Modify: `web-admin/docs/API_INTEGRATION_ISSUES.md`
- Modify: `web-admin/docs/VERIFICATION.md`
- Create: `web-admin/docs/evidence/` 中的增强功能截图

**Step 1: Run focused tests**

Run: `pnpm test`
Expected: 所有原有与新增 Vitest 测试通过。

**Step 2: Build and pre-commit check**

Run: `pnpm build` and `pnpm check:commit`
Expected: TypeScript、构建和敏感文件检查通过。

**Step 3: Browser verification**

使用 Mock 模式验证登录跳转、角色菜单、地图空态、大屏全屏、PDF 打印入口与窄屏响应式；保存关键截图。确认真实 API 模式不会把 Mock/GNSS 示意数据冒充真实数据。

**Step 4: Record interface dependencies**

在联调清单中写明：正式认证、GNSS 轨迹、直接下载 PDF 与多任务统计均需要后端新增契约；这些不是 TASK-001 MVP 阻塞项。

**Step 5: Commit and push**

```bash
git add docs/plans web-admin
git commit -m "feat: 完成Web管理端展示增强"
git push origin tkx
```

在现有正确 PR `erchuan61:tkx → eurchant:tkx` 中核对差异后提交验收说明。
