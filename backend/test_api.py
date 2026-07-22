import os
from pathlib import Path
import tempfile

os.environ["DATABASE_PATH"] = tempfile.NamedTemporaryFile(delete=False).name

import pytest
from fastapi.testclient import TestClient

from main import DATABASE_PATH, app, init_db


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_test_database():
    path = Path(DATABASE_PATH)
    if path.exists():
        path.unlink()
    init_db()
    yield


def test_post_latest_history_and_events():
    normal_payload = {
        "device_id": "uniknect-001",
        "task_id": "task-demo",
        "temperature": 4.2,
        "humidity": 62.5,
        "light_raw": 120,
        "box_status": "CLOSED",
        "move_status": "STABLE",
        "temp_status": "NORMAL",
        "acc_total": 1.01,
        "motion_score": 0.2,
    }
    alert_payload = {
        **normal_payload,
        "temperature": 9.8,
        "humidity": 64.0,
        "light_raw": 3500,
        "box_status": "BOX_OPEN",
        "move_status": "IMPACT",
        "temp_status": "TEMP_ALERT",
        "acc_total": 2.8,
        "motion_score": 8.9,
    }

    response = client.post("/api/device/data", json=normal_payload)
    assert response.status_code == 200
    assert response.json()["ok"] is True

    response = client.post("/api/device/data", json=alert_payload)
    assert response.status_code == 200
    created = response.json()
    assert created["ok"] is True
    assert created["data"]["event_type"] == "SEVERE"

    latest = client.get("/api/device/latest")
    assert latest.status_code == 200
    assert latest.json()["box_status"] == "BOX_OPEN"

    history = client.get("/api/device/history")
    assert history.status_code == 200
    assert len(history.json()) == 2
    assert history.json()[0]["event_type"] == "SEVERE"
    assert history.json()[0]["event_display"] == "温度异常"
    assert history.json()[1]["event_display"] == "正常"

    events = client.get("/api/device/events")
    assert events.status_code == 200
    assert events.json()[0]["event_type"] == "SEVERE"


def test_task_handoff_and_report():
    current = client.get("/api/task/current")
    assert current.status_code == 200
    assert current.json()["task_id"] == "TASK-001"
    assert current.json()["status"] == "待发出"

    started = client.post("/api/task/start")
    assert started.status_code == 200
    assert started.json()["task"]["status"] == "运输中"
    assert started.json()["task"]["started_at"]

    payload = {
        "device_id": "CLD-001",
        "task_id": "TASK-001",
        "temperature": 31.2,
        "humidity": 66.0,
        "light_raw": 22000,
        "box_status": "BOX_OPEN",
        "move_status": "MILD",
        "temp_status": "TEMP_ALERT",
        "acc_total": 10.2,
        "motion_score": 1.2,
    }
    response = client.post("/api/device/data", json=payload)
    assert response.status_code == 200

    events = client.get("/api/device/events")
    assert events.status_code == 200
    event_names = [item["event_name"] for item in events.json()]
    assert "开箱" in event_names
    assert "轻微晃动" in event_names
    assert "温度异常" in event_names

    current = client.get("/api/task/current")
    assert current.status_code == 200
    assert current.json()["status"] == "运输中"
    assert current.json()["abnormal_count"] > 0

    signed = client.post("/api/task/sign")
    assert signed.status_code == 200
    assert signed.json()["task"]["status"] == "已签收"
    assert signed.json()["task"]["signed_at"]

    report = client.get("/api/task/report")
    assert report.status_code == 200
    body = report.json()
    assert body["task"]["task_id"] == "TASK-001"
    assert body["summary"]["total_records"] >= 1
    assert body["summary"]["event_count"] >= 3
    assert body["latest"]["device_id"] == "CLD-001"


def test_v1_contract_and_task_queries_use_unified_response():
    contracts = client.get("/api/v1/meta/contracts")
    assert contracts.status_code == 200
    body = contracts.json()
    assert body["code"] == 0
    assert body["message"] == "success"
    assert body["data"]["task_statuses"] == [
        "pending_pack",
        "pending_handoff",
        "in_transit",
        "arrived",
        "signed",
        "rejected",
        "canceled",
    ]
    assert "BOX_CLOSED" in body["data"]["box_statuses"]
    assert "TEMP_OK" in body["data"]["temperature_statuses"]

    task = client.get("/api/v1/tasks/TASK-001")
    assert task.status_code == 200
    task_data = task.json()["data"]
    assert task_data["task_id"] == "TASK-001"
    assert task_data["status"] == "pending_pack"
    assert "abnormal_count" in task_data
    assert "latest_temperature" in task_data
    assert "latest_humidity" in task_data

    missing = client.get("/api/v1/tasks/DOES-NOT-EXIST")
    assert missing.status_code == 404
    assert missing.json() == {
        "code": 40401,
        "message": "task not found",
        "data": None,
    }


