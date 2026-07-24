import { API_BASE_URL } from '../../config'
import type { ApiResponse } from '../types/api'

// 统一业务错误
export class ApiError extends Error {
  constructor(public code: number, message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions {
  // 完整路径，包含 /api/v1 前缀，例如 /api/v1/tasks/TASK-001
  url: string
  method: Method
  data?: Record<string, unknown> | string
  // 是否跳过 API_PREFIX 拼接（用于旧版 /api/device 接口）
  raw?: boolean
}

// 统一请求封装：
// - 拼接 API_BASE_URL
// - 解析 { code, message, data } 响应
// - 映射 HTTP 404 -> 业务码 40401、409 -> 40901
// - code !== 0 抛 ApiError
export async function request<T>(opts: RequestOptions): Promise<T> {
  const fullUrl = API_BASE_URL + opts.url

  const res = await uni.request({
    url: fullUrl,
    method: opts.method as UniApp.RequestOptions['method'],
    data: opts.data,
    header: { 'Content-Type': 'application/json' },
  })

  const status = res.statusCode
  let body: ApiResponse<T> | undefined
  if (res.data && typeof res.data === 'object') {
    body = res.data as ApiResponse<T>
  }

  // 非 2xx 或业务码非 0 视为错误
  const bizCode = body?.code
  if (status >= 400 || (bizCode !== undefined && bizCode !== 0)) {
    let code = bizCode
    if (code === undefined) {
      if (status === 404) code = 40401
      else if (status === 409) code = 40901
      else code = status
    }
    const message = body?.message || `HTTP ${status}`
    throw new ApiError(code, message, status)
  }

  // 部分旧接口可能没有统一结构，直接返回 data
  if (body && 'data' in body) {
    return body.data as T
  }
  return res.data as T
}
