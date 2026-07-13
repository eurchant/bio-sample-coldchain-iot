from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", BASE_DIR / "device_data.db"))
CORS_ORIGIN_REGEX = os.environ.get(
    "CORS_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
)

DEMO_TASK = {
    "task_id": "TASK-001",
    "device_id": "CLD-001",
    "sample_name": "生物样本转运箱 A",
    "sender": "高校实验室",
    "receiver": "医院检验科",
    "carrier": "演示人员",
}

TASK_STATUSES = [
    "pending_pack",
    "pending_handoff",
    "in_transit",
    "arrived",
    "signed",
    "rejected",
    "canceled",
]
BOX_STATUSES = ["BOX_OPEN", "BOX_CLOSED"]
MOVE_STATUSES = ["STABLE", "MILD", "SEVERE", "IMPACT", "FREE_FALL"]
TEMPERATURE_STATUSES = ["TEMP_OK", "TEMP_ALERT"]


class DeviceDataIn(BaseModel):
    device_id: str = Field(..., examples=["CLD-001"])
    task_id: str = Field(..., examples=["TASK-001"])
    temperature: float
    humidity: float
    light_raw: int
    box_status: str
    move_status: str
    temp_status: str
    acc_total: float
    motion_score: float
    timestamp: Optional[str] = None


