import { request } from '../utils/request'
import { API_PREFIX } from '../../config'
import type {
  Task,
  Telemetry,
  TelemetryHistory,
  AlarmList,
  TraceReport,
} from '../types/api'

// GET /api/v1/tasks/{task_id} —— 任务详情
export function getTask(taskId: string): Promise<Task> {
  return request<Task>({ url: `${API_PREFIX}/tasks/${taskId}`, method: 'GET' })
}

// GET /api/v1/tasks/{task_id}/telemetry/latest —— 最新监测
export function getTelemetryLatest(taskId: string): Promise<Telemetry | null> {
  return request<Telemetry | null>({
    url: `${API_PREFIX}/tasks/${taskId}/telemetry/latest`,
    method: 'GET',
  })
}

// GET /api/v1/tasks/{task_id}/telemetry/history?limit=N —— 监测历史
export function getTelemetryHistory(taskId: string, limit = 100): Promise<TelemetryHistory> {
  return request<TelemetryHistory>({
    url: `${API_PREFIX}/tasks/${taskId}/telemetry/history?limit=${limit}`,
    method: 'GET',
  })
}

// GET /api/v1/tasks/{task_id}/alarms?limit=N —— 异常列表
export function getAlarms(taskId: string, limit = 100): Promise<AlarmList> {
  return request<AlarmList>({
    url: `${API_PREFIX}/tasks/${taskId}/alarms?limit=${limit}`,
    method: 'GET',
  })
}

// GET /api/v1/tasks/{task_id}/trace-report —— 追溯报告
export function getTraceReport(taskId: string): Promise<TraceReport> {
  return request<TraceReport>({
    url: `${API_PREFIX}/tasks/${taskId}/trace-report`,
    method: 'GET',
  })
}

// POST /api/v1/tasks/{task_id}/start —— 发出交接（zrq 不实现页面，保留供回归测试）
export function startTask(taskId: string): Promise<Task> {
  return request<Task>({ url: `${API_PREFIX}/tasks/${taskId}/start`, method: 'POST' })
}

// POST /api/v1/tasks/{task_id}/sign —— 签收
export function signTask(taskId: string): Promise<Task> {
  return request<Task>({ url: `${API_PREFIX}/tasks/${taskId}/sign`, method: 'POST' })
}

// POST /api/v1/tasks/{task_id}/reject —— 拒收
export function rejectTask(taskId: string, reason: string): Promise<Task> {
  return request<Task>({
    url: `${API_PREFIX}/tasks/${taskId}/reject`,
    method: 'POST',
    data: { reason },
  })
}
