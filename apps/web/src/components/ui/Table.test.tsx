import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table, type Column } from './Table'

interface Row {
  id: string
  name: string
}

const rows: Row[] = [
  { id: 'a', name: 'Fila A' },
  { id: 'b', name: 'Fila B' },
]
const columns: Column<Row>[] = [
  { key: 'name', header: 'Nombre', render: (row) => row.name },
]

describe('Table', () => {
  it('renderiza encabezados y filas', () => {
    render(
      <Table
        caption="Prueba"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
      />,
    )
    expect(
      screen.getByRole('columnheader', { name: 'Nombre' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('llama a onRowClick con click y con Enter', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(
      <Table
        caption="Prueba"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    )
    await user.click(screen.getByText('Fila A'))
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0])

    const rowB = screen.getByText('Fila B').closest('tr')
    rowB?.focus()
    await user.keyboard('{Enter}')
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1])
  })

  it('las filas sin onRowClick no son enfocables', () => {
    render(
      <Table
        caption="Prueba"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
      />,
    )
    expect(screen.getByText('Fila A').closest('tr')).not.toHaveAttribute(
      'tabindex',
    )
  })
})
