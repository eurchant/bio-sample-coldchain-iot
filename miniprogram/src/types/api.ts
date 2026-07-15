export type TaskStatus = 'pending_pack' | 'pending_handoff' | 'in_transit' | 'arrived' | 'signed' | 'rejected' | 'canceled'
export type BoxStatus = 'BOX_OPEN' | 'BOX_CLOSED'
export type MoveStatus = 'STABLE' | 'MILD' | 'SEVERE' | 'IMPACT' | 'FREE_FALL'
export type TemperatureStatus = 'TEMP_OK' | 'TEMP_ALERT'
export type UserRole = 'admin' | 'sender' | 'carrier' | 'receiver'

export interface ApiResponse<T> { code: number; message: string; data: T }
export interface Task {
  task_id: string; device_id: string; sample_name: string; sender: string; receiver: string; carrier: string
  status: TaskStatus; started_at: string | null; signed_at: string | null; rejected_at: string | null
  rejection_reason: string | null; updated_at: string
}
export interface Telemetry {
  id: number; device_id: string; task_id: string; temperature: number; humidity: number; light_raw: number
  box_status: BoxStatus; move_status: MoveStatus; temp_status: TemperatureStatus; acc_total: number
  motion_score: number; event_type: string; timestamp: string; created_at: string
}
export interface ContractMeta {
  task_statuses: TaskStatus[]; box_statuses: BoxStatus[]; move_statuses: MoveStatus[]
  temperature_statuses: TemperatureStatus[]; timestamp_format: string; field_naming: string
}
