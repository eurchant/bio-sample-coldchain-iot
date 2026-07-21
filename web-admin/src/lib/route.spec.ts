import { describe, expect, it } from 'vitest'
import {
  buildHandoffRouteNodes,
  getGnssTrajectoryEmptyState,
  getHandoffProgress,
} from './route'
import type { Task, TaskStatus } from '../types/contracts'

function makeTask(status: TaskStatus): Task {
  return {
    task_id: 'TASK-ROUTE-001',
    device_id: 'CLD-ROUTE-001',
    sample_name: '验证样本',
    sender: '动态发出单位',
    carrier: '动态承运人员',
    receiver: '动态接收单位',
    status,
    started_at: '2026-07-21T09:00:00+08:00',
    signed_at: status === 'signed' ? '2026-07-21T10:00:00+08:00' : null,
    rejected_at: status === 'rejected' ? '2026-07-21T10:00:00+08:00' : null,
    rejection_reason: null,
    updated_at: '2026-07-21T10:00:00+08:00',
  }
}

describe('handoff route helpers', () => {
  it.each<[
    TaskStatus,
    string,
    number,
    string | null,
    boolean,
  ]>([
    ['pending_pack', 'not_started', 0, 'sender', false],
    ['pending_handoff', 'waiting_handoff', 25, 'sender', false],
    ['in_transit', 'in_transit', 50, 'carrier', false],
    ['arrived', 'awaiting_receipt', 75, 'receiver', false],
    ['signed', 'signed', 100, null, true],
    ['rejected', 'rejected', 100, 'receiver', true],
    ['canceled', 'canceled', 0, null, true],
  ])('maps %s to its handoff progress', (status, phase, percent, activeNode, terminal) => {
    expect(getHandoffProgress(status)).toMatchObject({ phase, percent, activeNode, terminal })
  })

  it('builds reusable semantic nodes from task participants without coordinates', () => {
    const nodes = buildHandoffRouteNodes(makeTask('signed'), [
      { type: 'started', timestamp: '2026-07-21T09:00:00+08:00' },
      { type: 'signed', timestamp: '2026-07-21T10:00:00+08:00' },
    ])

    expect(nodes).toEqual([
      expect.objectContaining({
        id: 'sender',
        participant: '动态发出单位',
        taskId: 'TASK-ROUTE-001',
        state: 'complete',
      }),
      expect.objectContaining({ id: 'carrier', participant: '动态承运人员', state: 'complete' }),
      expect.objectContaining({
        id: 'receiver',
        participant: '动态接收单位',
        timestamp: '2026-07-21T10:00:00+08:00',
        state: 'complete',
      }),
    ])
    expect(nodes.flatMap((node) => Object.keys(node))).not.toContain('latitude')
    expect(nodes.flatMap((node) => Object.keys(node))).not.toContain('longitude')
  })

  it('returns an explicit empty state when the contract has no GNSS trajectory', () => {
    const state = getGnssTrajectoryEmptyState()

    expect(state.available).toBe(false)
    expect(state.points).toEqual([])
    expect(state.requiredFields).toEqual(['latitude', 'longitude', 'timestamp'])
    expect(state.message).toContain('后端未提供 GNSS 经纬度')
  })
})
