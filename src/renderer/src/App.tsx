import { useCallback, useEffect, useState } from 'react'
import { DetailDrawer } from './components/DetailDrawer'
import { DropZone } from './components/DropZone'
import { ImageDescriptionModal } from './components/ImageDescriptionModal'
import { IngestToasts } from './components/IngestToasts'
import { SetupWizard } from './components/SetupWizard'
import { Sidebar, type Page } from './components/Sidebar'
import { UpdateBanner } from './components/UpdateBanner'
import { SidebarContext, useSidebarContext } from './hooks/sidebarContext'
import { ThemeContext } from './hooks/themeContext'
import { UpdaterContext, useUpdaterContext } from './hooks/updaterContext'
import { useClipboardPaste } from './hooks/useClipboardPaste'
import { useIngest } from './hooks/useIngest'
import { usePythonStatus } from './hooks/usePythonStatus'
import { useSelectedItem } from './hooks/useSelectedItem'
import { useSidebar } from './hooks/useSidebar'
import { useTheme } from './hooks/useTheme'
import { useUpdater } from './hooks/useUpdater'
import { GraphPage } from './pages/GraphPage'
import { LibraryPage } from './pages/LibraryPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'

type Bootstate = 'checking' | 'wizard' | 'ready'

export function App() {
  const [boot, setBoot] = useState<Bootstate>('checking')
  // Single updater subscription, shared with SettingsPage via context.
  const updater = useUpdater()
  // Single theme controller, shared with SettingsPage via context.
  const theme = useTheme()
  // Sidebar mode controller, shared with SettingsPage via context.
  const sidebar = useSidebar()

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
    return null
  }

  if (boot === 'wizard') {
    return (
      <ThemeContext.Provider value={theme}>
        <SidebarContext.Provider value={sidebar}>
          <UpdaterContext.Provider value={updater}>
            <SetupWizard onConfigured={() => setBoot('ready')} />
          </UpdaterContext.Provider>
        </SidebarContext.Provider>
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={theme}>
      <SidebarContext.Provider value={sidebar}>
        <UpdaterContext.Provider value={updater}>
          <MainShell />
        </UpdaterContext.Provider>
      </SidebarContext.Provider>
    </ThemeContext.Provider>
  )
}

function MainShell() {
  const [page, setPage] = useState<Page>('search')
  const pythonReady = usePythonStatus()
  const { ingestLog, ingestFiles, dataVersion } = useIngest()
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setRefreshKey((k) => k + 1)
  }, [dataVersion])

  const bumpAfterDelete = useCallback(() => setRefreshKey((k) => k + 1), [])
  const { selectedItem, openItem, closeItem, handleDelete } = useSelectedItem(bumpAfterDelete)
  const { mode: sidebarMode, setMode: setSidebarMode } = useSidebarContext()
  const [pendingImage, setPendingImage] = useState<File | null>(null)

  // Single-image ingest goes through a description-prompt gate so the user
  // can attach a caption that becomes searchable text. Multi-file batches
  // and non-image single drops bypass the prompt.
  const gatedIngest = useCallback(
    (files: File[]) => {
      if (files.length === 1 && files[0].type.startsWith('image/')) {
        setPendingImage(files[0])
        return
      }
      void ingestFiles(files)
    },
    [ingestFiles]
  )

  const resolveImage = useCallback(
    (description: string | null) => {
      const file = pendingImage
      setPendingImage(null)
      if (file) void ingestFiles([file], { description })
    },
    [pendingImage, ingestFiles]
  )

  const onClipboardImage = useCallback((file: File) => gatedIngest([file]), [gatedIngest])
  useClipboardPaste(onClipboardImage)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-app)'
      }}
    >
      <UpdateBannerSlot />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          current={page}
          onNavigate={setPage}
          pythonReady={pythonReady}
          mode={sidebarMode}
          onToggle={() => setSidebarMode(sidebarMode === 'expanded' ? 'collapsed' : 'expanded')}
        />

        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--space-8) var(--space-10)'
          }}
        >
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {page === 'search' && <SearchPage onOpen={openItem} onIngest={gatedIngest} />}
            {page === 'library' && (
              <LibraryPage
                onOpen={openItem}
                onIngest={gatedIngest}
                onDelete={handleDelete}
                refreshKey={refreshKey}
              />
            )}
            {page === 'graph' && <GraphPage refreshKey={refreshKey} onOpen={openItem} />}
            {page === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      <DropZone onFilesDropped={gatedIngest} />
      <ImageDescriptionModal file={pendingImage} onResolve={resolveImage} />
      <DetailDrawer item={selectedItem} onClose={closeItem} onDelete={handleDelete} />
      <IngestToasts log={ingestLog} />
    </div>
  )
}

/** Reads the shared updater state and renders the banner. Pulled into a
 * tiny child so MainShell's hooks don't all re-run on update events. */
function UpdateBannerSlot() {
  const { status, download, install, dismiss } = useUpdaterContext()
  return (
    <UpdateBanner
      status={status}
      onDownload={download}
      onInstall={install}
      onDismiss={dismiss}
    />
  )
}
