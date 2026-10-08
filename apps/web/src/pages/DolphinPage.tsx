import { useModel } from '@/features/catalog'
import { CarViewer } from '@/features/viewer'

// El header mide h-14 (3.5rem): el visor ocupa el resto del alto visible.
export function DolphinPage() {
  const result = useModel('dolphin')

  return (
    <div className="min-h-dvh bg-white">
      <header className="flex h-14 items-center border-b border-slate-200 px-4">
        <h1 className="text-lg font-bold">BYD Dolphin</h1>
      </header>
      <main className="flex flex-col md:flex-row">
        <section
          aria-label="Visor 3D"
          className="h-[calc(100dvh-3.5rem)] w-full md:flex-1"
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
            <CarViewer model={result.model} onHotspotSelect={() => {}} />
          )}
        </section>
        {/* El chat del asesor (paso 4) ocupa este panel: debajo en móvil, al lado desde md. */}
        <aside
          aria-label="Asesor virtual"
          className="w-full border-t border-slate-200 p-4 md:h-[calc(100dvh-3.5rem)] md:w-96 md:border-t-0 md:border-l"
        >
          <h2 className="font-semibold">Asesor virtual</h2>
          <p className="mt-1 text-sm text-slate-600">
            Toca un punto del auto para conocer sus detalles.
          </p>
        </aside>
      </main>
    </div>
  )
}
