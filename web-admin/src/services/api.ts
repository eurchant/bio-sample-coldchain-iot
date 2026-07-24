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
  DashboardSummary,
  Device,
  DeviceBinding,
  DeviceBindingList,
  DeviceList,
  EvidenceFile,
  HandoffList,
  HandoffRecord,
  RegisterDeviceInput,
  QrTokenResult,
  QrVerificationResult,
  Task,
  TaskAssignmentInput,
  TaskList,
  TaskListQuery,
  TaskPrecheckInput,
  Telemetry,
  TelemetryHistory,
  TraceReport,
  UpdateTaskInput,
  UserCandidateList,
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

export interface TaskPreparationGateway {
  listCandidates(role: 'carrier' | 'receiver'): Promise<UserCandidateList>
  assignTask(taskId: string, input: TaskAssignmentInput): Promise<Task>
  precheckTask(taskId: string, input: TaskPrecheckInput): Promise<Task>
}

export interface HandoffGateway {
  listHandoffs(taskId: string): Promise<HandoffList>
  createHandoff(taskId: string, input: { handoff_type: HandoffRecord['handoff_type']; to_user_id: number }): Promise<HandoffRecord>
  createQrToken(taskId: string, input: { action: string; handoff_id: string; ttl_seconds?: number }): Promise<QrTokenResult>
  verifyQrToken(token: string): Promise<QrVerificationResult>
  confirmHandoff(handoffId: string, location?: { lat: number; lng: number; accuracy?: number }): Promise<HandoffRecord>
  rejectHandoff(handoffId: string, reason: string): Promise<HandoffRecord>
  uploadEvidence(input: { taskId: string; handoffId: string; usage: string; file: File; sha256: string }): Promise<EvidenceFile>
  downloadEvidence(fileId: string): Promise<Blob>
}

export interface DashboardGateway {
  getSummary(): Promise<DashboardSummary>
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

/**
 * Converts contract-level failures into actionable wording while retaining the
 * original error code for support and tests. It never grants access locally.
 */
export function describeApiError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : '请求失败，请稍后重试。'
  }

  if (error.status === 401) return '登录会话已失效，请重新登录。'
  if (error.status === 403) return '当前账号没有此操作权限，请使用被指派的身份或联系管理员。'
  if (error.status === 404) return '资源不存在，或当前账号无权查看该资源。'
  if (error.status === 429) return '请求过于频繁，请稍后再试。'
  if (error.code === 40902) return '发出前需完成承运方、接收方指派和装箱预检。'
  if (error.code === 40932) return '接收方需先验证本次交接的动态二维码，再确认交接。'
  if (error.code === 40933) return '签收前须完成“承运方 → 接收方”的二维码交接确认。'
  if (error.code === 40950) return '文件校验值不一致，请重新选择原始文件后上传。'
  if (error.status === 413) return '证据文件超过 5 MB，请压缩或选择更小的文件。'
  if (error.status === 415) return '仅支持内容真实有效的 JPEG、PNG 或 PDF 证据文件。'
  return error.message || '请求失败，请稍后重试。'
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

export const remoteTaskPreparation: TaskPreparationGateway = {
  listCandidates: (role) =>
    request<UserCandidateList>('/api/v1/users', 'get', undefined, { role, page: 1, page_size: 100 }),
  assignTask: (taskId, input) =>
    request<Task>('/api/v1/tasks/' + pathSegment(taskId) + '/assign', 'post', input),
  precheckTask: (taskId, input) =>
    request<Task>('/api/v1/tasks/' + pathSegment(taskId) + '/precheck', 'post', input),
}

export const remoteHandoffGateway: HandoffGateway = {
  listHandoffs: (taskId) =>
    request<HandoffList>('/api/v1/tasks/' + pathSegment(taskId) + '/handoffs', 'get', undefined, {
      page: 1,
      page_size: 100,
    }),
  createHandoff: (taskId, input) =>
    request<HandoffRecord>('/api/v1/tasks/' + pathSegment(taskId) + '/handoffs', 'post', input),
  createQrToken: (taskId, input) =>
    request<QrTokenResult>('/api/v1/tasks/' + pathSegment(taskId) + '/qr-tokens', 'post', input),
  verifyQrToken: (token) => request<QrVerificationResult>('/api/v1/qr-tokens/verify', 'post', { token }),
  confirmHandoff: (handoffId, location) =>
    request<HandoffRecord>('/api/v1/handoffs/' + pathSegment(handoffId) + '/confirm', 'post', {
      ...(location ? { location } : {}),
    }),
  rejectHandoff: (handoffId, reason) =>
    request<HandoffRecord>('/api/v1/handoffs/' + pathSegment(handoffId) + '/reject', 'post', { reason }),
  async uploadEvidence({ taskId, handoffId, usage, file, sha256 }) {
    if (!runtimeConfig.apiBaseUrl) {
      throw new ApiError('未配置 VITE_API_BASE_URL，无法上传真实证据文件')
    }
    const form = new FormData()
    form.append('task_id', taskId)
    form.append('usage', usage)
    form.append('related_type', 'handoff')
    form.append('related_id', handoffId)
    form.append('expected_sha256', sha256)
    form.append('file', file)
    try {
      const response = await http.post<ApiEnvelope<EvidenceFile>>('/api/v1/files/upload', form)
      return unpack(response.data)
    } catch (error) {
      throw normalizeError(error)
    }
  },
  async downloadEvidence(fileId) {
    if (!runtimeConfig.apiBaseUrl) {
      throw new ApiError('未配置 VITE_API_BASE_URL，无法下载证据文件')
    }
    try {
      const response = await http.get('/api/v1/files/' + pathSegment(fileId) + '/download', {
        responseType: 'blob',
      })
      return response.data as Blob
    } catch (error) {
      throw normalizeError(error)
    }
  },
}

export const remoteDashboardGateway: DashboardGateway = {
  getSummary: () => request<DashboardSummary>('/api/v1/dashboard/summary', 'get'),
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