class RejectTaskIn(BaseModel):
    reason: str = Field(..., min_length=1, max_length=200)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def init_db() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS device_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                temperature REAL NOT NULL,
                humidity REAL NOT NULL,
                light_raw INTEGER NOT NULL,
                box_status TEXT NOT NULL,
                move_status TEXT NOT NULL,
                temp_status TEXT NOT NULL,
                acc_total REAL NOT NULL,
                motion_score REAL NOT NULL,
                event_type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS task_handoff (
                task_id TEXT PRIMARY KEY,
                device_id TEXT,
                sample_name TEXT NOT NULL,
                sender TEXT NOT NULL,
                receiver TEXT NOT NULL,
                carrier TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT,
                signed_at TEXT,
                rejected_at TEXT,
                rejection_reason TEXT,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS event_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data_id INTEGER,
                task_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_name TEXT NOT NULL,
                event_detail TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        ensure_column(conn, "task_handoff", "device_id", "TEXT")
        ensure_column(conn, "task_handoff", "rejected_at", "TEXT")
        ensure_column(conn, "task_handoff", "rejection_reason", "TEXT")
        ensure_demo_task(conn)


def ensure_column(
    conn: sqlite3.Connection,
    table_name: str,
    column_name: str,
    column_type: str,
) -> None:
    columns = {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in columns:
        conn.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
        )


def ensure_demo_task(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        "SELECT task_id, device_id FROM task_handoff WHERE task_id = ?",
        (DEMO_TASK["task_id"],),
    ).fetchone()
    if row:
        if not row["device_id"]:
            conn.execute(
                """
                UPDATE task_handoff
                SET device_id = ?
                WHERE task_id = ?
                """,
                (DEMO_TASK["device_id"], DEMO_TASK["task_id"]),
            )
        return

    conn.execute(
        """
        INSERT INTO task_handoff (
            task_id, device_id, sample_name, sender, receiver, carrier,
            status, started_at, signed_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            DEMO_TASK["task_id"],
            DEMO_TASK["device_id"],
            DEMO_TASK["sample_name"],
            DEMO_TASK["sender"],
            DEMO_TASK["receiver"],
            DEMO_TASK["carrier"],
            "待发出",
            None,
            None,
            now_iso(),
        ),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Cold Chain Traceability Backend",
    version="0.2.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def detect_event(data: DeviceDataIn) -> str:
    box_status = data.box_status.upper()
    move_status = data.move_status.upper()
    temp_status = data.temp_status.upper()
    active_events = [
        box_status == "BOX_OPEN",
        temp_status == "TEMP_ALERT",
        move_status in {"IMPACT", "FREE_FALL"},
    ]

    if temp_status == "SEVERE" or move_status == "SEVERE" or sum(active_events) >= 2:
        return "SEVERE"
    if move_status == "FREE_FALL":
        return "FREE_FALL"
    if move_status == "IMPACT":
        return "IMPACT"
    if move_status == "SEVERE":
        return "SEVERE"
    if temp_status == "TEMP_ALERT":
        return "TEMP_ALERT"
    if box_status == "BOX_OPEN":
        return "BOX_OPEN"
    return "NORMAL"


def build_event_items(data: DeviceDataIn, event_type: str) -> list[tuple[str, str, str]]:
    events = []
    box_status = data.box_status.upper()
    move_status = data.move_status.upper()
    temp_status = data.temp_status.upper()

    if box_status == "BOX_OPEN":
        events.append(("BOX_OPEN", "开箱事件", "光敏检测到箱体疑似打开"))
    if move_status == "MILD":
        events.append(("MILD", "轻微晃动", "三轴加速度检测到轻微晃动"))
    if move_status == "SEVERE":
        events.append(("SEVERE", "剧烈晃动", "三轴加速度检测到剧烈晃动"))
    if move_status == "IMPACT":
        events.append(("IMPACT", "疑似碰撞", "三轴加速度检测到疑似碰撞"))
    if move_status == "FREE_FALL":
        events.append(("FREE_FALL", "疑似跌落", "三轴加速度检测到疑似自由落体"))
    if temp_status == "TEMP_ALERT":
        events.append(("TEMP_ALERT", "温度异常", "温度超出当前演示阈值"))

    if event_type == "SEVERE" and len(events) >= 2:
        events.append(("SEVERE", "综合严重异常", "同一条数据触发多个异常条件"))

    return events


def insert_event_logs(
    conn: sqlite3.Connection,
    data_id: int,
    data: DeviceDataIn,
    event_type: str,
    timestamp: str,
    created_at: str,
) -> None:
    events = build_event_items(data, event_type)
    for item_type, item_name, item_detail in events:
        conn.execute(
            """
            INSERT INTO event_log (
                data_id, task_id, device_id, event_type, event_name,
                event_detail, timestamp, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data_id,
                data.task_id,
                data.device_id,
                item_type,
                item_name,
                item_detail,
                timestamp,
                created_at,
            ),
        )

    if events and data.task_id == DEMO_TASK["task_id"]:
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, updated_at = ?
            WHERE task_id = ? AND status != ?
            """,
            ("异常", created_at, DEMO_TASK["task_id"], "已签收"),
        )


def get_task_row(conn: sqlite3.Connection) -> sqlite3.Row:
    return conn.execute(
        "SELECT * FROM task_handoff WHERE task_id = ?",
        (DEMO_TASK["task_id"],),
    ).fetchone()


def get_task_by_id(
    conn: sqlite3.Connection,
    task_id: str,
) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM task_handoff WHERE task_id = ?",
        (task_id,),
    ).fetchone()


def api_success(data=None, message: str = "success") -> dict:
    return {"code": 0, "message": message, "data": data}


def api_error(status_code: int, code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "data": None},
    )


def canonical_task_status(task: dict) -> str:
    if task.get("rejected_at") or task.get("rejection_reason"):
        return "rejected"
    if task.get("signed_at"):
        return "signed"
    if task.get("started_at"):
        return "in_transit"
    return "pending_pack"


def serialize_task(row: sqlite3.Row) -> dict:
    task = row_to_dict(row)
    task["status"] = canonical_task_status(task)
    return task


def build_handoff_nodes(task: dict) -> list[dict]:
    nodes = []
    if task.get("started_at"):
        nodes.append({"type": "started", "timestamp": task["started_at"]})
    if task.get("signed_at"):
        nodes.append({"type": "signed", "timestamp": task["signed_at"]})
    if task.get("rejected_at"):
        nodes.append(
            {
                "type": "rejected",
                "timestamp": task["rejected_at"],
                "reason": task.get("rejection_reason"),
            }
        )
    return nodes


def normalize_telemetry(row: sqlite3.Row) -> dict:
    item = row_to_dict(row)
    box_status = item["box_status"].upper()
    temp_status = item["temp_status"].upper()
    item["box_status"] = {
        "CLOSED": "BOX_CLOSED",
        "OPEN": "BOX_OPEN",
    }.get(box_status, box_status)
    item["move_status"] = item["move_status"].upper()
    item["temp_status"] = {
        "NORMAL": "TEMP_OK",
        "OK": "TEMP_OK",
    }.get(temp_status, temp_status)
    return item


def get_trace_report_data(conn: sqlite3.Connection, task_id: str) -> dict:
    task_row = get_task_by_id(conn, task_id)
    if not task_row:
        return {}

    latest = conn.execute(
        """
        SELECT * FROM device_data
        WHERE task_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (task_id,),
    ).fetchone()
    stats = conn.execute(
        """
        SELECT
            COUNT(*) AS total_records,
            MIN(temperature) AS min_temperature,
            MAX(temperature) AS max_temperature,
            ROUND(AVG(temperature), 2) AS avg_temperature,
            MIN(humidity) AS min_humidity,
            MAX(humidity) AS max_humidity
        FROM device_data
        WHERE task_id = ?
        """,
        (task_id,),
    ).fetchone()
    event_count = conn.execute(
        "SELECT COUNT(*) AS count FROM event_log WHERE task_id = ?",
        (task_id,),
    ).fetchone()["count"]
    events = conn.execute(
        """
        SELECT * FROM event_log
        WHERE task_id = ?
        ORDER BY id DESC
        LIMIT 100
        """,
        (task_id,),
    ).fetchall()

    summary = row_to_dict(stats)
    summary["event_count"] = event_count
    task = serialize_task(task_row)
    return {
        "task": task,
        "latest": normalize_telemetry(latest) if latest else None,
        "summary": summary,
        "events": [row_to_dict(row) for row in events],
        "handoff_nodes": build_handoff_nodes(task),
    }


