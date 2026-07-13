import { defineStore } from 'pinia'
import { ApiError } from '../services/api'
import { runtimeConfig } from '../services/config'
import { gateway } from '../services/gateway'
import type { Alarm, Task, Telemetry, TelemetryHistory, TraceReport } from '../types/contracts'

type TaskAction = 'start' | 'sign' | 'reject'

interface TaskState {
  task: Task | null
  telemetry: Telemetry | null
  history: TelemetryHistory['items']
  alarms: Alarm[]
  trace: TraceReport | null
  loading: boolean
  traceLoading: boolean
  actionLoading: TaskAction | null
  error: string | null
  monitoringError: string | null
  actionMessage: string | null
}

function displayError(error: unknown) {
  if (error instanceof ApiError) {
    const suffix = error.status ? '（HTTP ' + error.status + (error.code ? ' / code ' + error.code : '') + '）' : ''
    return error.message + suffix
  }
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}

export const useTaskStore = defineStore('task', {
  state: (): TaskState => ({
    task: null,
    telemetry: null,
    history: [],
    alarms: [],
    trace: null,
    loading: false,
    traceLoading: false,
    actionLoading: null,
    error: null,
    monitoringError: null,
    actionMessage: null,
  }),
  actions: {
    clearError() {
      this.error = null
    },
    async bootstrap() {
      this.loading = true
      this.error = null
      try {
        const [task, telemetry, history, alarms] = await Promise.all([
          gateway.getTask(runtimeConfig.taskId),
          gateway.getLatestTelemetry(runtimeConfig.taskId),
          gateway.getTelemetryHistory(runtimeConfig.taskId, 8),
          gateway.getAlarms(runtimeConfig.taskId, 20),
        ])
        this.task = task
        this.telemetry = telemetry
        this.history = history.items
        this.alarms = alarms.items
        this.monitoringError = null
      } catch (error) {
        this.error = displayError(error)
      } finally {
        this.loading = false
      }
    },
    async refreshMonitoring() {
      try {
        const [telemetry, history, alarms] = await Promise.all([
          gateway.getLatestTelemetry(runtimeConfig.taskId),
          gateway.getTelemetryHistory(runtimeConfig.taskId, 8),
          gateway.getAlarms(runtimeConfig.taskId, 20),
        ])
        this.telemetry = telemetry
        this.history = history.items
        this.alarms = alarms.items
        this.monitoringError = null
      } catch (error) {
        this.monitoringError = displayError(error)
      }
    },
    async loadTrace() {
      this.traceLoading = true
      try {
        this.trace = await gateway.getTraceReport(runtimeConfig.taskId)
      } catch (error) {
        this.error = displayError(error)
      } finally {
        this.traceLoading = false
      }
    },
    async performAction(action: TaskAction, reason = '') {
      this.actionLoading = action
      this.error = null
      this.actionMessage = null
      try {
        const task =
          action === 'start'
            ? await gateway.startTask(runtimeConfig.taskId)
            : action === 'sign'
              ? await gateway.signTask(runtimeConfig.taskId)
              : await gateway.rejectTask(runtimeConfig.taskId, reason)
        this.task = task
        this.actionMessage =
          action === 'start' ? '已发出交接，任务进入运输中。' : action === 'sign' ? '已完成到达签收。' : '已提交拒收原因。'
        await Promise.all([this.refreshMonitoring(), this.loadTrace()])
      } catch (error) {
        this.error = displayError(error)
      } finally {
        this.actionLoading = null
      }
    },
  },
})
