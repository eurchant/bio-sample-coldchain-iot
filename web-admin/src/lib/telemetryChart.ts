import type { Telemetry } from '../types/contracts'

export interface TelemetryChartPoint {
  id: number
  timestamp: string
  temperature: number | null
  humidity: number | null
}

export interface TelemetryChartData {
  points: TelemetryChartPoint[]
  hasMeasurements: boolean
}

interface SortableTelemetryChartPoint extends TelemetryChartPoint {
  originalIndex: number
  sortTimestamp: number | null
}

function finiteMeasurement(value: number) {
  return Number.isFinite(value) ? value : null
}

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Adapts the telemetry history endpoint for the chart without adding any point
 * that was not returned by the backend. Backend history is newest-first, while
 * the time series needs chronological order.
 */
export function buildTelemetryChartData(
  history: readonly Telemetry[] | null | undefined,
): TelemetryChartData {
  const points = (history ?? [])
    .map<SortableTelemetryChartPoint>((item, originalIndex) => ({
      id: item.id,
      timestamp: item.timestamp,
      temperature: finiteMeasurement(item.temperature),
      humidity: finiteMeasurement(item.humidity),
      originalIndex,
      sortTimestamp: parseTimestamp(item.timestamp),
    }))
    .sort((left, right) => {
      if (left.sortTimestamp === null && right.sortTimestamp === null) {
        return left.originalIndex - right.originalIndex
      }
      if (left.sortTimestamp === null) return 1
      if (right.sortTimestamp === null) return -1
      return left.sortTimestamp - right.sortTimestamp || left.originalIndex - right.originalIndex
    })
    .map(({ originalIndex: _originalIndex, sortTimestamp: _sortTimestamp, ...point }) => point)

  return {
    points,
    hasMeasurements: points.some((point) => point.temperature !== null || point.humidity !== null),
  }
}