def test_v1_auth_register_login_me_and_logout():
    register = client.post(
        "/api/v1/auth/register",
        json={
            "username": "receiver_demo",
            "password": "receiver123",
            "role": "receiver",
            "display_name": "接收方演示账号",
        },
    )

    assert register.status_code == 200
    registered_user = register.json()["data"]["user"]
    assert registered_user["user_id"] == 1
    assert registered_user["username"] == "receiver_demo"
    assert registered_user["phone"] == "receiver_demo"
    assert registered_user["role"] == "receiver"
    assert registered_user["display_name"] == "接收方演示账号"
    assert "password" not in register.text

    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "username": "receiver_demo",
            "password": "receiver123",
            "role": "receiver",
        },
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == 40902

    bad_login = client.post(
        "/api/v1/auth/login",
        json={"username": "receiver_demo", "password": "wrong-password"},
    )
    assert bad_login.status_code == 401
    assert bad_login.json()["code"] == 40101

    login = client.post(
        "/api/v1/auth/login",
        json={"username": "receiver_demo", "password": "receiver123"},
    )
    assert login.status_code == 200
    login_data = login.json()["data"]
    assert login_data["token"]
    assert login_data["user"]["username"] == "receiver_demo"
    assert "password" not in login.text

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login_data['token']}"},
    )
    assert me.status_code == 200
    assert me.json()["data"]["username"] == "receiver_demo"
    assert me.json()["data"]["role"] == "receiver"

    permissions = client.get(
        "/api/v1/auth/permissions",
        headers={"Authorization": f"Bearer {login_data['token']}"},
    )
    assert permissions.status_code == 200
    assert "sign_task" in permissions.json()["data"]["permissions"]

    logout = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {login_data['token']}"},
    )
    assert logout.status_code == 200
    assert logout.json()["data"]["logged_out"] is True

    expired_me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login_data['token']}"},
    )
    assert expired_me.status_code == 401


def test_v1_auth_refresh_rotates_token():
    client.post(
        "/api/v1/auth/register",
        json={
            "phone": "receiver_refresh",
            "name": "刷新测试接收方",
            "organization": "市医院检验科",
            "password": "receiver123",
            "role": "receiver",
        },
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"phone": "receiver_refresh", "password": "receiver123"},
    )
    assert login.status_code == 200
    old_token = login.json()["data"]["token"]

    refresh = client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {old_token}"},
    )

    assert refresh.status_code == 200
    new_token = refresh.json()["data"]["token"]
    assert new_token
    assert new_token != old_token

    old_me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {old_token}"},
    )
    assert old_me.status_code == 401

    new_me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert new_me.status_code == 200
    assert new_me.json()["data"]["phone"] == "receiver_refresh"


def register_and_login(username: str, role: str, organization: str = "测试单位"):
    client.post(
        "/api/v1/auth/register",
        json={
            "name": username,
            "phone": username,
            "organization": organization,
            "role": role,
            "password": "password123",
        },
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"phone": username, "password": "password123"},
    )
    assert login.status_code == 200
    return login.json()["data"]["token"], login.json()["data"]["user"]


