import { useCallback, useEffect, useState } from 'react'
import { DetailDrawer } from './components/DetailDrawer'
import { DropZone } from './components/DropZone'
import { IngestToasts } from './components/IngestToasts'
import { Sidebar, type Page } from './components/Sidebar'
import { useIngest } from './hooks/useIngest'
import { usePythonStatus } from './hooks/usePythonStatus'
import { useSelectedItem } from './hooks/useSelectedItem'
import { GraphPage } from './pages/GraphPage'
import { LibraryPage } from './pages/LibraryPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  const [page, setPage] = useState<Page>('search')
  const pythonReady = usePythonStatus()
  const { ingestLog, ingestFiles, dataVersion } = useIngest()
  const [refreshKey, setRefreshKey] = useState(0)

  // Combine ingest-triggered refreshes with delete-triggered refreshes so
  // Library/Graph pages refetch on either event.
  useEffect(() => {
    setRefreshKey((k) => k + 1)
  }, [dataVersion])

  const bumpAfterDelete = useCallback(() => setRefreshKey((k) => k + 1), [])
  const { selectedItem, openItem, closeItem, handleDelete } = useSelectedItem(bumpAfterDelete)

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-app)' }}>
      <Sidebar current={page} onNavigate={setPage} pythonReady={pythonReady} />

      <main
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-8) var(--space-10)'
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {page === 'search' && <SearchPage onOpen={openItem} />}
          {page === 'library' && <LibraryPage onOpen={openItem} refreshKey={refreshKey} />}
          {page === 'graph' && <GraphPage refreshKey={refreshKey} />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>

      <DropZone onFilesDropped={ingestFiles} />
      <DetailDrawer item={selectedItem} onClose={closeItem} onDelete={handleDelete} />
      <IngestToasts log={ingestLog} />
    </div>
  )
}
