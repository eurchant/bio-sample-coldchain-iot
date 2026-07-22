from contextlib import asynccontextmanager
from datetime import datetime, timezone
import hashlib
import os
import secrets
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import Body, FastAPI, Header, Query
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

TASK_STATUS_LABELS = {
    "pending_pack": "待发出",
    "pending_handoff": "待发出",
    "in_transit": "运输中",
    "arrived": "已到达",
    "signed": "已签收",
    "rejected": "已拒收",
    "canceled": "已取消",
}

EVENT_LEVELS = {
    "SEVERE": "high",
    "IMPACT": "high",
    "FREE_FALL": "high",
    "TEMP_ALERT": "medium",
    "BOX_OPEN": "medium",
    "MILD": "low",
}

EVENT_DISPLAY_LABELS = {
    "NORMAL": "正常",
    "BOX_OPEN": "开箱事件",
    "MILD": "轻微晃动",
    "SEVERE": "剧烈晃动",
    "IMPACT": "疑似碰撞",
    "FREE_FALL": "疑似跌落",
    "TEMP_ALERT": "温度异常",
}

AUTH_ROLES = ["admin", "sender", "carrier", "receiver"]
ROLE_PERMISSIONS = {
    "admin": [
        "view_task",
        "start_task",
        "sign_task",
        "reject_task",
        "view_report",
        "view_alarm",
        "upload_location",
        "manage_user",
    ],
    "sender": ["view_task", "start_task", "view_report"],
    "carrier": ["view_task", "view_alarm", "upload_location"],
    "receiver": ["view_task", "sign_task", "reject_task", "view_report"],
}


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