def test_v1_task_list_is_empty_for_new_sender_and_can_create_task():
    token, user = register_and_login("sender_13800000001", "sender", "高校实验室")
    headers = {"Authorization": f"Bearer {token}"}

    empty_list = client.get("/api/v1/tasks", headers=headers)
    assert empty_list.status_code == 200
    assert empty_list.json()["data"]["items"] == []

    created = client.post(
        "/api/v1/tasks",
        headers={**headers, "Idempotency-Key": "create-task-001"},
        json={
            "sample_name": "血液样本批次 A",
            "batch": "B-20260722-01",
            "receiver": "市医院检验科",
            "carrier": "迅达冷链",
            "expected_arrival": "2026-07-23T10:00:00+08:00",
            "device_id": "CLD-NEW-001",
            "box_id": "BOX-A12",
            "seal_id": "SEAL-8891",
            "temperature_min": 2.0,
            "temperature_max": 8.0,
        },
    )

    assert created.status_code == 200
    task = created.json()["data"]
    assert task["task_id"].startswith("WD-")
    assert task["sample_name"] == "血液样本批次 A"
    assert task["sender"] == user["organization"]
    assert task["status"] == "pending_pack"
    assert task["owner_user_id"] == user["user_id"]

    repeated = client.post(
        "/api/v1/tasks",
        headers={**headers, "Idempotency-Key": "create-task-001"},
        json={
            "sample_name": "不应重复创建",
            "batch": "B-REPEAT",
        },
    )
    assert repeated.status_code == 200
    assert repeated.json()["data"]["task_id"] == task["task_id"]

    task_list = client.get("/api/v1/tasks", headers=headers)
    assert task_list.status_code == 200
    assert [item["task_id"] for item in task_list.json()["data"]["items"]] == [
        task["task_id"]
    ]


