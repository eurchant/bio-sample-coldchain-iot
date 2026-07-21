import type { HandoffNode, Task, TaskStatus } from '../types/contracts'

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
    message: '后端未提供 GNSS 经纬度，不能显示真实地图轨迹。',
    requiredFields: ['latitude', 'longitude', 'timestamp'],
  }
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
