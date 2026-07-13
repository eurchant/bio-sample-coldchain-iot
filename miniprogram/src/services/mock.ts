import type { ApiResponse, ContractMeta, Task, Telemetry } from '@/types/api'

const wait = () => new Promise((resolve) => setTimeout(resolve, 180))
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
let task: Task = {
  task_id: 'TASK-001', device_id: 'CLD-001', sample_name: '生物样本转运箱 A', sender: '高校实验室',
  receiver: '医院检验科', carrier: '演示人员', status: 'pending_handoff', started_at: null,
  signed_at: null, rejected_at: null, rejection_reason: null, updated_at: '2026-07-13T10:00:00+08:00',
}
const telemetry: Telemetry = {
  id: 1, device_id: 'CLD-001', task_id: 'TASK-001', temperature: 4.2, humidity: 62.5, light_raw: 120,
  box_status: 'BOX_CLOSED', move_status: 'STABLE', temp_status: 'TEMP_OK', acc_total: 9.81,
  motion_score: 0.2, event_type: 'NORMAL', timestamp: '2026-07-13T10:01:00+08:00', created_at: '2026-07-13T10:01:00+08:00',
}

export async function mockGetTask(taskId: string) { await wait(); if (taskId !== task.task_id) throw new Error('task not found'); return clone(task) }
export async function mockLatest(taskId: string) { await mockGetTask(taskId); return clone(telemetry) }
export async function mockStart(taskId: string) {
  await mockGetTask(taskId)
  if (!['pending_pack', 'pending_handoff'].includes(task.status)) throw new Error('任务当前状态不允许发出')
  const now = new Date().toISOString(); task = { ...task, status: 'in_transit', started_at: now, updated_at: now }; return clone(task)
}
export const mockContracts = async (): Promise<ContractMeta> => ({
  task_statuses: ['pending_pack', 'pending_handoff', 'in_transit', 'arrived', 'signed', 'rejected', 'canceled'],
  box_statuses: ['BOX_OPEN', 'BOX_CLOSED'], move_statuses: ['STABLE', 'MILD', 'SEVERE', 'IMPACT', 'FREE_FALL'],
  temperature_statuses: ['TEMP_OK', 'TEMP_ALERT'], timestamp_format: 'ISO 8601', field_naming: 'snake_case',
})
