import type { HandoffNode, Task, TaskStatus, Telemetry } from '../types/contracts'

export type HandoffProgressPhase =
  | 'not_started'
  | 'waiting_handoff'
  | 'in_transit'
  | 'awaiting_receipt'
  | 'signed'
  | 'rejected'
  | 'canceled'

export type HandoffRouteNodeId = 'sender' | 'carrier' | 'receiver'
export type HandoffRouteNodeState = 'complete' | 'active' | 'pending' | 'rejected' | 'canceled'

export interface HandoffProgress {
  phase: HandoffProgressPhase
  percent: number
  label: string
  activeNode: HandoffRouteNodeId | null
  terminal: boolean
}

export interface HandoffRouteNode {
  id: HandoffRouteNodeId
  title: string
  participant: string
  taskId: string
  state: HandoffRouteNodeState
  stateLabel: string
  timestamp: string | null
}

type RouteTask = Pick<
  Task,
  'task_id' | 'sender' | 'carrier' | 'receiver' | 'status' | 'started_at' | 'signed_at' | 'rejected_at'
>

export type GnssRequiredField = 'latitude' | 'longitude' | 'timestamp'

export interface GnssTrajectoryEmptyState {
  available: false
  points: readonly []
  title: string
  message: string
  requiredFields: readonly GnssRequiredField[]
}

export interface GnssTrajectoryPoint {
  id: number
  timestamp: string
  lat: number
  lng: number
  accuracy: number | null
}

export interface GnssTrajectory {
  available: boolean
  points: GnssTrajectoryPoint[]
  title: string
  message: string
}

export interface ProjectedGnssPoint extends GnssTrajectoryPoint {
  x: number
  y: number
}

export const HANDOFF_PROGRESS_BY_STATUS: Readonly<Record<TaskStatus, HandoffProgress>> = {
  pending_pack: {
    phase: 'not_started',
    percent: 0,
    label: '待发出',
    activeNode: 'sender',
    terminal: false,
  },
  pending_handoff: {
    phase: 'waiting_handoff',
    percent: 25,
    label: '待交接',
    activeNode: 'sender',
    terminal: false,
  },
  in_transit: {
    phase: 'in_transit',
    percent: 50,
    label: '运输中',
    activeNode: 'carrier',
    terminal: false,
  },
  arrived: {
    phase: 'awaiting_receipt',
    percent: 75,
    label: '已到达，待签收',
    activeNode: 'receiver',
    terminal: false,
  },
  signed: {
    phase: 'signed',
    percent: 100,
    label: '已签收',
    activeNode: null,
    terminal: true,
  },
  rejected: {
    phase: 'rejected',
    percent: 100,
    label: '已拒收',
    activeNode: 'receiver',
    terminal: true,
  },
  canceled: {
    phase: 'canceled',
    percent: 0,
    label: '已取消',
    activeNode: null,
    terminal: true,
  },
}

const NODE_STATES_BY_STATUS: Readonly<
  Record<TaskStatus, Readonly<Record<HandoffRouteNodeId, HandoffRouteNodeState>>>
> = {
  pending_pack: { sender: 'active', carrier: 'pending', receiver: 'pending' },
  pending_handoff: { sender: 'active', carrier: 'pending', receiver: 'pending' },
  in_transit: { sender: 'complete', carrier: 'active', receiver: 'pending' },
  arrived: { sender: 'complete', carrier: 'complete', receiver: 'active' },
  signed: { sender: 'complete', carrier: 'complete', receiver: 'complete' },
  rejected: { sender: 'complete', carrier: 'complete', receiver: 'rejected' },
  canceled: { sender: 'canceled', carrier: 'canceled', receiver: 'canceled' },
}

const nodeStateLabels: Record<HandoffRouteNodeState, string> = {
  complete: '已完成',
  active: '进行中',
  pending: '待处理',
  rejected: '已拒收',
  canceled: '已取消',
}

/**
 * Maps only contract task statuses to presentation progress. It does not infer
 * physical location or add status values outside the API enum.
 */
export function getHandoffProgress(status: TaskStatus): HandoffProgress {
  return { ...HANDOFF_PROGRESS_BY_STATUS[status] }
}

/**
 * Creates a semantic (non-geographic) chain-of-custody route from contract
 * participants and actual handoff timestamps. It intentionally contains no
 * latitude, longitude, or generated route geometry.
 */
