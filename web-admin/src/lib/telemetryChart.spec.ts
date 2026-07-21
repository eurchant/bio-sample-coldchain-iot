import { describe, expect, it } from 'vitest'
import { buildTelemetryChartData } from './telemetryChart'
import type { Telemetry } from '../types/contracts'

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

describe('telemetry ECharts data adapter', () => {
  it('sorts existing records by timestamp without mutating the source history', () => {
    const history = [
      telemetry({ id: 3, timestamp: '2026-07-21T10:32:00+08:00', temperature: 5.1 }),
      telemetry({ id: 1, timestamp: '2026-07-21T10:30:00+08:00', temperature: 4.2 }),
      telemetry({ id: 2, timestamp: '2026-07-21T10:31:00+08:00', temperature: 4.7 }),
    ]

    const chartData = buildTelemetryChartData(history)

    expect(chartData.points.map((point) => point.id)).toEqual([1, 2, 3])
    expect(history.map((item) => item.id)).toEqual([3, 1, 2])
  })

  it('returns an explicit empty state when there is no telemetry history', () => {
    const chartData = buildTelemetryChartData([])

    expect(chartData.points).toEqual([])
    expect(chartData.hasMeasurements).toBe(false)
  })

  it('keeps one chart point per source record and does not manufacture missing values', () => {
    const chartData = buildTelemetryChartData([
      telemetry({ id: 1, temperature: 4.1, humidity: 61.2 }),
      telemetry({ id: 2, timestamp: '2026-07-21T10:31:00+08:00', temperature: Number.NaN, humidity: 62.4 }),
    ])

    expect(chartData.points).toEqual([
      {
        id: 1,
        timestamp: '2026-07-21T10:30:00+08:00',
        temperature: 4.1,
        humidity: 61.2,
      },
      {
        id: 2,
        timestamp: '2026-07-21T10:31:00+08:00',
        temperature: null,
        humidity: 62.4,
      },
    ])
    expect(chartData.hasMeasurements).toBe(true)
  })
})