class LocationIn(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None


class DeviceTelemetryIn(BaseModel):
    device_id: str = Field(..., examples=["CLD-001"])
    task_id: str = Field(..., examples=["TASK-001"])
    sequence: Optional[int] = None
    captured_at: Optional[str] = None
    temperature: float
    humidity: float
    battery: Optional[int] = None
    box_status: str
    move_status: str
    temp_status: Optional[str] = None
    light_raw: int
    acc_total: Optional[float] = None
    motion_score: Optional[float] = None
    location: Optional[LocationIn] = None


class DeviceHeartbeatIn(BaseModel):
    device_id: str = Field(..., examples=["CLD-001"])
    task_id: Optional[str] = Field(None, examples=["TASK-001"])
    battery: Optional[int] = None
    rssi: Optional[int] = None
    network: Optional[str] = Field(None, max_length=40)
    timestamp: Optional[str] = None


class RejectTaskIn(BaseModel):
    reason: str = Field(..., min_length=1, max_length=200)


class RegisterIn(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=40)
    phone: Optional[str] = Field(None, min_length=3, max_length=40)
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    organization: Optional[str] = Field(None, max_length=120)
    password: str = Field(..., min_length=6, max_length=80)
    role: str = Field(..., examples=["receiver"])
    display_name: Optional[str] = Field(None, max_length=80)


class LoginIn(BaseModel):
    username: Optional[str] = Field(None, min_length=1, max_length=40)
    phone: Optional[str] = Field(None, min_length=1, max_length=40)
    password: str = Field(..., min_length=1, max_length=80)


class CreateTaskIn(BaseModel):
    sample_name: str = Field(..., min_length=1, max_length=120)
    batch: Optional[str] = Field(None, max_length=80)
    receiver: Optional[str] = Field(None, max_length=120)
    carrier: Optional[str] = Field(None, max_length=120)
    expected_arrival: Optional[str] = Field(None, max_length=40)
    device_id: Optional[str] = Field(None, max_length=80)
    box_id: Optional[str] = Field(None, max_length=80)
    seal_id: Optional[str] = Field(None, max_length=80)
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None


class UpdateTaskIn(BaseModel):
    sample_name: Optional[str] = Field(None, min_length=1, max_length=120)
    batch: Optional[str] = Field(None, max_length=80)
    receiver: Optional[str] = Field(None, max_length=120)
    carrier: Optional[str] = Field(None, max_length=120)
    expected_arrival: Optional[str] = Field(None, max_length=40)
    device_id: Optional[str] = Field(None, max_length=80)
    box_id: Optional[str] = Field(None, max_length=80)
    seal_id: Optional[str] = Field(None, max_length=80)
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None


class AssignTaskIn(BaseModel):
    carrier_user_id: Optional[int] = None
    receiver_user_id: Optional[int] = None


class PrecheckTaskIn(BaseModel):
    passed: bool
    temperature: Optional[float] = None
    seal_ok: Optional[bool] = None
    note: Optional[str] = Field(None, max_length=300)


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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                role TEXT NOT NULL,
                display_name TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS device_heartbeat (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                task_id TEXT,
                battery INTEGER,
                rssi INTEGER,
                network TEXT,
                status TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        ensure_column(conn, "device_data", "sequence", "INTEGER")
        ensure_column(conn, "device_data", "battery", "INTEGER")
        ensure_column(conn, "device_data", "lat", "REAL")
        ensure_column(conn, "device_data", "lng", "REAL")
        ensure_column(conn, "device_data", "accuracy", "REAL")
        ensure_column(conn, "task_handoff", "device_id", "TEXT")
        ensure_column(conn, "task_handoff", "rejected_at", "TEXT")
        ensure_column(conn, "task_handoff", "rejection_reason", "TEXT")
        ensure_column(conn, "task_handoff", "arrived_at", "TEXT")
        ensure_column(conn, "task_handoff", "owner_user_id", "INTEGER")
        ensure_column(conn, "task_handoff", "carrier_user_id", "INTEGER")
        ensure_column(conn, "task_handoff", "receiver_user_id", "INTEGER")
        ensure_column(conn, "task_handoff", "batch", "TEXT")
        ensure_column(conn, "task_handoff", "expected_arrival", "TEXT")
        ensure_column(conn, "task_handoff", "box_id", "TEXT")
        ensure_column(conn, "task_handoff", "seal_id", "TEXT")
        ensure_column(conn, "task_handoff", "temperature_min", "REAL")
        ensure_column(conn, "task_handoff", "temperature_max", "REAL")
        ensure_column(conn, "task_handoff", "precheck_passed", "INTEGER")
        ensure_column(conn, "task_handoff", "precheck_temperature", "REAL")
        ensure_column(conn, "task_handoff", "precheck_seal_ok", "INTEGER")
        ensure_column(conn, "task_handoff", "precheck_note", "TEXT")
        ensure_column(conn, "task_handoff", "prechecked_at", "TEXT")
        ensure_column(conn, "task_handoff", "canceled_at", "TEXT")
        ensure_column(conn, "task_handoff", "cancel_reason", "TEXT")
        ensure_column(conn, "task_handoff", "idempotency_key", "TEXT")
        ensure_column(conn, "users", "phone", "TEXT")
        ensure_column(conn, "users", "name", "TEXT")
        ensure_column(conn, "users", "organization", "TEXT")
        ensure_column(conn, "users", "status", "TEXT")
        ensure_demo_task(conn)
        migrate_task_status_column(conn)


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


def migrate_task_status_column(conn: sqlite3.Connection) -> None:
    """将旧版中文状态迁移为规范键，保留历史数据。"""
    for row in conn.execute("SELECT * FROM task_handoff").fetchall():
        task = row_to_dict(row)
        canonical = canonical_task_status(task)
        if row["status"] != canonical:
            conn.execute(
                "UPDATE task_handoff SET status = ? WHERE task_id = ?",
                (canonical, task["task_id"]),
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
            "pending_pack",
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
        events.append(("BOX_OPEN", "开箱", "光敏检测到箱体疑似打开"))
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


def save_device_data(
    conn: sqlite3.Connection,
    data: DeviceDataIn,
    sequence: Optional[int] = None,
    battery: Optional[int] = None,
    location: Optional[LocationIn] = None,
) -> tuple[Optional[sqlite3.Row], Optional[JSONResponse]]:
    timestamp = data.timestamp or now_iso()
    created_at = now_iso()
    event_type = detect_event(data)

    task = conn.execute(
        "SELECT device_id FROM task_handoff WHERE task_id = ?",
        (data.task_id,),
    ).fetchone()
    if task and task["device_id"] and task["device_id"] != data.device_id:
        return None, JSONResponse(
            status_code=409,
            content={"ok": False, "error": "device does not match task"},
        )

    cursor = conn.execute(
        """
        INSERT INTO device_data (
            device_id, task_id, temperature, humidity, light_raw,
            box_status, move_status, temp_status, acc_total, motion_score,
            event_type, timestamp, created_at, sequence, battery, lat, lng, accuracy
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            sequence,
            battery,
            location.lat if location else None,
            location.lng if location else None,
            location.accuracy if location else None,
        ),
    )
    item_id = cursor.lastrowid
    insert_event_logs(conn, item_id, data, event_type, timestamp, created_at)
    row = conn.execute(
        "SELECT * FROM device_data WHERE id = ?",
        (item_id,),
    ).fetchone()
    return row, None


def telemetry_temp_status(payload: DeviceTelemetryIn, task: Optional[sqlite3.Row]) -> str:
    if payload.temp_status:
        return payload.temp_status
    if task:
        task_data = row_to_dict(task)
        minimum = task_data.get("temperature_min")
        maximum = task_data.get("temperature_max")
        if minimum is not None and payload.temperature < minimum:
            return "TEMP_ALERT"
        if maximum is not None and payload.temperature > maximum:
            return "TEMP_ALERT"
    return "TEMP_OK"


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


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def serialize_user(row: sqlite3.Row) -> dict:
    return {
        "user_id": row["id"],
        "username": row["username"],
        "phone": row["phone"] or row["username"],
        "name": row["name"] or row["display_name"] or row["username"],
        "organization": row["organization"] or "",
        "status": row["status"] or "active",
        "role": row["role"],
        "display_name": row["display_name"] or row["username"],
    }


def bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def current_user_from_token(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT users.*
            FROM auth_tokens
            JOIN users ON users.id = auth_tokens.user_id
            WHERE auth_tokens.token = ?
            """,
            (token,),
        ).fetchone()
    return serialize_user(row) if row else None


def require_user(authorization: Optional[str]) -> Optional[dict]:
    return current_user_from_token(bearer_token(authorization))


def generate_task_id(conn: sqlite3.Connection) -> str:
    today = datetime.now(timezone.utc).astimezone().strftime("%Y%m%d")
    prefix = f"WD-{today}-"
    row = conn.execute(
        """
        SELECT task_id FROM task_handoff
        WHERE task_id LIKE ?
        ORDER BY task_id DESC
        LIMIT 1
        """,
        (f"{prefix}%",),
    ).fetchone()
    next_no = 1
    if row:
        try:
            next_no = int(row["task_id"].rsplit("-", 1)[1]) + 1
        except (IndexError, ValueError):
            next_no = 1
    return f"{prefix}{next_no:03d}"


def can_view_task(user: Optional[dict], task: dict) -> bool:
    if not user:
        return task["task_id"] == DEMO_TASK["task_id"]
    if user["role"] == "admin":
        return True
    if task.get("owner_user_id") == user["user_id"]:
        return True
    if task.get("carrier_user_id") == user["user_id"]:
        return True
    if task.get("receiver_user_id") == user["user_id"]:
        return True
    return False


def can_modify_task(user: dict, task: dict) -> bool:
    return user["role"] == "admin" or task.get("owner_user_id") == user["user_id"]


def canonical_task_status(task: dict) -> str:
    if task.get("canceled_at") or task.get("status") == "canceled":
        return "canceled"
    if task.get("rejected_at") or task.get("rejection_reason"):
        return "rejected"
    if task.get("signed_at"):
        return "signed"
    if task.get("arrived_at") or task.get("status") == "arrived":
        return "arrived"
    if task.get("started_at"):
        return "in_transit"
    if task.get("precheck_passed"):
        return "pending_handoff"
    return task.get("status") if task.get("status") in TASK_STATUSES else "pending_pack"


def serialize_task(row: sqlite3.Row) -> dict:
    task = row_to_dict(row)
    task["status"] = canonical_task_status(task)
    if task.get("precheck_passed") is not None:
        task["precheck_passed"] = bool(task["precheck_passed"])
    if task.get("precheck_seal_ok") is not None:
        task["precheck_seal_ok"] = bool(task["precheck_seal_ok"])
    return task


def build_handoff_nodes(task: dict) -> list[dict]:
    nodes = []
    if task.get("started_at"):
        nodes.append({"type": "started", "timestamp": task["started_at"]})
    if task.get("arrived_at"):
        nodes.append({"type": "arrived", "timestamp": task["arrived_at"]})
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
    move_status = item["move_status"].upper()
    item["box_status"] = {
        "CLOSED": "BOX_CLOSED",
        "OPEN": "BOX_OPEN",
    }.get(box_status, box_status)
    item["move_status"] = move_status
    item["temp_status"] = {
        "NORMAL": "TEMP_OK",
        "OK": "TEMP_OK",
    }.get(temp_status, temp_status)
    item["event_display"] = telemetry_event_display(item)
    return item


def telemetry_event_display(item: dict) -> str:
    if item["temp_status"] == "TEMP_ALERT":
        return EVENT_DISPLAY_LABELS["TEMP_ALERT"]
    if item["move_status"] == "FREE_FALL":
        return EVENT_DISPLAY_LABELS["FREE_FALL"]
    if item["move_status"] == "IMPACT":
        return EVENT_DISPLAY_LABELS["IMPACT"]
    if item["move_status"] == "SEVERE":
        return EVENT_DISPLAY_LABELS["SEVERE"]
    if item["move_status"] == "MILD":
        return EVENT_DISPLAY_LABELS["MILD"]
    if item["box_status"] == "BOX_OPEN":
        return EVENT_DISPLAY_LABELS["BOX_OPEN"]
    return EVENT_DISPLAY_LABELS.get(item["event_type"], item["event_type"])


def event_level(event_type: str) -> str:
    return EVENT_LEVELS.get(event_type, "medium")


def normalize_event(row: sqlite3.Row) -> dict:
    item = row_to_dict(row)
    item["event_id"] = item["id"]
    item["description"] = item["event_detail"]
    item["event_level"] = event_level(item["event_type"])
    return item


def task_latest_telemetry(conn: sqlite3.Connection, task_id: str) -> Optional[dict]:
    row = conn.execute(
        """
        SELECT * FROM device_data
        WHERE task_id = ? ORDER BY id DESC LIMIT 1
        """,
        (task_id,),
    ).fetchone()
    return normalize_telemetry(row) if row else None


def task_abnormal_count(conn: sqlite3.Connection, task_id: str) -> int:
    return conn.execute(
        "SELECT COUNT(*) AS count FROM event_log WHERE task_id = ?",
        (task_id,),
    ).fetchone()["count"]


def enrich_task(row: sqlite3.Row, conn: sqlite3.Connection) -> dict:
    task = serialize_task(row)
    task_id = task["task_id"]
    latest = task_latest_telemetry(conn, task_id)
    task["abnormal_count"] = task_abnormal_count(conn, task_id)
    if latest:
        task["latest_temperature"] = latest["temperature"]
        task["latest_humidity"] = latest["humidity"]
        task["latest_box_status"] = latest["box_status"]
        task["latest_move_status"] = latest["move_status"]
        task["latest_temp_status"] = latest["temp_status"]
    else:
        task["latest_temperature"] = None
        task["latest_humidity"] = None
        task["latest_box_status"] = None
        task["latest_move_status"] = None
        task["latest_temp_status"] = None
    return task


def legacy_task_view(task: dict) -> dict:
    view = dict(task)
    view["status"] = TASK_STATUS_LABELS.get(view["status"], view["status"])
    return view


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
    task = enrich_task(task_row, conn)
    return {
        "task": task,
        "latest": normalize_telemetry(latest) if latest else None,
        "summary": summary,
        "events": [normalize_event(row) for row in events],
        "handoff_nodes": build_handoff_nodes(task),
    }


@app.post("/api/device/data")
def receive_device_data(data: DeviceDataIn):
    init_db()
    with get_connection() as conn:
        row, error = save_device_data(conn, data)
        if error:
            return error

    return {"ok": True, "data": row_to_dict(row)}


@app.get("/api/device/latest")
def get_latest_device_data() -> dict:
    init_db()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM device_data ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return normalize_telemetry(row) if row else {}


@app.get("/api/device/history")
def get_device_history() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM device_data ORDER BY id DESC LIMIT 100"
        ).fetchall()
    return [normalize_telemetry(row) for row in rows]


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
    return [normalize_event(row) for row in rows]


@app.post("/api/task/start")
def start_task() -> dict:
    init_db()
    timestamp = now_iso()
    with get_connection() as conn:
        ensure_demo_task(conn)
        row = get_task_row(conn)
        if canonical_task_status(row_to_dict(row)) == "in_transit":
            return {"ok": True, "task": legacy_task_view(enrich_task(row, conn))}
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, started_at = ?, signed_at = NULL,
                arrived_at = NULL, rejected_at = NULL,
                rejection_reason = NULL, updated_at = ?
            WHERE task_id = ?
            """,
            ("in_transit", timestamp, timestamp, DEMO_TASK["task_id"]),
        )
        row = get_task_row(conn)
    return {"ok": True, "task": legacy_task_view(enrich_task(row, conn))}


@app.post("/api/task/sign")
def sign_task() -> dict:
    init_db()
    with get_connection() as conn:
        ensure_demo_task(conn)
        row = get_task_row(conn)
        if canonical_task_status(row_to_dict(row)) == "signed":
            return {"ok": True, "task": legacy_task_view(enrich_task(row, conn))}

        timestamp = now_iso()
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, signed_at = ?, rejected_at = NULL,
                rejection_reason = NULL, updated_at = ?
            WHERE task_id = ?
            """,
            ("signed", timestamp, timestamp, DEMO_TASK["task_id"]),
        )
        row = get_task_row(conn)
    return {"ok": True, "task": legacy_task_view(enrich_task(row, conn))}


@app.get("/api/task/current")
def get_current_task() -> dict:
    init_db()
    with get_connection() as conn:
        row = get_task_row(conn)
    return legacy_task_view(enrich_task(row, conn))


@app.get("/api/task/report")
def get_task_report() -> dict:
    init_db()
    with get_connection() as conn:
        task = legacy_task_view(enrich_task(get_task_row(conn), conn))
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
        "latest": normalize_telemetry(latest) if latest else {},
        "summary": summary,
        "events": [normalize_event(row) for row in events],
    }


