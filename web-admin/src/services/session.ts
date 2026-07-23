import type { AuthUser } from '../types/contracts'

export const API_SESSION_STORAGE_KEY = 'coldchain.api.session.v1'
export const AUTH_SESSION_INVALIDATED_EVENT = 'coldchain:auth-session-invalidated'

export interface ApiSession {
  token: string
  user: AuthUser
}

type SessionStorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getSessionStorage(): SessionStorageAdapter | null {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<AuthUser>
  return (
    typeof user.user_id === 'number' &&
    typeof user.username === 'string' &&
    typeof user.role === 'string' &&
    typeof user.display_name === 'string'
  )
}

function isApiSession(value: unknown): value is ApiSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<ApiSession>
  return typeof session.token === 'string' && session.token.length > 0 && isAuthUser(session.user)
}

/**
 * Reads the current-tab API session. Tokens are deliberately not persisted to
 * localStorage so a browser restart requires login again.
 */
export function readApiSession(storage: SessionStorageAdapter | null = getSessionStorage()) {
  try {
    const raw = storage?.getItem(API_SESSION_STORAGE_KEY)
    if (!raw) return null
    const session: unknown = JSON.parse(raw)
    if (isApiSession(session)) return session
    storage?.removeItem(API_SESSION_STORAGE_KEY)
  } catch {
    storage?.removeItem(API_SESSION_STORAGE_KEY)
  }
  return null
}

export function saveApiSession(
  session: ApiSession,
  storage: SessionStorageAdapter | null = getSessionStorage(),
) {
  try {
    storage?.setItem(API_SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // A failed browser storage write must not expose a token or break the UI.
  }
}

export function clearApiSession(options: {
  storage?: SessionStorageAdapter | null
  notify?: boolean
} = {}) {
  try {
    ;(options.storage ?? getSessionStorage())?.removeItem(API_SESSION_STORAGE_KEY)
  } catch {
    // The token is already unusable from the application's perspective.
  }

  if (options.notify !== false && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_INVALIDATED_EVENT))
  }
}
