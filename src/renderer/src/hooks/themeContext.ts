import { createContext, useContext } from 'react'
import type { useTheme } from './useTheme'

type ThemeContextValue = ReturnType<typeof useTheme>

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemeContext must be used within ThemeContext.Provider')
  }
  return ctx
}
