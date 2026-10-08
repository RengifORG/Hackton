import openapi from '../../../../../docs/openapi.yaml?raw'
import { LeadCreateSchema, PHONE_EC_PATTERN } from './schemas'

const validLead = {
  name: 'Ana Pérez',
  phone: '0991234567',
  source: 'web',
  consent: true,
}

describe('LeadCreateSchema (H1)', () => {
  it.each(['0991234567', '+593991234567'])('acepta el teléfono %s', (phone) => {
    expect(LeadCreateSchema.safeParse({ ...validLead, phone }).success).toBe(
      true,
    )
  })

  it('rechaza un teléfono que no es celular EC', () => {
    expect(
      LeadCreateSchema.safeParse({ ...validLead, phone: '123' }).success,
    ).toBe(false)
  })

  it('rechaza consent false', () => {
    expect(
      LeadCreateSchema.safeParse({ ...validLead, consent: false }).success,
    ).toBe(false)
  })

  it('el patrón del teléfono es exactamente el de docs/openapi.yaml', () => {
    const match =
      /LeadCreate:[\s\S]*?phone: \{ type: string, pattern: "([^"]+)" \}/.exec(
        openapi,
      )
    // En YAML con comillas dobles "\\" es una sola barra invertida.
    const yamlPattern = match?.[1]?.replaceAll('\\\\', '\\')

    expect(yamlPattern).toBe(PHONE_EC_PATTERN.source)
  })
})
