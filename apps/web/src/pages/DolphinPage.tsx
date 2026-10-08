import { useModel } from '@/features/catalog'
import { CarViewer } from '@/features/viewer'

export function DolphinPage() {
  const result = useModel('dolphin')

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">BYD Dolphin</h1>
      <div className="h-[60vh] w-full">
        {result.status === 'loading' && (
          <p className="text-sm text-slate-500">Cargando modelo…</p>
        )}
        {result.status === 'error' && (
          <p className="text-sm text-red-600">
            No pudimos cargar el modelo. Intenta de nuevo más tarde.
          </p>
        )}
        {result.status === 'ready' && (
          <CarViewer model={result.model} onHotspotSelect={() => {}} />
        )}
      </div>
    </main>
  )
}
