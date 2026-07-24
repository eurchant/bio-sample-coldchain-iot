import { defineStore } from 'pinia'
import { describeApiError, remoteAuthGateway } from '../services/api'
import { runtimeConfig } from '../services/config'
import { clearApiSession, readApiSession, saveApiSession } from '../services/session'
import type { AuthUser, UserRole } from '../types/contracts'

export const DEMO_ROLES = ['admin', 'sender', 'carrier', 'receiver'] as const
export type DemoRole = UserRole

export const AUTH_SESSION_KEY = 'coldchain.demo.role'

export const ROLE_LABELS: Record<DemoRole, string> = {
  admin: '管理员',
  sender: '发出方',
  carrier: '承运方',
  receiver: '接收方',
}

export interface DemoRoleOption {
  role: DemoRole
  label: string
  description: string
}

export const DEMO_ROLE_OPTIONS: readonly DemoRoleOption[] = [
  { role: 'admin', label: ROLE_LABELS.admin, description: '查看全部演示入口与任务进度' },
  { role: 'sender', label: ROLE_LABELS.sender, description: '查看任务发出与交接状态' },
  { role: 'carrier', label: ROLE_LABELS.carrier, description: '查看运输监控与异常信息' },
  { role: 'receiver', label: ROLE_LABELS.receiver, description: '查看到达签收与追溯报告' },
]

export function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === 'string' && (DEMO_ROLES as readonly string[]).includes(value)
}

export function roleLabel(role: DemoRole | null | undefined) {
  return role ? ROLE_LABELS[role] : '未登录'
}

/**
 * Only controls navigation affordances. The API is still the authority for
 * every resource and action permission.
 */
export function hasRoleAccess(
  role: DemoRole | null | undefined,
  allowedRoles: readonly DemoRole[] | undefined,
) {
  return !allowedRoles?.length || (role !== null && role !== undefined && allowedRoles.includes(role))
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function createDemoUser(role: DemoRole): AuthUser {
  return {
    user_id: 0,
    username: `demo_${role}`,
    phone: '',
    name: ROLE_LABELS[role],
    organization: '演示环境',
    status: 'active',
    role,
    display_name: ROLE_LABELS[role],
  }
}

function clearDemoRole() {
  getSessionStorage()?.removeItem(AUTH_SESSION_KEY)
}

interface AuthState {
  user: AuthUser | null
  permissions: string[]
  restored: boolean
  loading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    permissions: [],
    restored: false,
    loading: false,
    error: null,
  }),
  getters: {
    role: (state): DemoRole | null => state.user?.role ?? null,
    isAuthenticated: (state) => state.user !== null,
    roleLabel: (state) => roleLabel(state.user?.role),
    displayName: (state) => state.user?.display_name || state.user?.name || '未登录',
    isApiMode: () => runtimeConfig.dataSource === 'api',
  },
  actions: {
    async restore() {
      if (this.restored) return this.isAuthenticated
      this.loading = true
      this.error = null

      try {
        if (runtimeConfig.dataSource !== 'api') {
          const savedRole = getSessionStorage()?.getItem(AUTH_SESSION_KEY)
          this.user = isDemoRole(savedRole) ? createDemoUser(savedRole) : null
          if (savedRole && !this.user) clearDemoRole()
          this.permissions = []
          return this.isAuthenticated
        }

        const session = readApiSession()
        if (!session) {
          this.user = null
          this.permissions = []
          return false
        }

        const [user, permissionData] = await Promise.all([
          remoteAuthGateway.getMe(),
          remoteAuthGateway.getPermissions(),
        ])
        this.user = user
        this.permissions = permissionData.permissions
        saveApiSession({ token: session.token, user })
        return true
      } catch {
        clearApiSession({ notify: false })
        this.user = null
        this.permissions = []
        this.error = '登录会话已失效，请重新登录。'
        return false
      } finally {
        this.loading = false
        this.restored = true
      }
    },
    enterDemo(role: DemoRole) {
      this.user = createDemoUser(role)
      this.permissions = []
      this.restored = true
      this.error = null
      getSessionStorage()?.setItem(AUTH_SESSION_KEY, role)
    },
    async loginWithPassword(username: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const result = await remoteAuthGateway.login({ username, password })
        const permissions = await remoteAuthGateway.getPermissions(result.token)
        this.user = result.user
        this.permissions = permissions.permissions
        saveApiSession({ token: result.token, user: result.user })
        this.restored = true
        clearDemoRole()
        return true
      } catch (error) {
        clearApiSession({ notify: false })
        this.user = null
        this.permissions = []
        this.error = describeApiError(error)
        return false
      } finally {
        this.loading = false
      }
    },
    async logout() {
      this.error = null
      if (runtimeConfig.dataSource === 'api' && readApiSession()) {
        try {
          await remoteAuthGateway.logout()
        } catch {
          // Local logout must still succeed if the server is unreachable.
        }
      }
      clearApiSession({ notify: false })
      clearDemoRole()
      this.user = null
      this.permissions = []
      this.restored = true
    },
    handleSessionInvalidated() {
      clearDemoRole()
      this.user = null
      this.permissions = []
      this.restored = true
      this.error = '登录会话已失效，请重新登录。'
    },
    clearError() {
      this.error = null
    },
    hasPermission(permission: string) {
      return runtimeConfig.dataSource !== 'api' || this.permissions.includes(permission)
    },
  },
})
