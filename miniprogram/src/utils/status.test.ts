import { describe, expect, it } from 'vitest'
import { canStartTask, taskStatusText } from './status'

describe('task status contract', () => {
  it('covers every frozen task status', () => {
    expect(Object.keys(taskStatusText)).toEqual([
      'pending_pack', 'pending_handoff', 'in_transit', 'arrived', 'signed', 'rejected', 'canceled',
    ])
  })
  it('only permits the two contract-compatible pre-start states', () => {
    expect(canStartTask('pending_pack')).toBe(true)
    expect(canStartTask('pending_handoff')).toBe(true)
    expect(canStartTask('in_transit')).toBe(false)
    expect(canStartTask('signed')).toBe(false)
  })
})
