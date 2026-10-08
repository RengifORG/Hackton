import { render, screen } from '@testing-library/react'
import { AfterHoursBadge } from './AfterHoursBadge'

describe('AfterHoursBadge', () => {
  it('muestra "Capturado fuera de horario" cuando afterHours es true', () => {
    render(<AfterHoursBadge afterHours />)
    expect(screen.getByText('Capturado fuera de horario')).toBeInTheDocument()
  })

  it('no renderiza nada cuando afterHours es false', () => {
    const { container } = render(<AfterHoursBadge afterHours={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
