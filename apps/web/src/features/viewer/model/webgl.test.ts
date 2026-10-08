import { isWebGLAvailable } from './webgl'

describe('isWebGLAvailable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('devuelve false si getContext no entrega contexto', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    expect(isWebGLAvailable()).toBe(false)
  })
})
