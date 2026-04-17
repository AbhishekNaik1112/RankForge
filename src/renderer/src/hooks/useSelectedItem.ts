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
      await deleteContent(id)
      setSelectedItem(null)
      onDeleted()
    },
    [onDeleted]
  )

  return { selectedItem, openItem, closeItem, handleDelete }
}
