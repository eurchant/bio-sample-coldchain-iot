import { describe, expect, it } from 'vitest'
import {
  buildDashboardMetrics,
  buildTelemetryTrend,
  buildTrendPath,
} from './metrics'
import type { Alarm, Telemetry } from '../types/contracts'

function telemetry(overrides: Partial<Telemetry> = {}): Telemetry {
  return {
    id: 1,
    device_id: 'device-under-test',
    task_id: 'task-under-test',
    temperature: 4.2,
    humidity: 62.5,
    light_raw: 120,
    box_status: 'BOX_CLOSED',
    move_status: 'STABLE',
    temp_status: 'TEMP_OK',
    acc_total: 9.81,
    motion_score: 0.2,
    event_type: 'NORMAL',
    timestamp: '2026-07-21T10:30:00+08:00',
    created_at: '2026-07-21T10:30:00+08:00',
    ...overrides,
  }
}

function alarm(id: number): Alarm {
  return {
    id,
    data_id: id,
    task_id: 'task-under-test',
    device_id: 'device-under-test',
    event_type: 'TEMP_ALERT',
    event_name: '温度异常',
    event_detail: '测试告警',
    timestamp: '2026-07-21T10:30:00+08:00',
    created_at: '2026-07-21T10:30:00+08:00',
  }
}

describe('dashboard metric helpers', () => {
  it('sorts telemetry history in chronological order before building trend points', () => {
    const trend = buildTelemetryTrend([
      telemetry({ id: 3, timestamp: '2026-07-21T10:32:00+08:00', temperature: 5.1 }),
      telemetry({ id: 1, timestamp: '2026-07-21T10:30:00+08:00', temperature: 4.2 }),
      telemetry({ id: 2, timestamp: '2026-07-21T10:31:00+08:00', temperature: 4.7 }),
    ])

    expect(trend.map((point) => point.temperature)).toEqual([4.2, 4.7, 5.1])
    expect(trend.map((point) => point.timestamp)).toEqual([
      '2026-07-21T10:30:00+08:00',
      '2026-07-21T10:31:00+08:00',
      '2026-07-21T10:32:00+08:00',
    ])
  })

  it('returns presentation-safe empty metrics and no SVG line without telemetry', () => {
    const metrics = buildDashboardMetrics([], null, [])

    expect(metrics.temperature).toEqual({ latest: null, min: null, max: null, count: 0 })
    expect(metrics.humidity).toEqual({ latest: null, min: null, max: null, count: 0 })
    expect(metrics.alarmCount).toBe(0)
    expect(metrics.hasCriticalSignal).toBe(false)
    expect(buildTrendPath(metrics.trend, 'temperature')).toBe('')
  })

  it('derives ranges and alarm count from backend telemetry and alarm arrays', () => {
    const metrics = buildDashboardMetrics(
      [
        telemetry({ id: 1, temperature: 3.8, humidity: 58.5 }),
        telemetry({
          id: 2,
          timestamp: '2026-07-21T10:31:00+08:00',
          temperature: 5.4,
          humidity: 65.2,
        }),
      ],
      telemetry({
        id: 3,
        timestamp: '2026-07-21T10:32:00+08:00',
        temperature: 4.6,
        humidity: 61.3,
        temp_status: 'TEMP_ALERT',
      }),
      [alarm(1), alarm(2)],
    )

    expect(metrics.temperature).toEqual({ latest: 4.6, min: 3.8, max: 5.4, count: 2 })
    expect(metrics.humidity).toEqual({ latest: 61.3, min: 58.5, max: 65.2, count: 2 })
    expect(metrics.alarmCount).toBe(2)
    expect(metrics.hasCriticalSignal).toBe(true)
  })
})
