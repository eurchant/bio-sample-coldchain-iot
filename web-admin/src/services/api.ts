import axios, { type AxiosError } from 'axios'
import { runtimeConfig } from './config'
import type {
  AlarmList,
  ApiEnvelope,
  Task,
  Telemetry,
  TelemetryHistory,
  TraceReport,
} from '../types/contracts'

export class ApiError extends Error {
  public readonly status?: number
  public readonly code?: number
  public readonly details?: unknown

  constructor(
    message: string,
    status?: number,
    code?: number,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface TaskGateway {
  getTask(taskId: string): Promise<Task>
  getLatestTelemetry(taskId: string): Promise<Telemetry | null>
  getTelemetryHistory(taskId: string, limit: number): Promise<TelemetryHistory>
  getAlarms(taskId: string, limit: number): Promise<AlarmList>
  getTraceReport(taskId: string): Promise<TraceReport>
  startTask(taskId: string): Promise<Task>
  signTask(taskId: string): Promise<Task>
  rejectTask(taskId: string, reason: string): Promise<Task>
}

const http = axios.create({
  baseURL: runtimeConfig.apiBaseUrl,
  timeout: 8000,
})

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<Partial<ApiEnvelope<null>>>
    const body = axiosError.response?.data
    return new ApiError(
      body?.message || axiosError.message || '网络请求失败',
      axiosError.response?.status,
      body?.code,
      body,
    )
  }
  return new ApiError(error instanceof Error ? error.message : '未知接口错误')
}

function unpack<T>(payload: ApiEnvelope<T>) {
  if (payload.code !== 0) {
    throw new ApiError(payload.message || '业务请求失败', undefined, payload.code, payload)
  }
  return payload.data
}

async function request<T>(path: string, method: 'get' | 'post', body?: unknown, params?: unknown) {
  if (!runtimeConfig.apiBaseUrl) {
    throw new ApiError('未配置 VITE_API_BASE_URL，无法使用实时 API 数据源')
  }
  try {
    const response =
      method === 'get'
        ? await http.get<ApiEnvelope<T>>(path, { params })
        : await http.post<ApiEnvelope<T>>(path, body)
    return unpack(response.data)
  } catch (error) {
    throw normalizeError(error)
  }
}

export const remoteGateway: TaskGateway = {
  getTask: (taskId) => request<Task>('/api/v1/tasks/' + taskId, 'get'),
  getLatestTelemetry: (taskId) =>
    request<Telemetry | null>('/api/v1/tasks/' + taskId + '/telemetry/latest', 'get'),
  getTelemetryHistory: (taskId, limit) =>
    request<TelemetryHistory>('/api/v1/tasks/' + taskId + '/telemetry/history', 'get', undefined, {
      limit,
    }),
  getAlarms: (taskId, limit) =>
    request<AlarmList>('/api/v1/tasks/' + taskId + '/alarms', 'get', undefined, { limit }),
  getTraceReport: (taskId) => request<TraceReport>('/api/v1/tasks/' + taskId + '/trace-report', 'get'),
  startTask: (taskId) => request<Task>('/api/v1/tasks/' + taskId + '/start', 'post'),
  signTask: (taskId) => request<Task>('/api/v1/tasks/' + taskId + '/sign', 'post'),
  rejectTask: (taskId, reason) =>
    request<Task>('/api/v1/tasks/' + taskId + '/reject', 'post', { reason }),
}
