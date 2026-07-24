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
export type TemperatureStatus = 'TEMP_OK' | 'TEMP_ALERT'
export type UserRole = 'admin' | 'sender' | 'carrier' | 'receiver'

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export interface Task {
  task_id: string
  device_id: string | null
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
  arrived_at?: string | null
  batch?: string | null
  expected_arrival?: string | null
  box_id?: string | null
  seal_id?: string | null
  temperature_min?: number | null
  temperature_max?: number | null
  owner_user_id?: number | null
  carrier_user_id?: number | null
  receiver_user_id?: number | null
  precheck_passed?: boolean | null
  precheck_temperature?: number | null
  precheck_seal_ok?: boolean | null
  precheck_note?: string | null
  abnormal_count?: number
  latest_temperature?: number | null
  latest_humidity?: number | null
  latest_box_status?: BoxStatus | null
  latest_move_status?: MoveStatus | null
  latest_temp_status?: TemperatureStatus | null
}

export interface TaskList {
  items: Task[]
  page: number
  page_size: number
  total: number
}

export interface TaskListQuery {
  status?: TaskStatus
  keyword?: string
  page?: number
  page_size?: number
  updated_after?: string
}

export interface CreateTaskInput {
  sample_name: string
  batch?: string
  receiver?: string
  carrier?: string
  expected_arrival?: string
  device_id?: string
  box_id?: string
  seal_id?: string
  temperature_min?: number
  temperature_max?: number
}

export type UpdateTaskInput = Partial<CreateTaskInput>

export interface AuthUser {
  user_id: number
  username: string
  phone: string
  name: string
  organization: string
  status: string
  role: UserRole
  display_name: string
}

export interface AuthLoginInput {
  username: string
  password: string
}

export interface AuthLoginResult {
  token: string
  token_type: 'bearer'
  user: AuthUser
}

export interface AuthPermissions {
  role: UserRole
  permissions: string[]
}

export interface Device {
  device_id: string
  device_name?: string | null
  model?: string | null
  status: string
  current_task_id?: string | null
  battery?: number | null
  last_seen_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface DeviceList {
  items: Device[]
}

export interface RegisterDeviceInput {
  device_id: string
  device_name?: string
  model?: string
}

export interface DeviceBinding {
  id?: number
  device_id: string
  task_id: string
  status: string
  bound_at?: string
  unbound_at?: string | null
}

export interface DeviceBindingList {
  items: DeviceBinding[]
}

export interface UserCandidate {
  user_id: number
  name: string
  display_name?: string | null
  organization: string
  role: Extract<UserRole, 'carrier' | 'receiver'>
  status: string
}

export interface UserCandidateList {
  items: UserCandidate[]
  page: number
  page_size: number
  total: number
}

export interface TaskAssignmentInput {
  carrier_user_id?: number | null
  receiver_user_id?: number | null
}

export interface TaskPrecheckInput {
  passed: boolean
  temperature?: number | null
  seal_ok?: boolean | null
  note?: string | null
}

export type HandoffType =
  | 'sender_to_carrier'
  | 'carrier_to_carrier'
  | 'carrier_to_receiver'

export interface HandoffUser {
  user_id: number
  name: string
  organization: string
  role: UserRole
}

export interface HandoffEvidence {
  qr_verified: boolean
  qr_verified_by_user_id: number | null
  face_status: string
  face_verified: boolean
  face_manual_review_required: boolean
  file_count: number
}

export interface HandoffRecord {
  handoff_id: string
  task_id: string
  handoff_type: HandoffType
  from_user_id: number | null
  to_user_id: number
  status: 'pending' | 'confirmed' | 'rejected' | string
  reason?: string | null
  created_at: string
  updated_at?: string | null
  confirmed_at?: string | null
  rejected_at?: string | null
  from_user?: HandoffUser | null
  to_user?: HandoffUser | null
  evidence: HandoffEvidence
}

export interface HandoffList {
  items: HandoffRecord[]
  page: number
  page_size: number
  total: number
}

export interface QrTokenResult {
  token_id: number
  token: string
  qr_payload: string
  expires_at: string
  refresh_after: number
}

export interface QrVerificationResult {
  valid: boolean
  token_id: number
  task_id: string
  handoff_id: string
  action: string
}

export interface EvidenceFile {
  id?: number
  file_id: string
  task_id: string
  file_name: string
  file_type: 'image/jpeg' | 'image/png' | 'application/pdf' | string
  file_size: number
  sha256: string
  usage: string
  related_type?: string | null
  related_id?: string | null
  created_at: string
  download_url?: string
}

export interface DashboardSummary {
  active_tasks: number
  abnormal_tasks: number
  online_devices: number
  offline_devices: number
  today_alarm_count: number
  status_distribution: Record<string, number>
  alarm_distribution: Record<string, number>
  updated_at: string
}

export interface Telemetry {
  id: number
  device_id: string
  task_id: string
  temperature: number
  humidity: number
  light_raw: number
  box_status: BoxStatus
  move_status: MoveStatus
  temp_status: TemperatureStatus
  acc_total: number
  motion_score: number
  event_type: string
  timestamp: string
  created_at: string
  sequence?: number | null
  battery?: number | null
  lat?: number | null
  lng?: number | null
  accuracy?: number | null
}

export interface Alarm {
  id: number
  data_id: number | null
  task_id: string
  device_id: string
  event_type: string
  event_name: string
  event_detail: string
  timestamp: string
  created_at: string
  alarm_status?: 'new' | 'acknowledged' | 'resolved' | string
  acknowledged_at?: string | null
  resolved_at?: string | null
  resolution?: string | null
}

export interface TelemetryHistory {
  limit: number
  items: Telemetry[]
}

export interface AlarmList {
  limit: number
  items: Alarm[]
}

export interface TraceSummary {
  total_records: number
  min_temperature: number | null
  max_temperature: number | null
  avg_temperature: number | null
  min_humidity: number | null
  max_humidity: number | null
  event_count: number
}

export interface HandoffNode {
  type: 'started' | 'arrived' | 'signed' | 'rejected'
  timestamp: string
  reason?: string | null
}

export interface TraceReport {
  task: Task
  latest: Telemetry | null
  summary: TraceSummary
  events: Alarm[]
  handoff_nodes: HandoffNode[]
}
