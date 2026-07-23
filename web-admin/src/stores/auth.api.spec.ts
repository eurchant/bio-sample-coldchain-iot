import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { authGatewayMock, sessionMock } = vi.hoisted(() => ({
  authGatewayMock: {
    login: vi.fn(),
    getMe: vi.fn(),
    getPermissions: vi.fn(),
    logout: vi.fn(),
  },
  sessionMock: {
    clear: vi.fn(),
    read: vi.fn(),
    save: vi.fn(),
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

vi.mock('../services/api', () => ({ remoteAuthGateway: authGatewayMock }))

vi.mock('../services/session', () => ({
  clearApiSession: sessionMock.clear,
  readApiSession: sessionMock.read,
  saveApiSession: sessionMock.save,
}))

import { useAuthStore } from './auth'

const user = {
  user_id: 7,
  username: 'sender_demo',
  phone: 'sender_demo',
  name: '发货方',
  organization: '高校实验室',
  status: 'active',
  role: 'sender' as const,
  display_name: '发货方演示账号',
}

describe('API auth store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
  })

  it('clears the just-created session if permission loading fails after login', async () => {
    authGatewayMock.login.mockResolvedValue({ token: 'temporary-token', token_type: 'bearer', user })
    authGatewayMock.getPermissions.mockRejectedValue(new Error('permission endpoint unavailable'))
    const store = useAuthStore()

    const result = await store.loginWithPassword('sender_demo', 'unused-input')

    expect(result).toBe(false)
    expect(store.isAuthenticated).toBe(false)
    expect(sessionMock.save).not.toHaveBeenCalled()
    expect(sessionMock.clear).toHaveBeenCalledWith({ notify: false })
  })

  it('stores a session only after the permission context is available', async () => {
    authGatewayMock.login.mockResolvedValue({ token: 'temporary-token', token_type: 'bearer', user })
    authGatewayMock.getPermissions.mockResolvedValue({ role: 'sender', permissions: ['view_task'] })
    const store = useAuthStore()

    const result = await store.loginWithPassword('sender_demo', 'unused-input')

    expect(result).toBe(true)
    expect(store.permissions).toEqual(['view_task'])
    expect(authGatewayMock.getPermissions).toHaveBeenCalledWith('temporary-token')
    expect(sessionMock.save).toHaveBeenCalledWith({ token: 'temporary-token', user })
  })
})
