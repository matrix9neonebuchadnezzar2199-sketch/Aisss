/** CSS custom properties users may override from the palette panel */
export type ThemeColorKey =
  | 'fg-default'
  | 'fg-muted'
  | 'canvas-subtle'
  | 'canvas-default'
  | 'accent-fg'
  | 'header-bg'
  | 'header-fg'
  | 'input-bg'
  | 'input-fg'

export type ThemeMode = 'light' | 'dark' | 'system'

export type FontScale = 100 | 125 | 150 | 175 | 200

export const FONT_SCALE_OPTIONS: FontScale[] = [100, 125, 150, 175, 200]

export type ThemeSettings = {
  mode: ThemeMode
  fontScale: FontScale
  customColors: Partial<Record<ThemeColorKey, string>>
}

export const THEME_STORAGE_KEY = 'aisss-theme-settings'

export const THEME_COLOR_OPTIONS: Array<{ key: ThemeColorKey; label: string }> = [
  { key: 'fg-default', label: '本文文字' },
  { key: 'fg-muted', label: '補助文字' },
  { key: 'canvas-subtle', label: 'ページ背景' },
  { key: 'canvas-default', label: 'パネル背景' },
  { key: 'accent-fg', label: 'アクセント' },
  { key: 'header-bg', label: 'ヘッダー背景' },
  { key: 'header-fg', label: 'ヘッダー文字' },
  { key: 'input-bg', label: '入力背景' },
  { key: 'input-fg', label: '入力文字' }
]

const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'dark',
  fontScale: 100,
  customColors: {}
}

export function loadThemeSettings (): ThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>
    return {
      mode: parsed.mode ?? DEFAULT_SETTINGS.mode,
      fontScale: normalizeFontScale(parsed.fontScale),
      customColors: parsed.customColors ?? {}
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveThemeSettings (settings: ThemeSettings): void {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings))
}

export function resolveEffectiveTheme (mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode
}

export function applyThemeSettings (settings: ThemeSettings): void {
  const root = document.documentElement
  const effective = resolveEffectiveTheme(settings.mode)
  root.setAttribute('data-theme', effective)
  root.style.setProperty('--font-scale', String(settings.fontScale / 100))

  for (const { key } of THEME_COLOR_OPTIONS) {
    root.style.removeProperty(`--${key}`)
  }
  for (const [key, value] of Object.entries(settings.customColors)) {
    if (value?.trim()) {
      root.style.setProperty(`--${key}`, value.trim())
    }
  }
}

/** Inline boot script (index.html) — keep in sync with applyThemeSettings */
export const THEME_BOOT_SCRIPT = `(function(){try{var k='aisss-theme-settings';var raw=localStorage.getItem(k);var s=raw?JSON.parse(raw):{mode:'dark',fontScale:100,customColors:{}};var m=s.mode||'dark';var eff=m==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):m;document.documentElement.setAttribute('data-theme',eff);var fs=s.fontScale||100;document.documentElement.style.setProperty('--font-scale',String(fs/100));var cc=s.customColors||{};Object.keys(cc).forEach(function(key){if(cc[key])document.documentElement.style.setProperty('--'+key,cc[key]);});}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.setProperty('--font-scale','1');}})();`

function normalizeFontScale (value: unknown): FontScale {
  const n = Number(value)
  if (FONT_SCALE_OPTIONS.includes(n as FontScale)) return n as FontScale
  return DEFAULT_SETTINGS.fontScale
}