@app.post("/api/device/data")
def receive_device_data(data: DeviceDataIn):
    init_db()
    timestamp = data.timestamp or now_iso()
    created_at = now_iso()
    event_type = detect_event(data)

    with get_connection() as conn:
        task = conn.execute(
            "SELECT device_id FROM task_handoff WHERE task_id = ?",
            (data.task_id,),
        ).fetchone()
        if task and task["device_id"] and task["device_id"] != data.device_id:
            return JSONResponse(
                status_code=409,
                content={"ok": False, "error": "device does not match task"},
            )
        cursor = conn.execute(
            """
            INSERT INTO device_data (
                device_id, task_id, temperature, humidity, light_raw,
                box_status, move_status, temp_status, acc_total, motion_score,
                event_type, timestamp, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.device_id,
                data.task_id,
                data.temperature,
                data.humidity,
                data.light_raw,
                data.box_status,
                data.move_status,
                data.temp_status,
                data.acc_total,
                data.motion_score,
                event_type,
                timestamp,
                created_at,
            ),
        )
        item_id = cursor.lastrowid
        insert_event_logs(conn, item_id, data, event_type, timestamp, created_at)
        row = conn.execute(
            "SELECT * FROM device_data WHERE id = ?",
            (item_id,),
        ).fetchone()

    return {"ok": True, "data": row_to_dict(row)}


@app.get("/api/device/latest")
def get_latest_device_data() -> dict:
    init_db()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM device_data ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return row_to_dict(row) if row else {}


@app.get("/api/device/history")
def get_device_history() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM device_data ORDER BY id DESC LIMIT 100"
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.get("/api/device/events")
def get_device_events() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM event_log
            WHERE event_type IN ('BOX_OPEN', 'TEMP_ALERT', 'SEVERE', 'IMPACT', 'FREE_FALL', 'MILD')
            ORDER BY id DESC
            LIMIT 100
            """
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.post("/api/task/start")
def start_task() -> dict:
    init_db()
    started_at = now_iso()
    with get_connection() as conn:
        ensure_demo_task(conn)
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, started_at = ?, signed_at = NULL,
                rejected_at = NULL, rejection_reason = NULL, updated_at = ?
            WHERE task_id = ?
            """,
            ("运输中", started_at, started_at, DEMO_TASK["task_id"]),
        )
        row = get_task_row(conn)
    return {"ok": True, "task": row_to_dict(row)}


@app.post("/api/task/sign")
def sign_task() -> dict:
    init_db()
    signed_at = now_iso()
    with get_connection() as conn:
        ensure_demo_task(conn)
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, signed_at = ?, rejected_at = NULL,
                rejection_reason = NULL, updated_at = ?
            WHERE task_id = ?
            """,
            ("已签收", signed_at, signed_at, DEMO_TASK["task_id"]),
        )
        row = get_task_row(conn)
    return {"ok": True, "task": row_to_dict(row)}