def test_v1_task_permission_assign_cancel_and_precheck():
    sender_token, _ = register_and_login("sender_13800000002", "sender", "高校实验室")
    other_token, _ = register_and_login("sender_13800000003", "sender", "其他实验室")
    carrier_token, carrier = register_and_login("carrier_13800000004", "carrier", "迅达冷链")
    receiver_token, receiver = register_and_login(
        "receiver_13800000005", "receiver", "市医院检验科"
    )
    sender_headers = {"Authorization": f"Bearer {sender_token}"}

    created = client.post(
        "/api/v1/tasks",
        headers=sender_headers,
        json={
            "sample_name": "血液样本批次 B",
            "batch": "B-20260722-02",
            "device_id": "CLD-NEW-002",
            "temperature_min": 2.0,
            "temperature_max": 8.0,
        },
    )
    assert created.status_code == 200
    task_id = created.json()["data"]["task_id"]

    forbidden = client.get(
        f"/api/v1/tasks/{task_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden.status_code == 404

    patched = client.patch(
        f"/api/v1/tasks/{task_id}",
        headers=sender_headers,
        json={"sample_name": "血液样本批次 B-修改", "box_id": "BOX-B01"},
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["sample_name"] == "血液样本批次 B-修改"
    assert patched.json()["data"]["box_id"] == "BOX-B01"

    assigned = client.post(
        f"/api/v1/tasks/{task_id}/assign",
        headers=sender_headers,
        json={
            "carrier_user_id": carrier["user_id"],
            "receiver_user_id": receiver["user_id"],
        },
    )
    assert assigned.status_code == 200
    assert assigned.json()["data"]["carrier_user_id"] == carrier["user_id"]
    assert assigned.json()["data"]["receiver_user_id"] == receiver["user_id"]

    carrier_list = client.get(
        "/api/v1/tasks",
        headers={"Authorization": f"Bearer {carrier_token}"},
    )
    assert [item["task_id"] for item in carrier_list.json()["data"]["items"]] == [
        task_id
    ]

    receiver_detail = client.get(
        f"/api/v1/tasks/{task_id}",
        headers={"Authorization": f"Bearer {receiver_token}"},
    )
    assert receiver_detail.status_code == 200

    prechecked = client.post(
        f"/api/v1/tasks/{task_id}/precheck",
        headers=sender_headers,
        json={"passed": True, "temperature": 4.5, "seal_ok": True, "note": "预检通过"},
    )
    assert prechecked.status_code == 200
    assert prechecked.json()["data"]["status"] == "pending_handoff"
    assert prechecked.json()["data"]["precheck_passed"] is True

    cancel_after_precheck = client.post(
        f"/api/v1/tasks/{task_id}/cancel",
        headers=sender_headers,
    )
    assert cancel_after_precheck.status_code == 200
    assert cancel_after_precheck.json()["data"]["status"] == "canceled"


def test_v1_task_identifies_assigned_device():
    response = client.get("/api/v1/tasks/TASK-001")

    assert response.status_code == 200
    assert response.json()["data"]["device_id"] == "CLD-001"


def test_cors_allows_local_web_development():
    response = client.options(
        "/api/v1/tasks/TASK-001",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_device_upload_rejects_mismatched_assigned_device():
    payload = {
        "device_id": "OTHER-DEVICE",
        "task_id": "TASK-001",
        "temperature": 4.2,
        "humidity": 62.5,
        "light_raw": 120,
        "box_status": "BOX_CLOSED",
        "move_status": "STABLE",
        "temp_status": "TEMP_OK",
        "acc_total": 9.81,
        "motion_score": 0.2,
    }

    response = client.post("/api/device/data", json=payload)

    assert response.status_code == 409
    assert response.json() == {
        "ok": False,
        "error": "device does not match task",
    }
    assert client.get("/api/v1/tasks/TASK-001/telemetry/latest").json()["data"] is None


def test_v1_telemetry_and_alarms_are_filtered_and_normalized():
    normal_payload = {
        "device_id": "CLD-001",
        "task_id": "TASK-001",
        "temperature": 4.2,
        "humidity": 62.5,
        "light_raw": 120,
        "box_status": "CLOSED",
        "move_status": "STABLE",
        "temp_status": "NORMAL",
        "acc_total": 9.81,
        "motion_score": 0.2,
    }
    alert_payload = {
        **normal_payload,
        "temperature": 9.8,
        "box_status": "BOX_OPEN",
        "move_status": "IMPACT",
        "temp_status": "TEMP_ALERT",
        "motion_score": 8.9,
    }
    other_task_payload = {**normal_payload, "task_id": "OTHER-TASK"}

    assert client.post("/api/device/data", json=normal_payload).status_code == 200
    assert client.post("/api/device/data", json=alert_payload).status_code == 200
    assert client.post("/api/device/data", json=other_task_payload).status_code == 200

    latest = client.get("/api/v1/tasks/TASK-001/telemetry/latest")
    assert latest.status_code == 200
    latest_data = latest.json()["data"]
    assert latest_data["task_id"] == "TASK-001"
    assert latest_data["box_status"] == "BOX_OPEN"
    assert latest_data["temp_status"] == "TEMP_ALERT"

    history = client.get("/api/v1/tasks/TASK-001/telemetry/history?limit=10")
    assert history.status_code == 200
    history_body = history.json()["data"]
    assert history_body["limit"] == 10
    assert len(history_body["items"]) == 2
    assert history_body["items"][1]["box_status"] == "BOX_CLOSED"
    assert history_body["items"][1]["temp_status"] == "TEMP_OK"

    alarms = client.get("/api/v1/tasks/TASK-001/alarms?limit=10")
    assert alarms.status_code == 200
    alarm_types = {item["event_type"] for item in alarms.json()["data"]["items"]}
    assert {"BOX_OPEN", "IMPACT", "SEVERE", "TEMP_ALERT"}.issubset(alarm_types)

    invalid_limit = client.get("/api/v1/tasks/TASK-001/telemetry/history?limit=101")
    assert invalid_limit.status_code == 422


def test_v1_handoff_state_machine_supports_sign():
    premature_sign = client.post("/api/v1/tasks/TASK-001/sign")
    assert premature_sign.status_code == 409
    assert premature_sign.json()["code"] == 40901

    started = client.post("/api/v1/tasks/TASK-001/start")
    assert started.status_code == 200
    assert started.json()["data"]["status"] == "in_transit"
    assert started.json()["data"]["started_at"]

    signed = client.post("/api/v1/tasks/TASK-001/sign")
    assert signed.status_code == 200
    assert signed.json()["data"]["status"] == "signed"
    assert signed.json()["data"]["signed_at"]

    repeated_sign = client.post("/api/v1/tasks/TASK-001/sign")
    assert repeated_sign.status_code == 409


def test_v1_handoff_state_machine_supports_arrive_before_sign():
    premature_arrive = client.post("/api/v1/tasks/TASK-001/arrive")
    assert premature_arrive.status_code == 409

    started = client.post("/api/v1/tasks/TASK-001/start")
    assert started.status_code == 200

    arrived = client.post("/api/v1/tasks/TASK-001/arrive")
    assert arrived.status_code == 200
    arrived_data = arrived.json()["data"]
    assert arrived_data["status"] == "arrived"
    assert arrived_data["arrived_at"]

    signed = client.post("/api/v1/tasks/TASK-001/sign")
    assert signed.status_code == 200
    assert signed.json()["data"]["status"] == "signed"


def test_v1_handoff_state_machine_supports_reject():
    assert client.post("/api/v1/tasks/TASK-001/start").status_code == 200
    rejected = client.post(
        "/api/v1/tasks/TASK-001/reject",
        json={"reason": "温度异常"},
    )
    assert rejected.status_code == 200
    rejected_data = rejected.json()["data"]
    assert rejected_data["status"] == "rejected"
    assert rejected_data["rejection_reason"] == "温度异常"
    assert rejected_data["rejected_at"]


def test_legacy_task_actions_clear_v1_rejection_state():
    assert client.post("/api/v1/tasks/TASK-001/start").status_code == 200
    assert client.post(
        "/api/v1/tasks/TASK-001/reject",
        json={"reason": "温度异常"},
    ).status_code == 200

    legacy_start = client.post("/api/task/start")
    assert legacy_start.status_code == 200
    assert client.get("/api/v1/tasks/TASK-001").json()["data"]["status"] == "in_transit"

    assert client.post(
        "/api/v1/tasks/TASK-001/reject",
        json={"reason": "箱体异常"},
    ).status_code == 200
    legacy_sign = client.post("/api/task/sign")
    assert legacy_sign.status_code == 200
    assert client.get("/api/v1/tasks/TASK-001").json()["data"]["status"] == "signed"


def test_v1_trace_report_uses_the_same_task_data():
    assert client.post("/api/v1/tasks/TASK-001/start").status_code == 200
    payload = {
        "device_id": "CLD-001",
        "task_id": "TASK-001",
        "temperature": 31.2,
        "humidity": 66.0,
        "light_raw": 22000,
        "box_status": "BOX_OPEN",
        "move_status": "MILD",
        "temp_status": "TEMP_ALERT",
        "acc_total": 10.2,
        "motion_score": 1.2,
    }
    assert client.post("/api/device/data", json=payload).status_code == 200

    report = client.get("/api/v1/tasks/TASK-001/trace-report")
    assert report.status_code == 200
    data = report.json()["data"]
    assert data["task"]["task_id"] == "TASK-001"
    assert data["task"]["status"] == "in_transit"
    assert data["latest"]["device_id"] == "CLD-001"
    assert data["summary"]["total_records"] == 1
    assert data["summary"]["event_count"] >= 3
    assert len(data["events"]) >= 3


def test_v1_trace_report_includes_handoff_nodes():
    assert client.post("/api/v1/tasks/TASK-001/start").status_code == 200
    assert client.post("/api/v1/tasks/TASK-001/sign").status_code == 200

    response = client.get("/api/v1/tasks/TASK-001/trace-report")

    assert response.status_code == 200
    nodes = response.json()["data"]["handoff_nodes"]
    assert [node["type"] for node in nodes] == ["started", "signed"]
    assert all(node["timestamp"] for node in nodes)


def test_v1_device_telemetry_accepts_official_upload_format():
    payload = {
        "device_id": "CLD-001",
        "task_id": "TASK-001",
        "sequence": 1001,
        "captured_at": "2026-07-22T18:50:00+08:00",
        "temperature": 6.2,
        "humidity": 62.5,
        "battery": 86,
        "box_status": "BOX_CLOSED",
        "move_status": "STABLE",
        "light_raw": 120,
        "location": {"lat": 30.123, "lng": 120.456, "accuracy": 20},
    }

    response = client.post("/api/v1/device/telemetry", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    assert body["data"]["saved"] == 1
    assert body["data"]["items"][0]["task_id"] == "TASK-001"
    assert body["data"]["items"][0]["battery"] == 86
    assert body["data"]["items"][0]["lat"] == 30.123

    latest = client.get("/api/v1/tasks/TASK-001/telemetry/latest")
    assert latest.status_code == 200
    assert latest.json()["data"]["temperature"] == 6.2
    assert latest.json()["data"]["timestamp"] == "2026-07-22T18:50:00+08:00"


def test_v1_device_heartbeat_records_online_status():
    response = client.post(
        "/api/v1/device/heartbeat",
        json={
            "device_id": "CLD-001",
            "task_id": "TASK-001",
            "battery": 83,
            "rssi": -71,
            "network": "4G",
            "timestamp": "2026-07-22T18:51:00+08:00",
        },
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["device_id"] == "CLD-001"
    assert data["task_id"] == "TASK-001"
    assert data["status"] == "online"
    assert data["battery"] == 83
    assert data["network"] == "4G"
