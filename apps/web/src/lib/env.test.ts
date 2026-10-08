import { parseEnv } from './env'

describe('parseEnv', () => {
  it('usa http://localhost:8000 cuando falta VITE_API_URL', () => {
    expect(parseEnv({}).apiUrl).toBe('http://localhost:8000')
  })

  it('respeta VITE_API_URL cuando es una URL válida', () => {
    expect(parseEnv({ VITE_API_URL: 'https://api.example.com' }).apiUrl).toBe(
      'https://api.example.com',
    )
  })

  it("activa los mocks solo con VITE_USE_MOCKS='1'", () => {
    expect(parseEnv({ VITE_USE_MOCKS: '1' }).useMocks).toBe(true)
  })

  it.each([undefined, '0', 'true'])(
    'no activa los mocks con VITE_USE_MOCKS=%s',
    (value) => {
      expect(parseEnv({ VITE_USE_MOCKS: value }).useMocks).toBe(false)
    },
  )

  it('lanza error si VITE_API_URL no es una URL', () => {
    expect(() => parseEnv({ VITE_API_URL: 'no-es-una-url' })).toThrow()
  })
})
