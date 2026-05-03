import { useCallback, useState } from 'react'
import { deleteContent, getContent, type ContentItem } from '../lib/api'

interface UseSelectedItem {
  selectedItem: ContentItem | null
  openItem: (id: string) => Promise<void>
  closeItem: () => void
  handleDelete: (id: string) => Promise<void>
}

/** Owns the detail-drawer target: fetching a single item by id, clearing it,
 * and deleting the currently-open item. Notifies the parent via onDeleted so
 * lists can refresh. */
export function useSelectedItem(onDeleted: () => void): UseSelectedItem {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)

  const openItem = useCallback(async (id: string) => {
    try {
      const item = await getContent(id)
      setSelectedItem(item)
    } catch (err) {
      console.error('Failed to load item:', err)
    }
  }, [])

  const closeItem = useCallback(() => setSelectedItem(null), [])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteContent(id)
        setSelectedItem(null)
        onDeleted()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed'
        // Surface to the user — the previous behavior swallowed silently,
        // leaving a phantom "deleted" UI state while the row remained.
        window.alert(`Could not delete: ${message}`)
        throw err
      }
    },
    [onDeleted]
  )

  return { selectedItem, openItem, closeItem, handleDelete }
}
