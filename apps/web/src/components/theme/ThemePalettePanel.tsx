import { useEffect, useRef } from 'react'

import { useThemeSettings } from '../../hooks/useThemeSettings'
import { FONT_SCALE_OPTIONS, THEME_COLOR_OPTIONS, type ThemeMode } from '../../lib/theme-settings'

const MODE_OPTIONS: Array<{ id: ThemeMode; label: string }> = [
  { id: 'light', label: 'ライト' },
  { id: 'dark', label: 'ダーク' },
  { id: 'system', label: 'システム' }
]

export function ThemePalettePanel () {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const {
    settings,
    effectiveTheme,
    setMode,
    setFontScale,
    setCustomColor,
    clearCustomColor,
    resetCustomColors,
    resetAll
  } = useThemeSettings()

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = detailsRef.current
      if (!el?.open) return
      if (!el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <details ref={detailsRef} className="theme-palette-menu">
      <summary className="theme-palette-trigger" title="表示テーマ・カラー">
        <span className="theme-palette-icon" aria-hidden="true">🎨</span>
        <span className="theme-palette-label">テーマ</span>
      </summary>
      <div className="theme-palette-dropdown" role="dialog" aria-label="テーマとカラー">
        <p className="theme-palette-heading">表示モード</p>
        <div className="theme-mode-row" role="group" aria-label="ライト・ダーク">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`theme-mode-btn${settings.mode === opt.id ? ' active' : ''}`}
              aria-pressed={settings.mode === opt.id}
              onClick={() => setMode(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="theme-palette-meta">
          適用中: <strong>{effectiveTheme === 'light' ? 'ライト' : 'ダーク'}</strong>
          {settings.mode === 'system' ? '（OS 設定）' : ''}
        </p>

        <p className="theme-palette-heading">文字サイズ</p>
        <div className="theme-font-scale-row">
          <input
            id="theme-font-scale"
            type="range"
            className="theme-font-scale-slider"
            min={0}
            max={FONT_SCALE_OPTIONS.length - 1}
            step={1}
            value={Math.max(0, FONT_SCALE_OPTIONS.indexOf(settings.fontScale))}
            onChange={(e) => {
              const scale = FONT_SCALE_OPTIONS[Number(e.target.value)]
              if (scale) setFontScale(scale)
            }}
            aria-valuemin={100}
            aria-valuemax={200}
            aria-valuenow={settings.fontScale}
            aria-valuetext={`${settings.fontScale}%`}
          />
          <output className="theme-font-scale-value" htmlFor="theme-font-scale">
            {settings.fontScale}%
          </output>
        </div>
        <p className="theme-palette-hint theme-font-scale-hint">
          100% · 125% · 150% · 175% · 200%
        </p>

        <p className="theme-palette-heading">カラーパレット</p>
        <p className="theme-palette-hint">
          モード切替で文字色・背景は自動調整されます。必要なら個別に上書きできます。
        </p>
        <ul className="theme-color-list">
          {THEME_COLOR_OPTIONS.map(({ key, label }) => (
            <li key={key} className="theme-color-row">
              <label htmlFor={`theme-color-${key}`}>{label}</label>
              <input
                id={`theme-color-${key}`}
                type="color"
                value={settings.customColors[key] ?? getComputedCssVar(key)}
                onChange={(e) => setCustomColor(key, e.target.value)}
              />
              <button
                type="button"
                className="theme-color-reset"
                title={`${label}をモード既定に戻す`}
                disabled={!settings.customColors[key]}
                onClick={() => clearCustomColor(key)}
              >
                ↺
              </button>
            </li>
          ))}
        </ul>

        <div className="theme-palette-actions">
          <button type="button" className="btn btn-sm" onClick={resetCustomColors}>
            色を既定に戻す
          </button>
          <button type="button" className="btn btn-sm" onClick={resetAll}>
            すべてリセット
          </button>
        </div>
      </div>
    </details>
  )
}

function getComputedCssVar (key: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const h = raw.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
  }
  return '#808080'
}
