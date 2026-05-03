/**
 * Context that exposes a single shared useUpdater() instance to anything
 * down the tree. The banner (in App.tsx) and the Settings page both want
 * to read update status; we don't want two subscriptions to the same IPC
 * event stream.
 */
import { createContext, useContext } from 'react'
import type { useUpdater } from './useUpdater'

type UpdaterValue = ReturnType<typeof useUpdater> | null

export const UpdaterContext = createContext<UpdaterValue>(null)

export function useUpdaterContext() {
  const ctx = useContext(UpdaterContext)
  if (!ctx) {
    throw new Error('useUpdaterContext used outside of UpdaterContext.Provider')
  }
  return ctx
}
