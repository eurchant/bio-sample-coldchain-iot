# Web B-01～B-10 Contract Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the PC Web admin client with backend `main` commit `8a4441d`, so that task preparation, QR-backed handoff, evidence files, dashboard aggregation, and permission feedback use the formal API rather than mock-only behavior.

**Architecture:** Keep HTTP contract code in `services/api.ts`; keep request state and mutations in focused Pinia stores; compose task preparation and handoff UI from reusable task-detail components. The dashboard consumes its dedicated aggregation endpoint and does not infer aggregate figures from one task.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vue Router, Axios, Vitest.

---

## Scope and contract baseline

- Base URL remains configurable with `VITE_API_BASE_URL`; no production host, token, or competition data is written to source.
- The source of truth is `docs/api/API_CONTRACT.md` and `docs/api/FRONTEND_HANDOFF.md` from backend commit `8a4441d`.
- `401`, `403`, `404`, `40902`, `40932`, `40933`, and `429` receive actionable Chinese feedback. The server remains the authority for every permission and status transition.
- QR tokens are displayed only transiently to the authorized issuer and are never persisted, logged, or committed.

## Implementation tasks

### 1. Extend TypeScript contracts and API gateways

**Files:** `web-admin/src/types/contracts.ts`, `web-admin/src/services/api.ts`

1. Add typed request/response models for candidate users, task assignment, precheck, handoffs, QR evidence, files, and dashboard summary.
2. Add gateway methods for the formal B-01～B-10 endpoints, including multipart upload and authenticated blob download.
3. Centralize safe error-to-user-message mapping without weakening backend authorization checks.

### 2. Prepare a task before it is started

**Files:** `web-admin/src/stores/taskPreparation.ts`, `web-admin/src/components/TaskPreparationPanel.vue`, `web-admin/src/views/TaskDetailView.vue`

1. Load carrier/receiver candidates through `GET /api/v1/users` only for sender/admin users.
2. Assign carrier and receiver through the official task assignment endpoint.
3. Submit the packing precheck and make the server’s `40902` prerequisite visible before a start attempt.

### 3. Build the handoff ledger and real evidence file flow

**Files:** `web-admin/src/stores/handoff.ts`, `web-admin/src/components/HandoffLedger.vue`, `web-admin/src/views/TaskDetailView.vue`

1. Render `GET /tasks/{id}/handoffs` with from/to users, status, and evidence summary.
2. Support authorized creation, QR token issuance, receiving-side verification, confirmation, and rejection through the exact handoff endpoints.
3. Upload JPEG/PNG/PDF files with client-side type/size checks and SHA-256; attach them to a handoff with `related_type=handoff`.
4. Download evidence through an authenticated blob request, never a public URL.

### 4. Use the real admin aggregation endpoint on the large screen

**Files:** `web-admin/src/stores/dashboard.ts`, `web-admin/src/views/DashboardView.vue`

1. Replace single-task inferred totals with `GET /api/v1/dashboard/summary`.
2. Refresh while the view is open, present last-updated time and recovery guidance after a request failure.
3. Retain full-screen presentation and clearly explain access is restricted to administrators.

### 5. Permission feedback, tests, and verification

**Files:** `web-admin/src/App.vue`, `web-admin/src/router/index.ts`, relevant `*.spec.ts`

1. Show a clear notice when route access is denied and retain existing safe logout behavior for `401`.
2. Add minimum unit coverage for error mapping, task preparation constraints, handoff state refresh, file validation, and dashboard failure recovery.
3. Run `pnpm test` and `pnpm build`; run API smoke checks only against a local backend with an explicit local base URL.

## Acceptance checklist

- A sender/admin can assign both parties and complete a precheck; a failed prerequisite is explained rather than guessed.
- A handoff shows live status after QR verification/confirmation and can carry a real uploaded evidence file.
- A file type, size, or network failure is clear and retryable; files use authenticated download.
- The `/screen` route shows server-provided aggregate data, refreshes, and explains a forbidden or failed request.
- No `.env`, token, database, virtual environment, cache, or temporary artifact is included in the commit.
