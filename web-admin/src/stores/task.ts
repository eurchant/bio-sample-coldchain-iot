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
  monitoringRequestId: number
  monitoringRefreshing: boolean
}

function displayError(error: unknown) {
  if (error instanceof ApiError) {
    const details = [
      error.status ? 'HTTP ' + error.status : '',
      error.code ? 'code ' + error.code : '',
    ].filter(Boolean)
    const suffix = details.length ? '（' + details.join(' / ') + '）' : ''
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
    monitoringRequestId: 0,
    monitoringRefreshing: false,
  }),
  actions: {
    clearError() {
      this.error = null
    },
    async bootstrap() {
      const requestId = ++this.monitoringRequestId
      this.loading = true
      this.error = null
      try {
        const [task, telemetry, history, alarms] = await Promise.all([
          gateway.getTask(runtimeConfig.taskId),
          gateway.getLatestTelemetry(runtimeConfig.taskId),
          gateway.getTelemetryHistory(runtimeConfig.taskId, 8),
          gateway.getAlarms(runtimeConfig.taskId, 20),
        ])
        if (requestId !== this.monitoringRequestId) return
        this.task = task
        this.telemetry = telemetry
        this.history = history.items
        this.alarms = alarms.items
        this.monitoringError = null
      } catch (error) {
        if (requestId !== this.monitoringRequestId) return
        const message = displayError(error)
        this.error = message
        this.monitoringError = message
      } finally {
        this.loading = false
      }
    },
    async refreshMonitoring() {
      if (this.monitoringRefreshing) return

      const requestId = ++this.monitoringRequestId
      this.monitoringRefreshing = true
      try {
        const previousTask = this.task
        const [taskResult, telemetryResult, historyResult, alarmsResult] = await Promise.allSettled([
          gateway.getTask(runtimeConfig.taskId),
          gateway.getLatestTelemetry(runtimeConfig.taskId),
          gateway.getTelemetryHistory(runtimeConfig.taskId, 8),
          gateway.getAlarms(runtimeConfig.taskId, 20),
        ])

        if (requestId !== this.monitoringRequestId) return

        if (taskResult.status === 'fulfilled') {
          this.task = taskResult.value
        }
        if (telemetryResult.status === 'fulfilled') {
          this.telemetry = telemetryResult.value
        }
        if (historyResult.status === 'fulfilled') {
          this.history = historyResult.value.items
        }
        if (alarmsResult.status === 'fulfilled') {
          this.alarms = alarmsResult.value.items
        }

        const failedResult = [taskResult, telemetryResult, historyResult, alarmsResult].find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        )
        if (failedResult) {
          this.monitoringError = displayError(failedResult.reason)
          return
        }

        this.monitoringError = null
        const taskChanged =
          previousTask?.status !== this.task?.status ||
          previousTask?.updated_at !== this.task?.updated_at
        if (taskChanged) {
          this.actionMessage = null
        }
        if (taskChanged && this.trace && !this.traceLoading) {
          void this.loadTrace()
        }
      } catch (error) {
        if (requestId === this.monitoringRequestId) {
          this.monitoringError = displayError(error)
        }
      } finally {
        this.monitoringRefreshing = false
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
