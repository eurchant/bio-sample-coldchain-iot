import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { preparationMock } = vi.hoisted(() => ({
  preparationMock: { listCandidates: vi.fn(), assignTask: vi.fn(), precheckTask: vi.fn() },
}))

vi.mock('../services/config', () => ({ runtimeConfig: { dataSource: 'api' } }))
vi.mock('../services/api', () => ({
  remoteTaskPreparation: preparationMock,
  describeApiError: (error: unknown) => error instanceof Error ? error.message : '请求失败',
}))

import { useTaskPreparationStore } from './taskPreparation'

describe('task preparation store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
  })

  it('uses the role-specific candidate endpoints and hides inactive users', async () => {
    preparationMock.listCandidates
      .mockResolvedValueOnce({ items: [{ user_id: 2, name: '承运甲', organization: '冷链', role: 'carrier', status: 'active' }, { user_id: 9, name: '停用承运', organization: '冷链', role: 'carrier', status: 'disabled' }] })
      .mockResolvedValueOnce({ items: [{ user_id: 3, name: '接收乙', organization: '医院', role: 'receiver', status: 'active' }] })
    const store = useTaskPreparationStore()

    await store.loadCandidates()

    expect(preparationMock.listCandidates).toHaveBeenNthCalledWith(1, 'carrier')
    expect(preparationMock.listCandidates).toHaveBeenNthCalledWith(2, 'receiver')
    expect(store.carriers.map((user) => user.user_id)).toEqual([2])
    expect(store.receivers.map((user) => user.user_id)).toEqual([3])
  })

  it('does not report a precheck success when the server rejects it', async () => {
    preparationMock.precheckTask.mockRejectedValue(new Error('发出前需完成承运方、接收方指派和装箱预检。'))
    const store = useTaskPreparationStore()

    const result = await store.precheck('TASK-001', { passed: true, seal_ok: true })

    expect(result).toBeNull()
    expect(store.message).toBeNull()
    expect(store.error).toContain('发出前需完成')
  })
})
