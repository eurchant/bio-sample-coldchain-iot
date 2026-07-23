import { defineStore } from 'pinia'
import { ApiError } from '../services/api'
import { runtimeConfig } from '../services/config'
import { gateway } from '../services/gateway'
import type { Alarm, Task, Telemetry, TelemetryHistory, TraceReport } from '../types/contracts'

type TaskAction = 'start' | 'sign' | 'reject'
type AlarmAction = 'acknowledge' | 'resolve'

interface TaskState {
  activeTaskId: string | null
  task: Task | null
  telemetry: Telemetry | null
  history: TelemetryHistory['items']
  alarms: Alarm[]
  trace: TraceReport | null
  loading: boolean
  traceLoading: boolean
  actionLoading: TaskAction | null
  alarmActionLoading: { alarmId: number; action: AlarmAction } | null
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

function createIdempotencyKey(action: string, taskId: string) {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `web-${action}-${taskId}-${randomId}`
}

export const useTaskStore = defineStore('task', {
  state: (): TaskState => ({
    activeTaskId: null,
    task: null,
    telemetry: null,
    history: [],
    alarms: [],
    trace: null,
    loading: false,
    traceLoading: false,
    actionLoading: null,
    alarmActionLoading: null,
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
    resolveTaskId(taskId?: string) {
      return taskId?.trim() || this.activeTaskId || (runtimeConfig.dataSource === 'mock' ? runtimeConfig.taskId : null)
    },
    resetTaskData() {
      this.task = null
      this.telemetry = null
      this.history = []
      this.alarms = []
      this.trace = null
      this.actionMessage = null
      this.monitoringError = null
    },
    async bootstrap(taskId?: string) {
      const requestedTaskId = this.resolveTaskId(taskId)
      if (!requestedTaskId) return
      const taskChanged = this.activeTaskId !== requestedTaskId
      this.activeTaskId = requestedTaskId
      if (taskChanged) this.resetTaskData()

      const requestId = ++this.monitoringRequestId
      this.loading = true
      this.error = null
      try {
        const [task, telemetry, history, alarms] = await Promise.all([
          gateway.getTask(requestedTaskId),
          gateway.getLatestTelemetry(requestedTaskId),
          gateway.getTelemetryHistory(requestedTaskId, 8),
          gateway.getAlarms(requestedTaskId, 20),
        ])
        if (requestId !== this.monitoringRequestId || this.activeTaskId !== requestedTaskId) return
        this.task = task
        this.telemetry = telemetry
        this.history = history.items
        this.alarms = alarms.items
        this.monitoringError = null
      } catch (error) {
        if (requestId !== this.monitoringRequestId || this.activeTaskId !== requestedTaskId) return
        const message = displayError(error)
        this.error = message
        this.monitoringError = message
      } finally {
        if (requestId === this.monitoringRequestId) this.loading = false
      }
    },
    async refreshMonitoring(taskId?: string) {
      if (this.monitoringRefreshing) return
      const requestedTaskId = this.resolveTaskId(taskId)
      if (!requestedTaskId || (this.activeTaskId && this.activeTaskId !== requestedTaskId)) return
      if (!this.activeTaskId) this.activeTaskId = requestedTaskId

      const requestId = ++this.monitoringRequestId
      this.monitoringRefreshing = true
      try {
        const previousTask = this.task
        const [taskResult, telemetryResult, historyResult, alarmsResult] = await Promise.allSettled([
          gateway.getTask(requestedTaskId),
          gateway.getLatestTelemetry(requestedTaskId),
          gateway.getTelemetryHistory(requestedTaskId, 8),
          gateway.getAlarms(requestedTaskId, 20),
        ])

        if (requestId !== this.monitoringRequestId || this.activeTaskId !== requestedTaskId) return

        if (taskResult.status === 'fulfilled') this.task = taskResult.value
        if (telemetryResult.status === 'fulfilled') this.telemetry = telemetryResult.value
        if (historyResult.status === 'fulfilled') this.history = historyResult.value.items
        if (alarmsResult.status === 'fulfilled') this.alarms = alarmsResult.value.items

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
        if (taskChanged) this.actionMessage = null
        if (taskChanged && this.trace && !this.traceLoading) {
          void this.loadTrace(requestedTaskId)
        }
      } catch (error) {
        if (requestId === this.monitoringRequestId) this.monitoringError = displayError(error)
      } finally {
        if (requestId === this.monitoringRequestId) this.monitoringRefreshing = false
      }
    },
    async loadTrace(taskId?: string) {
      const requestedTaskId = this.resolveTaskId(taskId)
      if (!requestedTaskId) return
      this.traceLoading = true
      try {
        const trace = await gateway.getTraceReport(requestedTaskId)
        if (this.activeTaskId === requestedTaskId) this.trace = trace
      } catch (error) {
        if (this.activeTaskId === requestedTaskId) this.error = displayError(error)
      } finally {
        if (this.activeTaskId === requestedTaskId) this.traceLoading = false
      }
    },
    async performAction(action: TaskAction, reason = '', taskId?: string) {
      const requestedTaskId = this.resolveTaskId(taskId)
      if (!requestedTaskId) {
        this.error = '未选择任务，无法提交交接操作。'
        return
      }
      if (!this.activeTaskId) this.activeTaskId = requestedTaskId
      this.actionLoading = action
      this.error = null
      this.actionMessage = null
      try {
        const idempotencyKey = createIdempotencyKey(action, requestedTaskId)
        const task =
          action === 'start'
            ? await gateway.startTask(requestedTaskId, idempotencyKey)
            : action === 'sign'
              ? await gateway.signTask(requestedTaskId, idempotencyKey)
              : await gateway.rejectTask(requestedTaskId, reason, idempotencyKey)
        if (this.activeTaskId !== requestedTaskId) return
        this.task = task
        this.actionMessage =
          action === 'start'
            ? '已发出交接，任务进入运输中。'
            : action === 'sign'
              ? '已完成到达签收。'
              : '已提交拒收原因。'
        await Promise.all([
          this.refreshMonitoring(requestedTaskId),
          this.loadTrace(requestedTaskId),
        ])
      } catch (error) {
        this.error = displayError(error)
      } finally {
        this.actionLoading = null
      }
    },
    async performAlarmAction(alarmId: number, action: AlarmAction, resolution = '') {
      if (action === 'resolve' && !resolution.trim()) {
        this.error = '请填写告警处置说明。'
        return
      }
      this.alarmActionLoading = { alarmId, action }
      this.error = null
      try {
        const updated =
          action === 'acknowledge'
            ? await gateway.acknowledgeAlarm(alarmId)
            : await gateway.resolveAlarm(alarmId, resolution.trim())
        this.alarms = this.alarms.map((alarm) =>
          alarm.id === alarmId ? { ...alarm, ...updated } : alarm,
        )
        this.actionMessage =
          action === 'acknowledge' ? '已确认告警，等待后续处置。' : '已记录告警处置结果。'
      } catch (error) {
        this.error = displayError(error)
      } finally {
        this.alarmActionLoading = null
      }
    },
  },
})
