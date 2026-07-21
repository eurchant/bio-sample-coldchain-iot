import type { Alarm, Telemetry } from '../types/contracts'

export type TrendMetric = 'temperature' | 'humidity'

export interface TelemetryTrendPoint {
  id: number
  timestamp: string
  temperature: number | null
  humidity: number | null
  tempStatus: Telemetry['temp_status']
}

export interface MetricSummary {
  latest: number | null
  min: number | null
  max: number | null
  count: number
}

export interface DashboardMetrics {
  trend: TelemetryTrendPoint[]
  temperature: MetricSummary
  humidity: MetricSummary
  alarmCount: number
  hasTemperatureAlert: boolean
  hasBoxOpen: boolean
  hasMotionAlert: boolean
  hasCriticalSignal: boolean
}

interface TimestampedTrendPoint extends TelemetryTrendPoint {
  originalIndex: number
  timestampValue: number | null
}

function finiteValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function timestampValue(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Converts the backend's newest-first history response into chronological chart points.
 * Invalid timestamps are kept, but sorted after records with a valid timestamp.
 */
export function buildTelemetryTrend(
  history: readonly Telemetry[] | null | undefined,
): TelemetryTrendPoint[] {
  return (history ?? [])
    .map<TimestampedTrendPoint>((item, originalIndex) => ({
      id: item.id,
      timestamp: item.timestamp,
      temperature: finiteValue(item.temperature),
      humidity: finiteValue(item.humidity),
      tempStatus: item.temp_status,
      originalIndex,
      timestampValue: timestampValue(item.timestamp),
    }))
    .sort((left, right) => {
      if (left.timestampValue === null && right.timestampValue === null) {
        return left.originalIndex - right.originalIndex
      }
      if (left.timestampValue === null) return 1
      if (right.timestampValue === null) return -1
      return left.timestampValue - right.timestampValue || left.originalIndex - right.originalIndex
    })
    .map(({ originalIndex: _originalIndex, timestampValue: _timestampValue, ...point }) => point)
}

/**
 * Summarises a chart metric without inventing a zero for missing telemetry.
 * The latest live record is used for the current value; historical min/max stay
 * tied to the history endpoint unless history has not produced any records yet.
 */
export function getMetricSummary(
  trend: readonly TelemetryTrendPoint[],
  metric: TrendMetric,
  latest: Telemetry | null | undefined,
): MetricSummary {
  const values = trend
    .map((point) => point[metric])
    .filter((value): value is number => value !== null)
  const latestValue = finiteValue(latest?.[metric]) ?? values.at(-1) ?? null

  if (!values.length) {
    return latestValue === null
      ? { latest: null, min: null, max: null, count: 0 }
      : { latest: latestValue, min: latestValue, max: latestValue, count: 1 }
  }

  return {
    latest: latestValue,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  }
}

/** Builds dashboard-ready data exclusively from the task store's backend payloads. */
export function buildDashboardMetrics(
  history: readonly Telemetry[] | null | undefined,
  latest: Telemetry | null | undefined,
  alarms: readonly Alarm[] | null | undefined,
): DashboardMetrics {
  const trend = buildTelemetryTrend(history)
  const alarmCount = alarms?.length ?? 0
  const hasTemperatureAlert = latest?.temp_status === 'TEMP_ALERT'
  const hasBoxOpen = latest?.box_status === 'BOX_OPEN'
  const hasMotionAlert = Boolean(
    latest && ['SEVERE', 'IMPACT', 'FREE_FALL'].includes(latest.move_status),
  )

  return {
    trend,
    temperature: getMetricSummary(trend, 'temperature', latest),
    humidity: getMetricSummary(trend, 'humidity', latest),
    alarmCount,
    hasTemperatureAlert,
    hasBoxOpen,
    hasMotionAlert,
    hasCriticalSignal: alarmCount > 0 || hasTemperatureAlert || hasBoxOpen || hasMotionAlert,
  }
}

export interface TrendPathOptions {
  width?: number
  height?: number
  padding?: number
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Generates a simple SVG line path. It returns an empty path for absent data so
 * the caller can render an explicit no-data state rather than a misleading line.
 */
export function buildTrendPath(
  trend: readonly TelemetryTrendPoint[],
  metric: TrendMetric,
  options: TrendPathOptions = {},
) {
  const width = Math.max(options.width ?? 720, 1)
  const height = Math.max(options.height ?? 224, 1)
  const padding = Math.max(0, Math.min(options.padding ?? 18, width / 2, height / 2))
  const values = trend
    .map((point, index) => ({ index, value: point[metric] }))
    .filter((point): point is { index: number; value: number } => point.value !== null)

  if (!values.length) return ''

  const min = Math.min(...values.map((point) => point.value))
  const max = Math.max(...values.map((point) => point.value))
  const range = max - min
  const usableWidth = Math.max(width - padding * 2, 0)
  const usableHeight = Math.max(height - padding * 2, 0)
  const denominator = Math.max(trend.length - 1, 1)

  return values
    .map(({ index, value }, valueIndex) => {
      const x = trend.length === 1 ? width / 2 : padding + (index / denominator) * usableWidth
      const y =
        range === 0
          ? height / 2
          : height - padding - ((value - min) / range) * usableHeight
      return `${valueIndex === 0 ? 'M' : 'L'}${round(x)},${round(y)}`
    })
    .join(' ')
}
