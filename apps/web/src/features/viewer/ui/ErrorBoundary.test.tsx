import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Broken(): never {
  throw new Error('WebGL context lost')
}

describe('ErrorBoundary', () => {
  it('muestra el fallback si un hijo lanza error', () => {
    // React (y jsdom) reportan el error capturado; no aporta al test.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const silence = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener('error', silence)

    render(
      <ErrorBoundary fallback={<p>Vista alternativa</p>}>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Vista alternativa')).toBeInTheDocument()
    window.removeEventListener('error', silence)
    vi.restoreAllMocks()
  })
})
