const OPENING_HOUR = 8
const CLOSING_HOUR = 18

const ecuadorHour = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Guayaquil',
  hour: 'numeric',
  hourCycle: 'h23',
})

/** true si la hora en Ecuador (America/Guayaquil) cae fuera de [08:00, 18:00). */
export function isAfterHours(iso: string): boolean {
  const hour = Number(ecuadorHour.format(new Date(iso)))
  return hour < OPENING_HOUR || hour >= CLOSING_HOUR
}
