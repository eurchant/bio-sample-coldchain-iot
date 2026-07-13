import type { BoxStatus, MoveStatus, TaskStatus, TemperatureStatus } from '../types/contracts'

const taskLabels: Record<TaskStatus, string> = {
  pending_pack: '待发出',
  pending_handoff: '待交接',
  in_transit: '运输中',
  arrived: '已到达',
  signed: '已签收',
  rejected: '已拒收',
  canceled: '已取消',
}

const boxLabels: Record<BoxStatus, string> = {
  BOX_OPEN: '箱体已打开',
  BOX_CLOSED: '箱体闭合',
}

const moveLabels: Record<MoveStatus, string> = {
  STABLE: '平稳',
  MILD: '轻微晃动',
  SEVERE: '剧烈晃动',
  IMPACT: '碰撞',
  FREE_FALL: '跌落',
}

const temperatureLabels: Record<TemperatureStatus, string> = {
  TEMP_OK: '温度正常',
  TEMP_ALERT: '温度异常',
}

export function taskLabel(value: TaskStatus) {
  return taskLabels[value]
}

export function boxLabel(value: BoxStatus) {
  return boxLabels[value]
}

export function moveLabel(value: MoveStatus) {
  return moveLabels[value]
}

export function temperatureLabel(value: TemperatureStatus) {
  return temperatureLabels[value]
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatValue(value: number | null | undefined, digits = 1) {
  return typeof value === 'number' ? value.toFixed(digits) : '—'
}

export function statusTone(value: TaskStatus | BoxStatus | MoveStatus | TemperatureStatus | string) {
  if (
    value === 'TEMP_ALERT' ||
    value === 'BOX_OPEN' ||
    value === 'SEVERE' ||
    value === 'IMPACT' ||
    value === 'FREE_FALL' ||
    value === 'rejected'
  ) {
    return 'danger'
  }
  if (value === 'in_transit' || value === 'MILD' || value === 'arrived') return 'warning'
  if (value === 'signed' || value === 'TEMP_OK' || value === 'BOX_CLOSED' || value === 'STABLE') {
    return 'safe'
  }
  return 'neutral'
}

export function isActionableStatus(status: TaskStatus) {
  return status === 'in_transit' || status === 'arrived'
}
