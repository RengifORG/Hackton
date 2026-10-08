import { isAfterHours } from './afterHours'

// Ecuador (America/Guayaquil) es UTC-5 sin horario de verano.
describe('isAfterHours', () => {
  it.each([
    ['07:59', '2026-10-08T12:59:00Z', true],
    ['08:00', '2026-10-08T13:00:00Z', false],
    ['17:59', '2026-10-08T22:59:00Z', false],
    ['18:00', '2026-10-08T23:00:00Z', true],
  ])('a las %s hora de Ecuador (%s) devuelve %s', (_local, iso, expected) => {
    expect(isAfterHours(iso)).toBe(expected)
  })
})
