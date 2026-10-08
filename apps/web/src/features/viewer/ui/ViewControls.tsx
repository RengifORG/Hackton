import type { CameraView } from '../model/views'
import { useViewerStore } from '../model/viewerStore'

const QUICK_VIEWS: { view: CameraView; label: string }[] = [
  { view: 'front', label: 'Frente' },
  { view: 'side', label: 'Lateral' },
  { view: 'back', label: 'Atrás' },
  { view: 'interior', label: 'Interior' },
]

const buttonClass =
  'rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-800 shadow backdrop-blur hover:bg-white'

export function ViewControls() {
  const activeView = useViewerStore((state) => state.activeView)
  const focusView = useViewerStore((state) => state.focusView)
  const inside = activeView === 'interior'

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-end px-3">
        <button
          type="button"
          className={`pointer-events-auto ${buttonClass}`}
          onClick={() => focusView(inside ? 'front' : 'interior')}
        >
          {inside ? 'Ver exterior' : 'Ver interior'}
        </button>
      </div>
      <nav
        aria-label="Vistas rápidas"
        className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3"
      >
        <ul className="pointer-events-auto flex flex-wrap justify-center gap-2">
          {QUICK_VIEWS.map(({ view, label }) => (
            <li key={view}>
              <button
                type="button"
                aria-pressed={activeView === view}
                className={`${buttonClass} aria-pressed:bg-slate-900 aria-pressed:text-white`}
                onClick={() => focusView(view)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
