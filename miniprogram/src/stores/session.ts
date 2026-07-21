import { defineStore } from 'pinia'
import type { UserRole } from '@/types/api'

const STORAGE_KEY = 'coldchain_demo_session'
export interface DemoUser { name: string; role: UserRole }

export const useSessionStore = defineStore('session', {
  state: () => ({ user: null as DemoUser | null, restored: false }),
  getters: { isAuthenticated: (state) => Boolean(state.user) },
  actions: {
    restore() {
      try { this.user = uni.getStorageSync(STORAGE_KEY) || null } catch { this.user = null }
      this.restored = true
    },
    selectIdentity(user: DemoUser) { this.user = user; uni.setStorageSync(STORAGE_KEY, user) },
    logout() { this.user = null; uni.removeStorageSync(STORAGE_KEY); uni.reLaunch({ url: '/pages/login/index' }) },
    requireSession() {
      if (!this.restored) this.restore()
      if (!this.user) { uni.reLaunch({ url: '/pages/login/index' }); return false }
      return true
    },
  },
})