@app.get("/api/task/current")
def get_current_task() -> dict:
    init_db()
    with get_connection() as conn:
        row = get_task_row(conn)
    return row_to_dict(row)


@app.get("/api/task/report")
def get_task_report() -> dict:
    init_db()
    with get_connection() as conn:
        task = row_to_dict(get_task_row(conn))
        latest = conn.execute(
            """
            SELECT * FROM device_data
            WHERE task_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (DEMO_TASK["task_id"],),
        ).fetchone()
        stats = conn.execute(
            """
            SELECT
                COUNT(*) AS total_records,
                MIN(temperature) AS min_temperature,
                MAX(temperature) AS max_temperature,
                ROUND(AVG(temperature), 2) AS avg_temperature,
                MIN(humidity) AS min_humidity,
                MAX(humidity) AS max_humidity
            FROM device_data
            WHERE task_id = ?
            """,
            (DEMO_TASK["task_id"],),
        ).fetchone()
        event_count = conn.execute(
            "SELECT COUNT(*) AS count FROM event_log WHERE task_id = ?",
            (DEMO_TASK["task_id"],),
        ).fetchone()["count"]
        events = conn.execute(
            """
            SELECT * FROM event_log
            WHERE task_id = ?
            ORDER BY id DESC
            LIMIT 20
            """,
            (DEMO_TASK["task_id"],),
        ).fetchall()

    summary = row_to_dict(stats)
    summary["event_count"] = event_count
    return {
        "task": task,
        "latest": row_to_dict(latest) if latest else {},
        "summary": summary,
        "events": [row_to_dict(row) for row in events],
    }


@app.get("/api/v1/meta/contracts")
def get_v1_contracts() -> dict:
    return api_success(
        {
            "task_statuses": TASK_STATUSES,
            "box_statuses": BOX_STATUSES,
            "move_statuses": MOVE_STATUSES,
            "temperature_statuses": TEMPERATURE_STATUSES,
            "timestamp_format": "ISO 8601",
            "field_naming": "snake_case",
        }
    )


@app.get("/api/v1/tasks/{task_id}")
def get_v1_task(task_id: str):
    init_db()
    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
    if not row:
        return api_error(404, 40401, "task not found")
    return api_success(serialize_task(row))


@app.get("/api/v1/tasks/{task_id}/telemetry/latest")
def get_v1_latest_telemetry(task_id: str):
    init_db()
    with get_connection() as conn:
        task = get_task_by_id(conn, task_id)
        if not task:
            return api_error(404, 40401, "task not found")
        row = conn.execute(
            """
            SELECT * FROM device_data
            WHERE task_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (task_id,),
        ).fetchone()
    return api_success(normalize_telemetry(row) if row else None)


