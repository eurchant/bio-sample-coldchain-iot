// 后端统一响应结构
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// 任务状态枚举
export type TaskStatus =
  | 'pending_pack'
  | 'pending_handoff'
  | 'in_transit'
  | 'arrived'
  | 'signed'
  | 'rejected'
  | 'canceled'

export type BoxStatus = 'BOX_OPEN' | 'BOX_CLOSED'
export type MoveStatus = 'STABLE' | 'MILD' | 'SEVERE' | 'IMPACT' | 'FREE_FALL'
export type TempStatus = 'TEMP_OK' | 'TEMP_ALERT'

// 任务详情
export interface Task {
  task_id: string
  device_id: string
  sample_name: string
  sender: string
  receiver: string
  carrier: string
  status: TaskStatus
  started_at: string | null
  signed_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  updated_at: string
}

// 遥测记录
export interface Telemetry {
  id: number
  device_id: string
  task_id: string
  temperature: number
  humidity: number
  light_raw: number
  box_status: BoxStatus
  move_status: MoveStatus
  temp_status: TempStatus
  acc_total: number
  motion_score: number
  event_type: string
  timestamp: string
  created_at: string
}

// 告警事件
export interface Alarm {
  id: number
  data_id: number
  task_id: string
  device_id: string
  event_type: string
  event_name: string
  event_detail: string
  timestamp: string
  created_at: string
}

// 遥测历史响应
export interface TelemetryHistory {
  limit: number
  items: Telemetry[]
}

// 告警列表响应
export interface AlarmList {
  limit: number
  items: Alarm[]
}

// 追溯报告
export interface TraceSummary {
  total_records: number
  min_temperature: number
  max_temperature: number
  avg_temperature: number
  min_humidity: number
  max_humidity: number
  event_count: number
}

export interface HandoffNode {
  type: 'started' | 'signed' | 'rejected'
  timestamp: string
  reason?: string
}

export interface TraceReport {
  task: Task
  latest: Telemetry | null
  summary: TraceSummary
  events: Alarm[]
  handoff_nodes: HandoffNode[]
}

// 操作接口的响应直接是 Task
export type TaskMutationResult = Task
