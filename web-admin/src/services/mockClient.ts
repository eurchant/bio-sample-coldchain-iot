import alarmsPayload from '../../../docs/api/mock/alarms.json'
import taskPayload from '../../../docs/api/mock/task-001.json'
import telemetryPayload from '../../../docs/api/mock/telemetry-latest.json'
import tracePayload from '../../../docs/api/mock/trace-report.json'
import type {
  AlarmList,
  ApiEnvelope,
  Task,
  Telemetry,
  TelemetryHistory,
  TraceReport,
} from '../types/contracts'
import { ApiError, type TaskGateway } from './api'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const initialTask = (taskPayload as ApiEnvelope<Task>).data
const initialTelemetry = (telemetryPayload as ApiEnvelope<Telemetry>).data
const initialAlarms = (alarmsPayload as ApiEnvelope<AlarmList>).data.items
const initialReport = (tracePayload as ApiEnvelope<TraceReport>).data

const task = clone(initialTask)
const telemetry = clone(initialTelemetry)
const alarms = clone(initialAlarms)

function buildReport(): TraceReport {
  const report = clone(initialReport)
  return {
    ...report,
    task: clone(task),
    latest: clone(telemetry),
    events: clone(alarms),
    handoff_nodes: clone(report.handoff_nodes),
  }
}

export const mockGateway: TaskGateway = {
  async getTask() {
    return clone(task)
  },
  async getLatestTelemetry() {
    return clone(telemetry)
  },
  async getTelemetryHistory(_taskId, limit) {
    const payload: TelemetryHistory = {
      limit,
      items: telemetry ? [clone(telemetry)] : [],
    }
    return payload
  },
  async getAlarms(_taskId, limit) {
    return {
      limit,
      items: clone(alarms).slice(0, limit),
    }
  },
  async getTraceReport() {
    return buildReport()
  },
  async startTask() {
    throw new ApiError('Mock 数据源仅提供查询样例；请切换到 API 数据源后发出交接')
  },
  async signTask() {
    throw new ApiError('Mock 数据源仅提供查询样例；请切换到 API 数据源后完成签收')
  },
  async rejectTask() {
    throw new ApiError('Mock 数据源仅提供查询样例；请切换到 API 数据源后提交拒收')
  },
  async acknowledgeAlarm() {
    throw new ApiError('Mock 数据源仅提供查询样例；请切换到 API 数据源后确认告警')
  },
  async resolveAlarm() {
    throw new ApiError('Mock 数据源仅提供查询样例；请切换到 API 数据源后处置告警')
  },
}