@app.get("/api/v1/tasks/{task_id}/telemetry/history")
def get_v1_telemetry_history(
    task_id: str,
    limit: int = Query(default=100, ge=1, le=100),
):
    init_db()
    with get_connection() as conn:
        task = get_task_by_id(conn, task_id)
        if not task:
            return api_error(404, 40401, "task not found")
        rows = conn.execute(
            """
            SELECT * FROM device_data
            WHERE task_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (task_id, limit),
        ).fetchall()
    return api_success(
        {"limit": limit, "items": [normalize_telemetry(row) for row in rows]}
    )


@app.get("/api/v1/tasks/{task_id}/alarms")
def get_v1_alarms(
    task_id: str,
    limit: int = Query(default=100, ge=1, le=100),
):
    init_db()
    with get_connection() as conn:
        task = get_task_by_id(conn, task_id)
        if not task:
            return api_error(404, 40401, "task not found")
        rows = conn.execute(
            """
            SELECT * FROM event_log
            WHERE task_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (task_id, limit),
        ).fetchall()
    return api_success(
        {"limit": limit, "items": [row_to_dict(row) for row in rows]}
    )


def task_state_conflict():
    return api_error(409, 40901, "task state conflict")


@app.post("/api/v1/tasks/{task_id}/start")
def start_v1_task(task_id: str):
    init_db()
    timestamp = now_iso()
    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if not row:
            return api_error(404, 40401, "task not found")
        if canonical_task_status(row_to_dict(row)) not in {
            "pending_pack",
            "pending_handoff",
        }:
            return task_state_conflict()
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, started_at = ?, signed_at = NULL,
                rejected_at = NULL, rejection_reason = NULL, updated_at = ?
            WHERE task_id = ?
            """,
            ("运输中", timestamp, timestamp, task_id),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(serialize_task(updated), "task started")


@app.post("/api/v1/tasks/{task_id}/sign")
def sign_v1_task(task_id: str):
    init_db()
    timestamp = now_iso()
    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if not row:
            return api_error(404, 40401, "task not found")
        if canonical_task_status(row_to_dict(row)) not in {"in_transit", "arrived"}:
            return task_state_conflict()
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, signed_at = ?, updated_at = ?
            WHERE task_id = ?
            """,
            ("已签收", timestamp, timestamp, task_id),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(serialize_task(updated), "task signed")


