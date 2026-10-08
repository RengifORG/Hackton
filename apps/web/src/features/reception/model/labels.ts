import type { AppointmentType, LeadRead } from './schemas'

type CrmStatus = NonNullable<LeadRead['crmStatus']>

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  test_drive: 'Test drive',
  service: 'Taller',
}

export const SOURCE_LABELS: Record<LeadRead['source'], string> = {
  web: 'Web',
  whatsapp: 'WhatsApp',
}

export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  pending: 'Pendiente de envío',
  pushed: 'Enviado a HubSpot',
  failed: 'Error al enviar',
}

export function crmStatusLabel(status: LeadRead['crmStatus']): string {
  return status ? CRM_STATUS_LABELS[status] : CRM_STATUS_LABELS.pending
}