@app.get("/api/v1/meta/contracts")
def get_v1_contracts() -> dict:
    return api_success(
        {
            "task_statuses": TASK_STATUSES,
            "task_status_labels": TASK_STATUS_LABELS,
            "box_statuses": BOX_STATUSES,
            "move_statuses": MOVE_STATUSES,
            "temperature_statuses": TEMPERATURE_STATUSES,
            "auth_roles": AUTH_ROLES,
            "role_permissions": ROLE_PERMISSIONS,
            "timestamp_format": "ISO 8601",
            "field_naming": "snake_case",
        }
    )


@app.post("/api/v1/auth/register")
def register_user(payload: RegisterIn):
    init_db()
    role = payload.role.strip().lower()
    if role not in AUTH_ROLES:
        return api_error(422, 42202, "invalid role")
    username = (payload.username or payload.phone or "").strip()
    if not username:
        return api_error(422, 42203, "username or phone required")

    salt = secrets.token_hex(16)
    password_hash = hash_password(payload.password, salt)
    display_name = payload.display_name or payload.name or username
    created_at = now_iso()
    phone = (payload.phone or username).strip()
    name = (payload.name or display_name).strip()
    organization = (payload.organization or "").strip()

    try:
        with get_connection() as conn:
            existing = conn.execute(
                "SELECT id FROM users WHERE username = ? OR phone = ?",
                (username, phone),
            ).fetchone()
            if existing:
                return api_error(409, 40902, "username already exists")
            cursor = conn.execute(
                """
                INSERT INTO users (
                    username, password_hash, salt, role, display_name, created_at,
                    phone, name, organization, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    username,
                    password_hash,
                    salt,
                    role,
                    display_name,
                    created_at,
                    phone,
                    name,
                    organization,
                    "active",
                ),
            )
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?",
                (cursor.lastrowid,),
            ).fetchone()
    except sqlite3.IntegrityError:
        return api_error(409, 40902, "username already exists")

    return api_success({"user": serialize_user(row)}, "registered")


@app.post("/api/v1/auth/login")
def login_user(payload: LoginIn):
    init_db()
    account = (payload.username or payload.phone or "").strip()
    if not account:
        return api_error(422, 42203, "username or phone required")
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? OR phone = ?",
            (account, account),
        ).fetchone()
        if not row:
            return api_error(401, 40101, "invalid username or password")

        password_hash = hash_password(payload.password, row["salt"])
        if not secrets.compare_digest(password_hash, row["password_hash"]):
            return api_error(401, 40101, "invalid username or password")

        token = secrets.token_urlsafe(32)
        conn.execute(
            """
            INSERT INTO auth_tokens (token, user_id, created_at)
            VALUES (?, ?, ?)
            """,
            (token, row["id"], now_iso()),
        )

    return api_success(
        {
            "token": token,
            "token_type": "bearer",
            "user": serialize_user(row),
        },
        "login success",
    )


@app.get("/api/v1/auth/me")
def get_auth_me(authorization: Optional[str] = Header(None)):
    init_db()
    user = current_user_from_token(bearer_token(authorization))
    if not user:
        return api_error(401, 40102, "unauthorized")
    return api_success(user)


@app.get("/api/v1/auth/permissions")
def get_auth_permissions(authorization: Optional[str] = Header(None)):
    init_db()
    user = current_user_from_token(bearer_token(authorization))
    if not user:
        return api_error(401, 40102, "unauthorized")
    return api_success(
        {
            "role": user["role"],
            "permissions": ROLE_PERMISSIONS.get(user["role"], []),
        }
    )


@app.post("/api/v1/auth/logout")
def logout_user(authorization: Optional[str] = Header(None)):
    init_db()
    token = bearer_token(authorization)
    if not token:
        return api_error(401, 40102, "unauthorized")
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
    if cursor.rowcount == 0:
        return api_error(401, 40102, "unauthorized")
    return api_success({"logged_out": True}, "logout success")


@app.post("/api/v1/auth/refresh")
def refresh_auth_token(authorization: Optional[str] = Header(None)):
    init_db()
    old_token = bearer_token(authorization)
    if not old_token:
        return api_error(401, 40102, "unauthorized")

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT users.*
            FROM auth_tokens
            JOIN users ON users.id = auth_tokens.user_id
            WHERE auth_tokens.token = ?
            """,
            (old_token,),
        ).fetchone()
        if not row:
            return api_error(401, 40102, "unauthorized")

        new_token = secrets.token_urlsafe(32)
        conn.execute("DELETE FROM auth_tokens WHERE token = ?", (old_token,))
        conn.execute(
            """
            INSERT INTO auth_tokens (token, user_id, created_at)
            VALUES (?, ?, ?)
            """,
            (new_token, row["id"], now_iso()),
        )

    return api_success(
        {
            "token": new_token,
            "token_type": "bearer",
            "user": serialize_user(row),
        },
        "refresh success",
    )


