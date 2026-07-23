# Backend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the competition-demo backend MVP for authentication, task lifecycle, device telemetry, heartbeat, and trace report compatibility.

**Architecture:** Keep the current FastAPI + SQLite single-file MVP structure and avoid a risky module split during active team integration. Preserve legacy hardware endpoints while adding official `/api/v1/*` endpoints for Web and mobile clients.

**Tech Stack:** Python, FastAPI, SQLite, Uvicorn, pytest.

## Global Constraints

- Do not modify hardware, Web, or mini-program code.
- Keep `POST /api/device/data` compatible with the running development board.
- Keep official Web/mobile response format as `{code: 0, message, data}`.
- Do not implement full QR code, face recognition, PDF, file upload, or HMAC security in this MVP.
- Use tests before implementation.

---

### Task 1: Auth Refresh

**Files:**
- Modify: `/Users/zy/Downloads/竞赛/物联网设计大赛/code/backend/test_api.py`
- Modify: `/Users/zy/Downloads/竞赛/物联网设计大赛/code/backend/main.py`

**Interfaces:**
- Consumes: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- Produces: `POST /api/v1/auth/refresh`

- [ ] Write a failing test that logs in, refreshes the token, verifies the new token works, and verifies the old token is revoked.
- [ ] Run `python -m pytest test_api.py::test_v1_auth_refresh_rotates_token -v` and confirm it fails.
- [ ] Implement `POST /api/v1/auth/refresh`.
- [ ] Run the targeted test and then the full backend test suite.

### Task 2: Arrive State

**Files:**
- Modify: `/Users/zy/Downloads/竞赛/物联网设计大赛/code/backend/test_api.py`
- Modify: `/Users/zy/Downloads/竞赛/物联网设计大赛/code/backend/main.py`

**Interfaces:**
- Consumes: `POST /api/v1/tasks/{task_id}/start`
- Produces: `POST /api/v1/tasks/{task_id}/arrive`

- [ ] Write a failing test proving a task can move from `in_transit` to `arrived`, then be signed.
- [ ] Run the targeted test and confirm it fails.
- [ ] Implement `POST /api/v1/tasks/{task_id}/arrive`.
- [ ] Run the targeted test and full suite.

### Task 3: Official Device MVP Endpoints

**Files:**
- Modify: `/Users/zy/Downloads/竞赛/物联网设计大赛/code/backend/test_api.py`
- Modify: `/Users/zy/Downloads/竞赛/物联网设计大赛/code/backend/main.py`

**Interfaces:**
- Consumes: existing `DeviceDataIn` and legacy `POST /api/device/data`
- Produces: `POST /api/v1/device/telemetry`, `POST /api/v1/device/heartbeat`

- [ ] Write a failing test that posts telemetry to `/api/v1/device/telemetry` and confirms latest data updates.
- [ ] Write a failing test that posts heartbeat and confirms heartbeat data is returned.
- [ ] Run targeted tests and confirm they fail.
- [ ] Implement telemetry as a unified-response wrapper around the existing insert path.
- [ ] Implement heartbeat table and endpoint.
- [ ] Run targeted tests and full suite.

### Task 4: README MVP Contract

**Files:**
- Modify: `/Users/zy/Downloads/竞赛/物联网设计大赛/code/backend/README.md`

**Interfaces:**
- Documents the endpoints implemented in Tasks 1-3.

- [ ] Update README with the MVP endpoint list and example curl commands.
- [ ] Run `python -m pytest test_api.py -q` and `python3 -m py_compile main.py`.