export function buildHandoffRouteNodes(
  task: RouteTask,
  handoffNodes: readonly HandoffNode[] = [],
): HandoffRouteNode[] {
  const states = NODE_STATES_BY_STATUS[task.status]
  const startedAt = timestampFor(handoffNodes, 'started') ?? task.started_at
  const signedAt = timestampFor(handoffNodes, 'signed') ?? task.signed_at
  const rejectedAt = timestampFor(handoffNodes, 'rejected') ?? task.rejected_at

  return [
    createRouteNode('sender', '发出方', task.sender, task.task_id, states.sender, startedAt),
    createRouteNode('carrier', '承运方', task.carrier, task.task_id, states.carrier, null),
    createRouteNode(
      'receiver',
      '接收方',
      task.receiver,
      task.task_id,
      states.receiver,
      signedAt ?? rejectedAt,
    ),
  ]
}

/**
 * The current API contract does not expose GNSS data. Keep the map state
 * explicit so callers cannot accidentally render fabricated coordinates.
 */
export function getGnssTrajectoryEmptyState(): GnssTrajectoryEmptyState {
  return {
    available: false,
    points: [],
    title: '暂无真实地图轨迹',
    message: '当前任务后端未提供 GNSS 经纬度，不能显示真实地图轨迹。',
    requiredFields: ['latitude', 'longitude', 'timestamp'],
  }
}

/**
 * Keeps only coordinate pairs actually returned by the telemetry history. No
 * participant name, task address or Mock coordinate is used as a fallback.
 */
export function buildGnssTrajectory(history: readonly Telemetry[] = []): GnssTrajectory {
  const points = history
    .filter(
      (item): item is Telemetry & { lat: number; lng: number } =>
        Number.isFinite(item.lat) &&
        Number.isFinite(item.lng) &&
        Math.abs(item.lat as number) <= 90 &&
        Math.abs(item.lng as number) <= 180,
    )
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    .map((item) => ({
      id: item.id,
      timestamp: item.timestamp,
      lat: item.lat,
      lng: item.lng,
      accuracy: Number.isFinite(item.accuracy) ? item.accuracy ?? null : null,
    }))

  if (!points.length) {
    return {
      available: false,
      points: [],
      title: '暂无真实地图轨迹',
      message: getGnssTrajectoryEmptyState().message,
    }
  }

  return {
    available: true,
    points,
    title: '真实 GNSS 轨迹',
    message: '坐标仅来自后端遥测历史；未加载底图时以相对投影展示，不会推断或补造位置。',
  }
}

/**
 * Projects genuine longitude/latitude pairs for a lightweight trajectory
 * preview. This is deliberately not a geographic base map and never creates
 * points that were not received from the backend.
 */
export function projectGnssTrajectory(
  points: readonly GnssTrajectoryPoint[],
  width = 640,
  height = 260,
  padding = 28,
): ProjectedGnssPoint[] {
  if (!points.length) return []
  if (points.length === 1) {
    return [{ ...points[0], x: width / 2, y: height / 2 }]
  }

  const minLat = Math.min(...points.map((point) => point.lat))
  const maxLat = Math.max(...points.map((point) => point.lat))
  const minLng = Math.min(...points.map((point) => point.lng))
  const maxLng = Math.max(...points.map((point) => point.lng))
  const latRange = Math.max(maxLat - minLat, Number.EPSILON)
  const lngRange = Math.max(maxLng - minLng, Number.EPSILON)
  const usableWidth = Math.max(width - padding * 2, 0)
  const usableHeight = Math.max(height - padding * 2, 0)

  return points.map((point) => ({
    ...point,
    x: padding + ((point.lng - minLng) / lngRange) * usableWidth,
    y: height - padding - ((point.lat - minLat) / latRange) * usableHeight,
  }))
}

function createRouteNode(
  id: HandoffRouteNodeId,
  title: string,
  participant: string,
  taskId: string,
  state: HandoffRouteNodeState,
  timestamp: string | null,
): HandoffRouteNode {
  return {
    id,
    title,
    participant,
    taskId,
    state,
    stateLabel: nodeStateLabels[state],
    timestamp,
  }
}

function timestampFor(nodes: readonly HandoffNode[], type: HandoffNode['type']) {
  return nodes.find((node) => node.type === type)?.timestamp ?? null
}
