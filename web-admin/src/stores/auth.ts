import { defineStore } from 'pinia'

export const DEMO_ROLES = ['admin', 'sender', 'carrier', 'receiver'] as const

export type DemoRole = (typeof DEMO_ROLES)[number]

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
  return role ? ROLE_LABELS[role] : '未选择身份'
}

/**
 * 供菜单和路由演示权限使用；真正的操作授权仍由后端接口决定。
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

interface AuthState {
  role: DemoRole | null
  restored: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    role: null,
    restored: false,
  }),
  getters: {
    isAuthenticated: (state) => state.role !== null,
    roleLabel: (state) => roleLabel(state.role),
  },
  actions: {
    restore() {
      const storage = getSessionStorage()
      const savedRole = storage?.getItem(AUTH_SESSION_KEY)

      this.role = isDemoRole(savedRole) ? savedRole : null
      if (savedRole && !this.role) storage?.removeItem(AUTH_SESSION_KEY)
      this.restored = true
    },
    login(role: DemoRole) {
      this.role = role
      this.restored = true
      getSessionStorage()?.setItem(AUTH_SESSION_KEY, role)
    },
    logout() {
      this.role = null
      this.restored = true
      getSessionStorage()?.removeItem(AUTH_SESSION_KEY)
    },
  },
})
