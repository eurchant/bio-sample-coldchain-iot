import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  API_SESSION_STORAGE_KEY,
  AUTH_SESSION_INVALIDATED_EVENT,
  clearApiSession,
  readApiSession,
  saveApiSession,
} from './session'

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

describe('API session storage', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores a valid token only in session storage and restores its user context', () => {
    saveApiSession({ token: 'not-a-real-token', user })

    expect(readApiSession()).toEqual({ token: 'not-a-real-token', user })
    expect(window.localStorage?.getItem(API_SESSION_STORAGE_KEY) ?? null).toBeNull()
  })

  it('removes malformed session data instead of trusting it as an authorization context', () => {
    sessionStorage.setItem(API_SESSION_STORAGE_KEY, '{bad json')

    expect(readApiSession()).toBeNull()
    expect(sessionStorage.getItem(API_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('clears the token and notifies the app when an API session becomes invalid', () => {
    saveApiSession({ token: 'expired-token', user })
    const listener = vi.fn()
    window.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, listener)

    clearApiSession()

    expect(sessionStorage.getItem(API_SESSION_STORAGE_KEY)).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(AUTH_SESSION_INVALIDATED_EVENT, listener)
  })
})
