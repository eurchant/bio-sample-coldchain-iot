import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_PREFERENCE_STORAGE_KEY,
  applyThemePreference,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
} from './theme'

function createMemoryStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('theme preference helpers', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('resolves explicit and system preferences without touching the DOM', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('uses system as the fallback and persists only a valid display preference', () => {
    const storage = createMemoryStorage({ [THEME_PREFERENCE_STORAGE_KEY]: 'unexpected' })

    expect(readThemePreference(storage)).toBe(DEFAULT_THEME_PREFERENCE)

    saveThemePreference('dark', storage)

    expect(storage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark')
    expect(readThemePreference(storage)).toBe('dark')
  })

  it('writes the resolved theme to the document root by default', () => {
    expect(applyThemePreference('system', { systemPrefersDark: true })).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('supports an explicit root for DOM adapters outside the main document', () => {
    const root = document.createElement('html')

    expect(applyThemePreference('system', { root, systemPrefersDark: true })).toBe('dark')
    expect(root.dataset.theme).toBe('dark')

    expect(applyThemePreference('light', { root, systemPrefersDark: true })).toBe('light')
    expect(root.dataset.theme).toBe('light')
  })
})
