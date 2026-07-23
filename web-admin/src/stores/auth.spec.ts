import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AUTH_SESSION_KEY, useAuthStore } from './auth'

describe('demo auth store', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('persists the selected demo role for the current browser session', () => {
    const store = useAuthStore()

    store.enterDemo('carrier')

    expect(store.role).toBe('carrier')
    expect(store.isAuthenticated).toBe(true)
    expect(store.roleLabel).toBe('承运方')
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBe('carrier')
  })

  it('restores a valid demo role from the current browser session', async () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'receiver')
    const store = useAuthStore()

    await store.restore()

    expect(store.role).toBe('receiver')
    expect(store.isAuthenticated).toBe(true)
    expect(store.restored).toBe(true)
  })

  it('clears the selected demo role when logging out', async () => {
    const store = useAuthStore()
    store.enterDemo('admin')

    await store.logout()

    expect(store.role).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull()
  })
})
