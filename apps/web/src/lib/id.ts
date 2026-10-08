// crypto.randomUUID solo existe en contextos seguros (https o localhost); en la
// demo servida por IP (http://192.168…) no está, pero getRandomValues sí.
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}
