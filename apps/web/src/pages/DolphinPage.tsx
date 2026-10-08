import { useEffect } from 'react'
import { useModel } from '@/features/catalog'
import { ChatPanel, useChatStore } from '@/features/chat'
import { CarViewer } from '@/features/viewer'

const MODEL_ID = 'dolphin'

// El header mide h-14 (3.5rem): visor y chat ocupan el resto del alto visible.
export function DolphinPage() {
  const result = useModel(MODEL_ID)
  const setModel = useChatStore((state) => state.setModel)
  const askAboutHotspot = useChatStore((state) => state.askAboutHotspot)

  useEffect(() => {
    setModel(MODEL_ID)
  }, [setModel])

  // Móvil: chat debajo del visor. Desktop: visor | chat (380px).
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex h-14 items-center border-b border-slate-200 px-4">
        <h1 className="text-lg font-bold">BYD Dolphin</h1>
      </header>
      <main className="grid grid-cols-1 md:grid-cols-[1fr_380px]">
        <section
          aria-label="Visor 3D"
          className="h-[calc(100dvh-3.5rem)] w-full"
        >
          {result.status === 'loading' && (
            <p className="p-4 text-sm text-slate-500">Cargando modelo…</p>
          )}
          {result.status === 'error' && (
            <p className="p-4 text-sm text-red-600">
              No pudimos cargar el modelo. Intenta de nuevo más tarde.
            </p>
          )}
          {result.status === 'ready' && (
            <CarViewer
              model={result.model}
              onHotspotSelect={(hotspot) => void askAboutHotspot(hotspot)}
            />
          )}
        </section>
        <div className="md:h-[calc(100dvh-3.5rem)]">
          <ChatPanel />
        </div>
      </main>
    </div>
  )
}
