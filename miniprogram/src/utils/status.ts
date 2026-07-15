import type { TaskStatus } from '@/types/api'

export const taskStatusText: Record<TaskStatus, string> = {
  pending_pack: '待装箱', pending_handoff: '待发出', in_transit: '运输中', arrived: '已到达',
  signed: '已签收', rejected: '已拒收', canceled: '已取消',
}

export const canStartTask = (status: TaskStatus) => status === 'pending_pack' || status === 'pending_handoff'
export const formatTime = (value: string | null) => value ? new Date(value).toLocaleString() : '—'
