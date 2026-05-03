import { useEffect, useState } from 'react'

export type SidebarMode = 'expanded' | 'collapsed' | 'hover'

const STORAGE_KEY = 'rf:sidebar'

export const SIDEBAR_MODE_OPTIONS: { id: SidebarMode; label: string; hint: string }[] = [
  { id: 'expanded', label: 'Always expanded', hint: 'Full sidebar with labels' },
  { id: 'collapsed', label: 'Always collapsed', hint: 'Icons only — hover for tooltip' },
  { id: 'hover', label: 'Expand on hover', hint: 'Collapsed by default, expands when hovered' }
]

function readStored(): SidebarMode {
  const v = localStorage.getItem(STORAGE_KEY) as SidebarMode | null
  return v === 'collapsed' || v === 'hover' || v === 'expanded' ? v : 'expanded'
}

export function useSidebar() {
  const [mode, setMode] = useState<SidebarMode>(readStored)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  return { mode, setMode }
}
