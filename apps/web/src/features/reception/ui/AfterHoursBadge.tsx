import { Badge } from '@/components/ui'

interface AfterHoursBadgeProps {
  afterHours: boolean
}

export function AfterHoursBadge({ afterHours }: AfterHoursBadgeProps) {
  if (afterHours !== true) return null
  return <Badge variant="warning">Capturado fuera de horario</Badge>
}
