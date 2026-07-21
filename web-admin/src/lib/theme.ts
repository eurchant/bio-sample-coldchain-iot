export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'
export const THEME_PREFERENCE_STORAGE_KEY = 'coldchain.theme-preference'
export const SYSTEM_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

export function getSystemPrefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(SYSTEM_THEME_MEDIA_QUERY).matches
}

export function readThemePreference(storage: ThemeStorage | null = getThemeStorage()) {
  try {
    const storedPreference = storage?.getItem(THEME_PREFERENCE_STORAGE_KEY)
    return isThemePreference(storedPreference) ? storedPreference : DEFAULT_THEME_PREFERENCE
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

export function saveThemePreference(
  preference: ThemePreference,
  storage: ThemeStorage | null = getThemeStorage(),
) {
  try {
    storage?.setItem(THEME_PREFERENCE_STORAGE_KEY, preference)
  } catch {
    // Theme selection is cosmetic; storage unavailability must not affect the app.
  }
}

export function applyThemePreference(
  preference: ThemePreference,
  options: {
    root?: HTMLElement | null
    systemPrefersDark?: boolean
  } = {},
) {
  const resolvedTheme = resolveTheme(
    preference,
    options.systemPrefersDark ?? getSystemPrefersDark(),
  )
  const root = options.root ?? getThemeRoot()
  if (root) root.dataset.theme = resolvedTheme
  return resolvedTheme
}

function getThemeStorage(): ThemeStorage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getThemeRoot() {
  return typeof document === 'undefined' ? null : document.documentElement
}
