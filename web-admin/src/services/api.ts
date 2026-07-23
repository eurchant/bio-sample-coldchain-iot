import axios, { type AxiosError } from 'axios'
import { runtimeConfig } from './config'
import { clearApiSession, readApiSession } from './session'
import type {
  Alarm,
  AlarmList,
  AuthLoginInput,
  AuthLoginResult,
  AuthPermissions,
  AuthUser,
  ApiEnvelope,
  CreateTaskInput,
  Device,
  DeviceBinding,
  DeviceBindingList,
  DeviceList,
  RegisterDeviceInput,
  Task,
  TaskList,
  TaskListQuery,
  Telemetry,
  TelemetryHistory,
  TraceReport,
  UpdateTaskInput,
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
  startTask(taskId: string, idempotencyKey?: string): Promise<Task>
  signTask(taskId: string, idempotencyKey?: string): Promise<Task>
  rejectTask(taskId: string, reason: string, idempotencyKey?: string): Promise<Task>
  acknowledgeAlarm(alarmId: number): Promise<Alarm>
  resolveAlarm(alarmId: number, resolution: string): Promise<Alarm>
}

export interface TaskDirectoryGateway {
  listTasks(query?: TaskListQuery): Promise<TaskList>
  createTask(input: CreateTaskInput, idempotencyKey: string): Promise<Task>
  updateTask(taskId: string, input: UpdateTaskInput): Promise<Task>
}

export interface AuthGateway {
  login(input: AuthLoginInput): Promise<AuthLoginResult>
  getMe(): Promise<AuthUser>
  getPermissions(token?: string): Promise<AuthPermissions>
  logout(): Promise<{ logged_out: boolean }>
}

export interface DeviceGateway {
  listDevices(): Promise<DeviceList>
  registerDevice(input: RegisterDeviceInput): Promise<Device>
  bindDevice(deviceId: string, taskId: string): Promise<DeviceBinding>
  unbindDevice(deviceId: string): Promise<Device>
  getBindings(deviceId: string): Promise<DeviceBindingList>
}

const http = axios.create({
  baseURL: runtimeConfig.apiBaseUrl,
  timeout: 8000,
})

http.interceptors.request.use((config) => {
  const token = readApiSession()?.token
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<Partial<ApiEnvelope<null>>>
    const body = axiosError.response?.data
    if (!axiosError.response) {
      const isTimeout = axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT'
      return new ApiError(
        isTimeout ? '后端响应超时，请检查网络或服务状态' : '无法连接后端服务，请检查网络或服务是否运行',
      )
    }
    if (axiosError.response.status === 401 && readApiSession()) {
      clearApiSession()
    }
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

type HttpMethod = 'get' | 'post' | 'patch'

async function request<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  params?: unknown,
  headers?: Record<string, string>,
) {
  if (!runtimeConfig.apiBaseUrl) {
    throw new ApiError('未配置 VITE_API_BASE_URL，无法使用实时 API 数据源')
  }
  try {
    const response =
      method === 'get'
        ? await http.get<ApiEnvelope<T>>(path, { params, headers })
        : method === 'post'
          ? await http.post<ApiEnvelope<T>>(path, body, { headers })
          : await http.patch<ApiEnvelope<T>>(path, body, { headers })
    return unpack(response.data)
  } catch (error) {
    throw normalizeError(error)
  }
}

function idempotencyHeaders(idempotencyKey: string | undefined) {
  return idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
}

function pathSegment(value: string) {
  return encodeURIComponent(value)
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
  startTask: (taskId, idempotencyKey) =>
    request<Task>('/api/v1/tasks/' + taskId + '/start', 'post', undefined, undefined, idempotencyHeaders(idempotencyKey)),
  signTask: (taskId, idempotencyKey) =>
    request<Task>('/api/v1/tasks/' + taskId + '/sign', 'post', undefined, undefined, idempotencyHeaders(idempotencyKey)),
  rejectTask: (taskId, reason, idempotencyKey) =>
    request<Task>(
      '/api/v1/tasks/' + taskId + '/reject',
      'post',
      { reason },
      undefined,
      idempotencyHeaders(idempotencyKey),
    ),
  acknowledgeAlarm: (alarmId) => request<Alarm>('/api/v1/alarms/' + alarmId + '/ack', 'post'),
  resolveAlarm: (alarmId, resolution) =>
    request<Alarm>('/api/v1/alarms/' + alarmId + '/resolve', 'post', { resolution }),
}

export const remoteTaskDirectory: TaskDirectoryGateway = {
  listTasks: (query = {}) => request<TaskList>('/api/v1/tasks', 'get', undefined, query),
  createTask: (input, idempotencyKey) =>
    request<Task>('/api/v1/tasks', 'post', input, undefined, idempotencyHeaders(idempotencyKey)),
  updateTask: (taskId, input) => request<Task>('/api/v1/tasks/' + taskId, 'patch', input),
}

export const remoteAuthGateway: AuthGateway = {
  login: (input) => request<AuthLoginResult>('/api/v1/auth/login', 'post', input),
  getMe: () => request<AuthUser>('/api/v1/auth/me', 'get'),
  getPermissions: (token) =>
    request<AuthPermissions>(
      '/api/v1/auth/permissions',
      'get',
      undefined,
      undefined,
      token ? { Authorization: `Bearer ${token}` } : undefined,
    ),
  logout: () => request<{ logged_out: boolean }>('/api/v1/auth/logout', 'post'),
}

export const remoteDeviceGateway: DeviceGateway = {
  listDevices: () => request<DeviceList>('/api/v1/devices', 'get'),
  registerDevice: (input) => request<Device>('/api/v1/devices', 'post', input),
  bindDevice: (deviceId, taskId) =>
    request<DeviceBinding>('/api/v1/devices/' + pathSegment(deviceId) + '/bind', 'post', { task_id: taskId }),
  unbindDevice: (deviceId) =>
    request<Device>('/api/v1/devices/' + pathSegment(deviceId) + '/unbind', 'post'),
  getBindings: (deviceId) =>
    request<DeviceBindingList>('/api/v1/devices/' + pathSegment(deviceId) + '/bindings', 'get'),
}

export async function downloadTaskTracePdf(taskId: string) {
  if (!runtimeConfig.apiBaseUrl) {
    throw new ApiError('未配置 VITE_API_BASE_URL，无法下载后端 PDF')
  }
  try {
    const response = await http.get('/api/v1/tasks/' + taskId + '/trace-report.pdf', {
      responseType: 'blob',
    })
    return response.data as Blob
  } catch (error) {
    throw normalizeError(error)
  }
}