@app.post("/api/v1/device/telemetry")
def receive_v1_device_telemetry(payload: DeviceTelemetryIn):
    init_db()
    with get_connection() as conn:
        task = get_task_by_id(conn, payload.task_id)
        data = DeviceDataIn(
            device_id=payload.device_id,
            task_id=payload.task_id,
            temperature=payload.temperature,
            humidity=payload.humidity,
            light_raw=payload.light_raw,
            box_status=payload.box_status,
            move_status=payload.move_status,
            temp_status=telemetry_temp_status(payload, task),
            acc_total=payload.acc_total if payload.acc_total is not None else 0.0,
            motion_score=payload.motion_score if payload.motion_score is not None else 0.0,
            timestamp=payload.captured_at,
        )
        row, error = save_device_data(
            conn,
            data,
            sequence=payload.sequence,
            battery=payload.battery,
            location=payload.location,
        )
        if error:
            return api_error(409, 40920, "device does not match task")

    return api_success(
        {
            "saved": 1,
            "items": [normalize_telemetry(row)],
        },
        "telemetry saved",
    )


@app.post("/api/v1/device/heartbeat")
def receive_v1_device_heartbeat(payload: DeviceHeartbeatIn):
    init_db()
    timestamp = payload.timestamp or now_iso()
    created_at = now_iso()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO device_heartbeat (
                device_id, task_id, battery, rssi, network,
                status, timestamp, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.device_id,
                payload.task_id,
                payload.battery,
                payload.rssi,
                payload.network,
                "online",
                timestamp,
                created_at,
            ),
        )
        row = conn.execute(
            "SELECT * FROM device_heartbeat WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return api_success(row_to_dict(row), "heartbeat saved")


@app.get("/api/v1/tasks")
def list_v1_tasks(
    authorization: Optional[str] = Header(None),
    status: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    init_db()
    user = require_user(authorization)
    if not user:
        return api_error(401, 40102, "unauthorized")

    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM task_handoff ORDER BY updated_at DESC"
        ).fetchall()
        tasks = [
            enrich_task(row, conn)
            for row in rows
            if can_view_task(user, serialize_task(row))
        ]

    if status:
        tasks = [task for task in tasks if task["status"] == status]
    if keyword:
        lowered = keyword.lower()
        tasks = [
            task
            for task in tasks
            if lowered in task["task_id"].lower()
            or lowered in task["sample_name"].lower()
            or lowered in (task.get("batch") or "").lower()
        ]

    start = (page - 1) * page_size
    end = start + page_size
    return api_success(
        {
            "items": tasks[start:end],
            "page": page,
            "page_size": page_size,
            "total": len(tasks),
        }
    )


@app.post("/api/v1/tasks")
def create_v1_task(
    payload: CreateTaskIn,
    authorization: Optional[str] = Header(None),
    idempotency_key: Optional[str] = Header(None),
):
    init_db()
    user = require_user(authorization)
    if not user:
        return api_error(401, 40102, "unauthorized")
    if user["role"] not in {"sender", "admin"}:
        return api_error(403, 40301, "forbidden")

    timestamp = now_iso()
    with get_connection() as conn:
        if idempotency_key:
            existing = conn.execute(
                """
                SELECT * FROM task_handoff
                WHERE owner_user_id = ? AND idempotency_key = ?
                """,
                (user["user_id"], idempotency_key),
            ).fetchone()
            if existing:
                return api_success(enrich_task(existing, conn), "task created")

        task_id = generate_task_id(conn)
        sender = user["organization"] or user["display_name"]
        cursor = conn.execute(
            """
            INSERT INTO task_handoff (
                task_id, device_id, sample_name, sender, receiver, carrier,
                status, started_at, signed_at, updated_at,
                owner_user_id, batch, expected_arrival, box_id, seal_id,
                temperature_min, temperature_max, idempotency_key
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task_id,
                payload.device_id,
                payload.sample_name,
                sender,
                payload.receiver or "",
                payload.carrier or "",
                "pending_pack",
                None,
                None,
                timestamp,
                user["user_id"],
                payload.batch,
                payload.expected_arrival,
                payload.box_id,
                payload.seal_id,
                payload.temperature_min,
                payload.temperature_max,
                idempotency_key,
            ),
        )
        row = conn.execute(
            "SELECT * FROM task_handoff WHERE rowid = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return api_success(enrich_task(row, conn), "task created")


@app.get("/api/v1/tasks/{task_id}")
def get_v1_task(task_id: str, authorization: Optional[str] = Header(None)):
    init_db()
    user = require_user(authorization)
    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if row and not can_view_task(user, serialize_task(row)):
            return api_error(404, 40401, "task not found")
    if not row:
        return api_error(404, 40401, "task not found")
    return api_success(enrich_task(row, conn))


@app.patch("/api/v1/tasks/{task_id}")
def update_v1_task(
    task_id: str,
    payload: UpdateTaskIn,
    authorization: Optional[str] = Header(None),
):
    init_db()
    user = require_user(authorization)
    if not user:
        return api_error(401, 40102, "unauthorized")

    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if not row:
            return api_error(404, 40401, "task not found")
        task = serialize_task(row)
        if not can_modify_task(user, task):
            return api_error(404, 40401, "task not found")
        if task["status"] not in {"pending_pack", "pending_handoff"}:
            return task_state_conflict()

        allowed = {
            "sample_name",
            "batch",
            "receiver",
            "carrier",
            "expected_arrival",
            "device_id",
            "box_id",
            "seal_id",
            "temperature_min",
            "temperature_max",
        }
        changes = payload.model_dump(exclude_unset=True)
        assignments = []
        values = []
        for key, value in changes.items():
            if key in allowed:
                assignments.append(f"{key} = ?")
                values.append(value)
        if assignments:
            assignments.append("updated_at = ?")
            values.append(now_iso())
            values.append(task_id)
            conn.execute(
                f"UPDATE task_handoff SET {', '.join(assignments)} WHERE task_id = ?",
                values,
            )
        updated = get_task_by_id(conn, task_id)
    return api_success(enrich_task(updated, conn), "task updated")


@app.post("/api/v1/tasks/{task_id}/assign")
def assign_v1_task(
    task_id: str,
    payload: AssignTaskIn,
    authorization: Optional[str] = Header(None),
):
    init_db()
    user = require_user(authorization)
    if not user:
        return api_error(401, 40102, "unauthorized")

    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if not row:
            return api_error(404, 40401, "task not found")
        task = serialize_task(row)
        if not can_modify_task(user, task):
            return api_error(404, 40401, "task not found")
        if task["status"] not in {"pending_pack", "pending_handoff"}:
            return task_state_conflict()

        conn.execute(
            """
            UPDATE task_handoff
            SET carrier_user_id = ?, receiver_user_id = ?, updated_at = ?
            WHERE task_id = ?
            """,
            (
                payload.carrier_user_id,
                payload.receiver_user_id,
                now_iso(),
                task_id,
            ),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(enrich_task(updated, conn), "task assigned")


@app.post("/api/v1/tasks/{task_id}/cancel")
def cancel_v1_task(
    task_id: str,
    authorization: Optional[str] = Header(None),
    reason: Optional[str] = Body(default=None, embed=True),
):
    init_db()
    user = require_user(authorization)
    if not user:
        return api_error(401, 40102, "unauthorized")

    timestamp = now_iso()
    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if not row:
            return api_error(404, 40401, "task not found")
        task = serialize_task(row)
        if not can_modify_task(user, task):
            return api_error(404, 40401, "task not found")
        if task["status"] in {"in_transit", "arrived", "signed", "rejected", "canceled"}:
            return task_state_conflict()
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, canceled_at = ?, cancel_reason = ?, updated_at = ?
            WHERE task_id = ?
            """,
            ("canceled", timestamp, reason, timestamp, task_id),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(enrich_task(updated, conn), "task canceled")


@app.post("/api/v1/tasks/{task_id}/precheck")
def precheck_v1_task(
    task_id: str,
    payload: PrecheckTaskIn,
    authorization: Optional[str] = Header(None),
):
    init_db()
    user = require_user(authorization)
    if not user:
        return api_error(401, 40102, "unauthorized")

    timestamp = now_iso()
    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if not row:
            return api_error(404, 40401, "task not found")
        task = serialize_task(row)
        if not can_modify_task(user, task):
            return api_error(404, 40401, "task not found")
        if task["status"] != "pending_pack":
            return task_state_conflict()
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, precheck_passed = ?, precheck_temperature = ?,
                precheck_seal_ok = ?, precheck_note = ?, prechecked_at = ?,
                updated_at = ?
            WHERE task_id = ?
            """,
            (
                "pending_handoff" if payload.passed else "pending_pack",
                1 if payload.passed else 0,
                payload.temperature,
                None if payload.seal_ok is None else int(payload.seal_ok),
                payload.note,
                timestamp,
                timestamp,
                task_id,
            ),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(enrich_task(updated, conn), "task prechecked")


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
        {"limit": limit, "items": [normalize_event(row) for row in rows]}
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
                arrived_at = NULL, rejected_at = NULL,
                rejection_reason = NULL, updated_at = ?
            WHERE task_id = ?
            """,
            ("in_transit", timestamp, timestamp, task_id),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(enrich_task(updated, conn), "task started")


@app.post("/api/v1/tasks/{task_id}/arrive")
def arrive_v1_task(task_id: str):
    init_db()
    timestamp = now_iso()
    with get_connection() as conn:
        row = get_task_by_id(conn, task_id)
        if not row:
            return api_error(404, 40401, "task not found")
        if canonical_task_status(row_to_dict(row)) != "in_transit":
            return task_state_conflict()
        conn.execute(
            """
            UPDATE task_handoff
            SET status = ?, arrived_at = ?, updated_at = ?
            WHERE task_id = ?
            """,
            ("arrived", timestamp, timestamp, task_id),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(enrich_task(updated, conn), "task arrived")


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
            ("signed", timestamp, timestamp, task_id),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(enrich_task(updated, conn), "task signed")


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
            ("rejected", timestamp, reason, timestamp, task_id),
        )
        updated = get_task_by_id(conn, task_id)
    return api_success(enrich_task(updated, conn), "task rejected")


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
        <div><div class="label">异常事件</div><div id="abnormalCount">--</div></div>
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
    const STATUS_LABELS = {
      pending_pack: "待发出",
      pending_handoff: "待发出",
      in_transit: "运输中",
      arrived: "已到达",
      signed: "已签收",
      rejected: "已拒收",
      canceled: "已取消"
    };

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
      showValue("abnormalCount", task.abnormal_count);
      const status = document.getElementById("taskStatus");
      status.textContent = STATUS_LABELS[task.status] || task.status || "--";
      const isAlert = task.abnormal_count > 0 || task.status === "rejected";
      status.className = isAlert ? "task-status alert" : "task-status";
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
          <td class="${item.event_type === "NORMAL" ? "" : "event"}">${item.event_display || item.event_type}</td>
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
