import { useCallback, useEffect, useState } from 'react'
import { DetailDrawer } from './components/DetailDrawer'
import { DropZone } from './components/DropZone'
import { IngestToasts } from './components/IngestToasts'
import { SetupWizard } from './components/SetupWizard'
import { Sidebar, type Page } from './components/Sidebar'
import { useIngest } from './hooks/useIngest'
import { usePythonStatus } from './hooks/usePythonStatus'
import { useSelectedItem } from './hooks/useSelectedItem'
import { GraphPage } from './pages/GraphPage'
import { LibraryPage } from './pages/LibraryPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'

type Bootstate = 'checking' | 'wizard' | 'ready'

export function App() {
  const [boot, setBoot] = useState<Bootstate>('checking')

  // Check on mount whether the backend is configured. If not, show the
  // first-run wizard. If yes, the main process has already spawned Python
  // by now (see src/main/index.ts), so we can render the main UI.
  useEffect(() => {
    let cancelled = false
    window.api
      .isConfigured()
      .then((s) => {
        if (cancelled) return
        setBoot(s.configured ? 'ready' : 'wizard')
      })
      .catch(() => {
        if (!cancelled) setBoot('wizard')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (boot === 'checking') {
    // Brief flash; main process has the splash window via show:false +
    // ready-to-show, so the user typically doesn't see this.
    return null
  }

  if (boot === 'wizard') {
    return <SetupWizard onConfigured={() => setBoot('ready')} />
  }

  return <MainShell />
}

function MainShell() {
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
