import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it('muestra el asesor virtual en /', () => {
    renderAt('/')
    expect(
      screen.getByRole('heading', { name: 'Asesor virtual BYD' }),
    ).toBeInTheDocument()
  })

  it('muestra el BYD Dolphin en /modelos/dolphin', () => {
    renderAt('/modelos/dolphin')
    expect(
      screen.getByRole('heading', { name: 'BYD Dolphin' }),
    ).toBeInTheDocument()
  })
})
