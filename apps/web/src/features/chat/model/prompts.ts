import type { Hotspot, SuggestedAction } from '@/lib/api/types'

export const LOPDP_NOTICE =
  'Tus datos se tratan según la LOPDP de Ecuador solo para atender tu solicitud.'

export const CHAT_FAILED = 'No pude responder, intenta de nuevo.'
export const CHAT_RATE_LIMITED = 'Demasiadas consultas, espera un momento.'

export const HOTSPOT_QUESTIONS = {
  wheels: 'Cuéntame de las llantas',
  seats: 'Cuéntame de los asientos',
  screen: 'Cuéntame de la pantalla',
  battery: 'Cuéntame de la batería',
  trunk: 'Cuéntame del maletero',
  lights: 'Cuéntame de las luces',
} satisfies Record<Hotspot, string>

export const ACTION_LABELS = {
  recommend: 'Recomiéndame un modelo',
  leave_contact: 'Dejar mis datos',
  book_test_drive: 'Agendar prueba de manejo',
  book_service: 'Agendar taller',
  view_3d: 'Ver en 3D',
} satisfies Record<SuggestedAction, string>

// leave_contact abre el formulario y view_3d vuelve a la vista libre: no envían texto.
export type PromptAction = Exclude<SuggestedAction, 'leave_contact' | 'view_3d'>

export const ACTION_PROMPTS = {
  recommend: 'Quiero que me recomiendes un modelo',
  book_test_drive: 'Quiero agendar una prueba de manejo',
  book_service: 'Quiero agendar una cita en el taller',
} satisfies Record<PromptAction, string>
