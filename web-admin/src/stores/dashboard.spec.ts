import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { dashboardMock } = vi.hoisted(() => ({ dashboardMock: { getSummary: vi.fn() } }))

vi.mock('../services/config', () => ({ runtimeConfig: { dataSource: 'api' } }))
vi.mock('../services/api', () => ({
  remoteDashboardGateway: dashboardMock,
  describeApiError: (error: unknown) => error instanceof Error ? error.message : '请求失败',
}))

import { useDashboardStore } from './dashboard'

describe('dashboard store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
  })

  it('shows a recoverable error, then replaces it after the next successful refresh', async () => {
    dashboardMock.getSummary.mockRejectedValueOnce(new Error('无法连接后端服务，请检查网络或服务是否运行'))
    dashboardMock.getSummary.mockResolvedValueOnce({ active_tasks: 2, abnormal_tasks: 1, online_devices: 3, offline_devices: 0, today_alarm_count: 1, status_distribution: { in_transit: 2 }, alarm_distribution: { TEMP_ALERT: 1 }, updated_at: '2026-07-24T10:00:00+08:00' })
    const store = useDashboardStore()

    await store.load()
    expect(store.error).toContain('无法连接后端服务')
    expect(store.summary).toBeNull()

    await store.load()
    expect(store.error).toBeNull()
    expect(store.summary?.active_tasks).toBe(2)
  })
})
