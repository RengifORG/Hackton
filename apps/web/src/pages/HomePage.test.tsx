import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from './HomePage'

describe('HomePage (landing)', () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
  })

  it('muestra el hero con el problema y el CTA al asesor virtual', () => {
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Tu BYD, a cualquier hora',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/18:00/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Hablar con el asesor virtual' }),
    ).toHaveAttribute('href', '/modelos/dolphin')
  })

  it.each([
    ['Ver el Dolphin en 3D', '/modelos/dolphin'],
    ['Bandeja del asesor', '/asesor'],
    ['Agenda del taller', '/taller'],
  ])('la tarjeta "%s" lleva a %s', (name, href) => {
    expect(
      screen.getByRole('link', { name: new RegExp(name) }),
    ).toHaveAttribute('href', href)
  })
})
