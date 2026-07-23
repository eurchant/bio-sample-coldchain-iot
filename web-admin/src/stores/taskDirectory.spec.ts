import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { directoryMock } = vi.hoisted(() => ({
  directoryMock: {
    listTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
  },
}))

vi.mock('../services/config', () => ({
  runtimeConfig: {
    dataSource: 'api',
    apiBaseUrl: 'http://example.test',
    taskId: 'TASK-001',
    pollingIntervalMs: 4000,
  },
}))

vi.mock('../services/api', () => {
  class ApiError extends Error {
    status?: number
    code?: number

    constructor(message: string, status?: number, code?: number) {
      super(message)
      this.status = status
      this.code = code
    }
  }
  return { ApiError, remoteTaskDirectory: directoryMock }
})

vi.mock('../services/gateway', () => ({ gateway: { getTask: vi.fn() } }))

import { useTaskDirectoryStore } from './taskDirectory'

const task = {
  task_id: 'WD-20260723-001',
  device_id: 'CLD-002',
  sample_name: '血液样本',
  sender: '高校实验室',
  receiver: '市医院检验科',
  carrier: '迅达冷链',
  status: 'pending_pack' as const,
  started_at: null,
  signed_at: null,
  rejected_at: null,
  rejection_reason: null,
  updated_at: '2026-07-23T09:00:00+08:00',
}

describe('task directory store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
    directoryMock.listTasks.mockResolvedValue({ items: [task], page: 1, page_size: 10, total: 1 })
  })

  it('passes actual status, keyword and pagination to the authenticated list endpoint', async () => {
    const store = useTaskDirectoryStore()

    await store.setFilters({ keyword: '血液', status: 'pending_pack' })

    expect(directoryMock.listTasks).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      keyword: '血液',
      status: 'pending_pack',
      updated_after: undefined,
    })
    expect(store.tasks).toEqual([task])
  })

  it('creates a task with a one-time idempotency key and refreshes the first page', async () => {
    const store = useTaskDirectoryStore()
    directoryMock.createTask.mockResolvedValue(task)

    const created = await store.create({ sample_name: '血液样本' })

    expect(created).toEqual(task)
    expect(directoryMock.createTask).toHaveBeenCalledWith(
      { sample_name: '血液样本' },
      expect.stringMatching(/^web-task-create-/),
    )
    expect(directoryMock.listTasks).toHaveBeenCalled()
  })
})
