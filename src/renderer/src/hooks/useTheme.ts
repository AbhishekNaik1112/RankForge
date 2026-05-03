import { useEffect, useState } from 'react'

export type ThemePreference =
  | 'system'
  | 'light'
  | 'dark'
  | 'monokai'
  | 'dracula'
  | 'nord'
  | 'tokyo-night'

type ResolvedTheme = Exclude<ThemePreference, 'system'>

const STORAGE_KEY = 'rf:theme'

export const THEME_OPTIONS: { id: ThemePreference; label: string; hint?: string }[] = [
  { id: 'system', label: 'System', hint: 'Follows OS appearance' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord', label: 'Nord' },
  { id: 'tokyo-night', label: 'Tokyo Night' }
]

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'system') return pref
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved
}

function readStoredPref(): ThemePreference {
  const v = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
  if (
    v === 'system' ||
    v === 'light' ||
    v === 'dark' ||
    v === 'monokai' ||
    v === 'dracula' ||
    v === 'nord' ||
    v === 'tokyo-night'
  ) {
    return v
  }
  return 'system'
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPref)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference)
    applyTheme(resolveTheme(preference))

    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => applyTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preference])

  return { preference, setPreference }
}
