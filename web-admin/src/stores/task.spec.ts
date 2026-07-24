import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '../services/api'
import type { AlarmList, Task, Telemetry, TraceReport } from '../types/contracts'

const { gatewayMock } = vi.hoisted(() => ({
  gatewayMock: {
    getTask: vi.fn(),
    getLatestTelemetry: vi.fn(),
    getTelemetryHistory: vi.fn(),
    getAlarms: vi.fn(),
    getTraceReport: vi.fn(),
    startTask: vi.fn(),
    signTask: vi.fn(),
    rejectTask: vi.fn(),
    acknowledgeAlarm: vi.fn(),
    resolveAlarm: vi.fn(),
  },
}))

vi.mock('../services/gateway', () => ({ gateway: gatewayMock }))

import { useTaskStore } from './task'

const recordedAt = '2026-07-21T10:30:00+08:00'

function makeTask(status: Task['status'] = 'in_transit'): Task {
  return {
    task_id: 'TASK-001',
    device_id: 'CLD-001',
    sample_name: '血液样本',
    sender: '发出单位',
    receiver: '接收单位',
    carrier: '测试人员',
    status,
    started_at: status === 'pending_pack' ? null : recordedAt,
    signed_at: status === 'signed' ? recordedAt : null,
    rejected_at: null,
    rejection_reason: null,
    updated_at: status === 'signed' ? '2026-07-21T10:35:00+08:00' : recordedAt,
  }
}

const telemetry: Telemetry = {
  id: 1,
  device_id: 'CLD-001',
  task_id: 'TASK-001',
  temperature: 4.2,
  humidity: 62.5,
  light_raw: 120,
  box_status: 'BOX_CLOSED',
  move_status: 'STABLE',
  temp_status: 'TEMP_OK',
  acc_total: 9.81,
  motion_score: 0.2,
  event_type: 'normal',
  timestamp: recordedAt,
  created_at: recordedAt,
}

const alarms: AlarmList = { limit: 20, items: [] }

function makeTrace(task: Task): TraceReport {
  return {
    task,
    latest: telemetry,
    summary: {
      total_records: 1,
      min_temperature: 4.2,
      max_temperature: 4.2,
      avg_temperature: 4.2,
      min_humidity: 62.5,
      max_humidity: 62.5,
      event_count: 0,
    },
    events: [],
    handoff_nodes: task.status === 'signed' ? [{ type: 'signed', timestamp: recordedAt }] : [],
  }
}

function mockMonitoring(task: Task) {
  gatewayMock.getTask.mockResolvedValue(task)
  gatewayMock.getLatestTelemetry.mockResolvedValue(telemetry)
  gatewayMock.getTelemetryHistory.mockResolvedValue({ limit: 8, items: [telemetry] })
  gatewayMock.getAlarms.mockResolvedValue(alarms)
}

describe('task monitoring store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
    const task = makeTask()
    mockMonitoring(task)
    gatewayMock.getTraceReport.mockResolvedValue(makeTrace(task))
  })

  it('updates task status to signed on the next monitoring poll', async () => {
    const store = useTaskStore()
    store.task = makeTask('in_transit')

    const signedTask = makeTask('signed')
    mockMonitoring(signedTask)

    await store.refreshMonitoring()

    expect(gatewayMock.getTask).toHaveBeenCalledWith('TASK-001')
    expect(store.task?.status).toBe('signed')
    expect(store.monitoringError).toBeNull()
  })

  it('loads a trace report when the report URL is opened directly', async () => {
    const store = useTaskStore()
    const directTrace = makeTrace(makeTask('in_transit'))
    gatewayMock.getTraceReport.mockResolvedValue(directTrace)

    await store.loadTrace('TASK-001')

    expect(store.activeTaskId).toBe('TASK-001')
    expect(store.trace).toEqual(directTrace)
    expect(store.traceLoading).toBe(false)
  })

  it('keeps the last successful data after a connection failure and clears the notice on recovery', async () => {
    const store = useTaskStore()
    const originalTask = makeTask('in_transit')
    store.task = originalTask
    store.telemetry = telemetry

    const offlineError = new ApiError('无法连接后端服务，请检查网络或服务是否运行')
    gatewayMock.getTask.mockRejectedValueOnce(offlineError)
    gatewayMock.getLatestTelemetry.mockRejectedValueOnce(offlineError)
    gatewayMock.getTelemetryHistory.mockRejectedValueOnce(offlineError)
    gatewayMock.getAlarms.mockRejectedValueOnce(offlineError)

    await store.refreshMonitoring()

    expect(store.monitoringError).toContain('无法连接后端服务')
    expect(store.task).toEqual(originalTask)
    expect(store.telemetry).toEqual(telemetry)

    const signedTask = makeTask('signed')
    mockMonitoring(signedTask)
    await store.refreshMonitoring()

    expect(store.monitoringError).toBeNull()
    expect(store.task?.status).toBe('signed')
  })

  it('keeps the server response after a successful sign action', async () => {
    const store = useTaskStore()
    store.task = makeTask('in_transit')
    const signedTask = makeTask('signed')
    gatewayMock.signTask.mockResolvedValue(signedTask)
    mockMonitoring(signedTask)
    gatewayMock.getTraceReport.mockResolvedValue(makeTrace(signedTask))

    await store.performAction('sign')

    expect(store.task?.status).toBe('signed')
    expect(store.actionLoading).toBeNull()
    expect(store.actionMessage).toContain('签收')
  })

  it('updates an alarm from the server response after an administrator resolves it', async () => {
    const store = useTaskStore()
    store.alarms = [
      {
        id: 9,
        data_id: 1,
        task_id: 'TASK-001',
        device_id: 'CLD-001',
        event_type: 'TEMP_ALERT',
        event_name: '温度异常',
        event_detail: '温度超过阈值',
        timestamp: recordedAt,
        created_at: recordedAt,
        alarm_status: 'acknowledged',
      },
    ]
    gatewayMock.resolveAlarm.mockResolvedValue({
      ...store.alarms[0],
      alarm_status: 'resolved',
      resolution: '已完成复核',
    })

    await store.performAlarmAction(9, 'resolve', '已完成复核')

    expect(gatewayMock.resolveAlarm).toHaveBeenCalledWith(9, '已完成复核')
    expect(store.alarms[0].alarm_status).toBe('resolved')
    expect(store.alarms[0].resolution).toBe('已完成复核')
  })
})
