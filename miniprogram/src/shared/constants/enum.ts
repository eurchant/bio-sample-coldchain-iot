import type { TaskStatus, BoxStatus, MoveStatus, TempStatus } from '../types/api'

// 前端保存英文值，显示时映射为中文
export const TASK_STATUS_CN: Record<TaskStatus, string> = {
  pending_pack: '待打包',
  pending_handoff: '待交接',
  in_transit: '运输中',
  arrived: '已到达',
  signed: '已签收',
  rejected: '已拒收',
  canceled: '已取消',
}

export const MOVE_STATUS_CN: Record<MoveStatus, string> = {
  STABLE: '平稳',
  MILD: '轻微晃动',
  SEVERE: '剧烈晃动',
  IMPACT: '碰撞',
  FREE_FALL: '跌落',
}

export const BOX_STATUS_CN: Record<BoxStatus, string> = {
  BOX_OPEN: '已开箱',
  BOX_CLOSED: '已闭合',
}

export const TEMP_STATUS_CN: Record<TempStatus, string> = {
  TEMP_OK: '温度正常',
  TEMP_ALERT: '温度异常',
}

// 语义键：success / warn / crit / info / neutral，对应 DESIGN.md §2 语义色板
export type Semantic = 'success' | 'warn' | 'crit' | 'info' | 'neutral'

export const TASK_STATUS_SEMANTIC: Record<TaskStatus, Semantic> = {
  pending_pack: 'neutral',
  pending_handoff: 'warn',
  in_transit: 'info',
  arrived: 'info',
  signed: 'success',
  rejected: 'crit',
  canceled: 'neutral',
}

export const TEMP_STATUS_SEMANTIC: Record<TempStatus, Semantic> = {
  TEMP_OK: 'success',
  TEMP_ALERT: 'crit',
}

export const MOVE_STATUS_SEMANTIC: Record<MoveStatus, Semantic> = {
  STABLE: 'success',
  MILD: 'warn',
  SEVERE: 'crit',
  IMPACT: 'crit',
  FREE_FALL: 'crit',
}

export const BOX_STATUS_SEMANTIC: Record<BoxStatus, Semantic> = {
  BOX_OPEN: 'warn',
  BOX_CLOSED: 'success',
}

// 告警事件类型中文
export const EVENT_TYPE_CN: Record<string, string> = {
  NORMAL: '正常',
  TEMP_ALERT: '温度异常',
  BOX_OPEN: '开箱',
  BOX_OPENED: '开箱',
  MOTION: '晃动',
  IMPACT: '碰撞',
  FREE_FALL: '跌落',
  SEVERE: '剧烈晃动',
}

// 告警事件语义（用于时间线圆点与徽标）
export const EVENT_TYPE_SEMANTIC: Record<string, Semantic> = {
  NORMAL: 'success',
  TEMP_ALERT: 'crit',
  BOX_OPEN: 'warn',
  BOX_OPENED: 'warn',
  MOTION: 'warn',
  IMPACT: 'crit',
  FREE_FALL: 'crit',
  SEVERE: 'crit',
  MILD: 'warn',
}
