import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

import {
  applyThemeSettings,
  loadThemeSettings,
  saveThemeSettings,
  type ThemeColorKey,
  type ThemeMode,
  type ThemeSettings
} from '../lib/theme-settings'

type ThemeSettingsContextValue = {
  settings: ThemeSettings
  effectiveTheme: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  setCustomColor: (key: ThemeColorKey, value: string) => void
  clearCustomColor: (key: ThemeColorKey) => void
  resetCustomColors: () => void
  resetAll: () => void
}

const ThemeSettingsContext = createContext<ThemeSettingsContextValue | null>(null)

export function ThemeSettingsProvider ({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(() => loadThemeSettings())

  const effectiveTheme = useMemo(
    () => (settings.mode === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark')
      : settings.mode),
    [settings.mode]
  )

  useEffect(() => {
    applyThemeSettings(settings)
    saveThemeSettings(settings)
  }, [settings])

  useEffect(() => {
    if (settings.mode !== 'system') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyThemeSettings(settings)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings])

  const setMode = useCallback((mode: ThemeMode) => {
    setSettings((prev) => ({ ...prev, mode }))
  }, [])

  const setCustomColor = useCallback((key: ThemeColorKey, value: string) => {
    setSettings((prev) => ({
      ...prev,
      customColors: { ...prev.customColors, [key]: value }
    }))
  }, [])

  const clearCustomColor = useCallback((key: ThemeColorKey) => {
    setSettings((prev) => {
      const next = { ...prev.customColors }
      delete next[key]
      return { ...prev, customColors: next }
    })
  }, [])

  const resetCustomColors = useCallback(() => {
    setSettings((prev) => ({ ...prev, customColors: {} }))
  }, [])

  const resetAll = useCallback(() => {
    setSettings({ mode: 'dark', customColors: {} })
  }, [])

  const value = useMemo(
    () => ({
      settings,
      effectiveTheme,
      setMode,
      setCustomColor,
      clearCustomColor,
      resetCustomColors,
      resetAll
    }),
    [settings, effectiveTheme, setMode, setCustomColor, clearCustomColor, resetCustomColors, resetAll]
  )

  return (
    <ThemeSettingsContext.Provider value={value}>
      {children}
    </ThemeSettingsContext.Provider>
  )
}

export function useThemeSettings (): ThemeSettingsContextValue {
  const ctx = useContext(ThemeSettingsContext)
  if (!ctx) {
    throw new Error('useThemeSettings must be used within ThemeSettingsProvider')
  }
  return ctx
}
