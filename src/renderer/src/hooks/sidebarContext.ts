import { createContext, useContext } from 'react'
import type { useSidebar } from './useSidebar'

type SidebarContextValue = ReturnType<typeof useSidebar>

export const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebarContext(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error('useSidebarContext must be used within SidebarContext.Provider')
  }
  return ctx
}