@app.post("/api/v1/tasks/{task_id}/reject")
def reject_v1_task(task_id: str, data: RejectTaskIn):
    init_db()
    reason = data.reason.strip()
    if not reason:
        return api_error(400, 40001, "rejection reason required")

    timestamp = now_iso()
    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if not row:
            return api_error(404, 40401, "task not found")
        if canonical_task_status(row_to_dict(row)) not in {"in_transit", "arrived"}:
            return task_state_conflict()
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, signed_at = NULL, rejected_at = ?,
                rejection_reason = ?, updated_at = ?
            WHERE task_id = ?
            """,
            ("已拒收", timestamp, reason, timestamp, task_id),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(serialize_task(updated), "task rejected")


@app.get("/api/v1/tasks/{task_id}/trace-report")
def get_v1_trace_report(task_id: str):
    init_db()
    with get_connection() as conn:
        report = get_trace_report_data(conn, task_id)
    if not report:
        return api_error(404, 40401, "task not found")
    return api_success(report)


@app.get("/", response_class=HTMLResponse)
def dashboard() -> str:
    return """
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>生物样本冷链转运交接与可信追溯系统</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fb; color: #172033; }
    header { background: #17324d; color: white; padding: 20px 28px; }
    h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0; }
    main { max-width: 1220px; margin: 0 auto; padding: 24px; }
    h2 { font-size: 18px; margin: 0 0 12px; color: #22344d; }
    .muted { color: #66748a; }
    .layout { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; align-items: start; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(130px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .card { background: white; border: 1px solid #dde4ee; border-radius: 8px; padding: 16px; }
    .task-card { margin-bottom: 16px; }
    .task-grid { display: grid; grid-template-columns: repeat(3, minmax(160px, 1fr)); gap: 10px 18px; }
    .label { color: #617089; font-size: 13px; margin-bottom: 6px; }
    .value { font-size: 24px; font-weight: 700; }
    .status { font-size: 18px; }
    .task-status { display: inline-flex; align-items: center; min-height: 34px; padding: 0 12px; border-radius: 6px; background: #edf2f7; color: #17324d; font-weight: 700; }
    .task-status.alert { background: #fee4e2; color: #b42318; }
    .actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    button { border: 0; border-radius: 6px; background: #17324d; color: white; padding: 10px 14px; font-size: 14px; cursor: pointer; }
    button.secondary { background: #2f6f73; }
    button:active { transform: translateY(1px); }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #dde4ee; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e8edf4; text-align: left; font-size: 14px; white-space: nowrap; }
    th { background: #edf2f7; color: #34445a; }
    tr:last-child td { border-bottom: 0; }
    .event { font-weight: 700; color: #b42318; }
    .timeline { display: grid; gap: 10px; }
    .timeline-item { border-left: 3px solid #b42318; padding: 8px 0 8px 12px; background: #fff; }
    .timeline-title { font-weight: 700; color: #b42318; }
    .report-grid { display: grid; grid-template-columns: repeat(2, minmax(130px, 1fr)); gap: 10px; }
    .report-value { font-size: 20px; font-weight: 700; }
    .section { margin-bottom: 16px; }
    @media (max-width: 920px) {
      .layout { grid-template-columns: 1fr; }
      .summary { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
      .task-grid { grid-template-columns: 1fr; }
      main { padding: 14px; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <h1>生物样本冷链转运交接与可信追溯系统</h1>
    <div class="muted" id="refreshTime">等待数据...</div>
  </header>
  <main>
    <section class="card task-card">
      <h2>转运任务交接</h2>
      <div class="task-grid">
        <div><div class="label">任务编号</div><div class="status" id="taskId">--</div></div>
        <div><div class="label">样本名称</div><div class="status" id="sampleName">--</div></div>
        <div><div class="label">当前状态</div><div class="task-status" id="taskStatus">--</div></div>
        <div><div class="label">发出单位</div><div id="sender">--</div></div>
        <div><div class="label">接收单位</div><div id="receiver">--</div></div>
        <div><div class="label">承运人员</div><div id="carrier">--</div></div>
        <div><div class="label">发出时间</div><div id="startedAt">--</div></div>
        <div><div class="label">签收时间</div><div id="signedAt">--</div></div>
      </div>
      <div class="actions">
        <button onclick="startTask()">发出交接</button>
        <button class="secondary" onclick="signTask()">到达签收</button>
      </div>
    </section>

    <section class="summary">
      <div class="card"><div class="label">最新温度</div><div class="value" id="temperature">--</div></div>
      <div class="card"><div class="label">最新湿度</div><div class="value" id="humidity">--</div></div>
      <div class="card"><div class="label">箱体状态</div><div class="value status" id="boxStatus">--</div></div>
      <div class="card"><div class="label">运动状态</div><div class="value status" id="moveStatus">--</div></div>
      <div class="card"><div class="label">温度状态</div><div class="value status" id="tempStatus">--</div></div>
    </section>

    <div class="layout">
      <div>
        <section class="section">
          <h2>最近数据</h2>
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>设备</th>
                <th>任务</th>
                <th>温度</th>
                <th>湿度</th>
                <th>光照</th>
                <th>箱体</th>
                <th>运动</th>
                <th>温度状态</th>
                <th>事件</th>
              </tr>
            </thead>
            <tbody id="historyBody">
              <tr><td colspan="10" class="muted">暂无数据</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <aside>
        <section class="card section">
          <h2>追溯报告</h2>
          <div class="report-grid">
            <div><div class="label">数据条数</div><div class="report-value" id="totalRecords">--</div></div>
            <div><div class="label">异常事件</div><div class="report-value" id="eventCount">--</div></div>
            <div><div class="label">最低温度</div><div class="report-value" id="minTemp">--</div></div>
            <div><div class="label">最高温度</div><div class="report-value" id="maxTemp">--</div></div>
          </div>
        </section>

        <section class="card section">
          <h2>异常事件时间线</h2>
          <div class="timeline" id="eventTimeline">
            <div class="muted">暂无异常事件</div>
          </div>
        </section>
      </aside>
    </div>
  </main>

  <script>
    function showValue(id, value, suffix = "") {
      document.getElementById(id).textContent = value === undefined || value === null || value === "" ? "--" : value + suffix;
    }

    async function postAction(url) {
      await fetch(url, { method: "POST" });
      await refresh();
    }

    function startTask() {
      postAction("/api/task/start").catch(console.error);
    }

    function signTask() {
      postAction("/api/task/sign").catch(console.error);
    }

    function renderTask(task) {
      showValue("taskId", task.task_id);
      showValue("sampleName", task.sample_name);
      showValue("sender", task.sender);
      showValue("receiver", task.receiver);
      showValue("carrier", task.carrier);
      showValue("startedAt", task.started_at);
      showValue("signedAt", task.signed_at);
      const status = document.getElementById("taskStatus");
      status.textContent = task.status || "--";
      status.className = task.status === "异常" ? "task-status alert" : "task-status";
    }

    function renderHistory(history) {
      const body = document.getElementById("historyBody");
      if (!history.length) {
        body.innerHTML = '<tr><td colspan="10" class="muted">暂无数据</td></tr>';
        return;
      }
      body.innerHTML = history.map(item => `
        <tr>
          <td>${item.timestamp}</td>
          <td>${item.device_id}</td>
          <td>${item.task_id}</td>
          <td>${item.temperature}</td>
          <td>${item.humidity}</td>
          <td>${item.light_raw}</td>
          <td>${item.box_status}</td>
          <td>${item.move_status}</td>
          <td>${item.temp_status}</td>
          <td class="${item.event_type === "NORMAL" ? "" : "event"}">${item.event_type}</td>
        </tr>
      `).join("");
    }

    function renderTimeline(events) {
      const timeline = document.getElementById("eventTimeline");
      if (!events.length) {
        timeline.innerHTML = '<div class="muted">暂无异常事件</div>';
        return;
      }
      timeline.innerHTML = events.slice(0, 12).map(item => `
        <div class="timeline-item">
          <div class="timeline-title">${item.event_name}</div>
          <div>${item.event_detail}</div>
          <div class="muted">${item.timestamp}</div>
        </div>
      `).join("");
    }

    function renderReport(report) {
      const summary = report.summary || {};
      showValue("totalRecords", summary.total_records);
      showValue("eventCount", summary.event_count);
      showValue("minTemp", summary.min_temperature, summary.min_temperature === null ? "" : " °C");
      showValue("maxTemp", summary.max_temperature, summary.max_temperature === null ? "" : " °C");
    }

    async function refresh() {
      const [latestResp, historyResp, eventsResp, taskResp, reportResp] = await Promise.all([
        fetch("/api/device/latest"),
        fetch("/api/device/history"),
        fetch("/api/device/events"),
        fetch("/api/task/current"),
        fetch("/api/task/report")
      ]);
      const latest = await latestResp.json();
      const history = await historyResp.json();
      const events = await eventsResp.json();
      const task = await taskResp.json();
      const report = await reportResp.json();

      showValue("temperature", latest.temperature, latest.temperature === undefined ? "" : " °C");
      showValue("humidity", latest.humidity, latest.humidity === undefined ? "" : " %");
      showValue("boxStatus", latest.box_status);
      showValue("moveStatus", latest.move_status);
      showValue("tempStatus", latest.temp_status);
      document.getElementById("refreshTime").textContent = "最后刷新：" + new Date().toLocaleString();

      renderTask(task);
      renderHistory(history);
      renderTimeline(events);
      renderReport(report);
    }

    refresh().catch(console.error);
    setInterval(() => refresh().catch(console.error), 3000);
  </script>
</body>
</html>
"""
