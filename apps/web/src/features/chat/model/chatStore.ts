import type { z } from 'zod'
import { create } from 'zustand'
import { useViewerStore } from '@/features/viewer'
import { ApiError, api } from '@/lib/api/client'
import { LeadCreateSchema } from '@/lib/api/schemas'
import type { Hotspot, SuggestedAction } from '@/lib/api/types'
import { newId } from '@/lib/id'
import {
  ACTION_PROMPTS,
  CHAT_FAILED,
  CHAT_RATE_LIMITED,
  HOTSPOT_QUESTIONS,
} from './prompts'

const MAX_MESSAGE_LENGTH = 1000
const LEAD_INTEREST = 'BYD Dolphin'

type LeadField = 'name' | 'phone' | 'consent'
export type LeadFieldErrors = Partial<Record<LeadField | 'form', string>>
export type SubmitLeadResult =
  { ok: true } | { ok: false; fieldErrors: LeadFieldErrors }

// El teléfono solo viaja en la request: nunca se guarda en el store ni se loguea.
export interface LeadInput {
  name: string
  phone: string
  consent: boolean
}

const FIELD_MESSAGES: Record<LeadField, string> = {
  name: 'Ingresa tu nombre (entre 2 y 80 caracteres).',
  phone: 'Ingresa un celular válido: 0991234567 o +593991234567.',
  consent: 'Debes aceptar el tratamiento de tus datos.',
}
const LEAD_REJECTED = 'Revisa tus datos e intenta de nuevo.'
const LEAD_FAILED = 'No pudimos enviar tus datos, intenta de nuevo.'

function isLeadField(key: unknown): key is LeadField {
  return typeof key === 'string' && key in FIELD_MESSAGES
}

function toFieldErrors(error: z.ZodError): LeadFieldErrors {
  const errors: LeadFieldErrors = {}
  for (const { path } of error.issues) {
    const [field] = path
    if (isLeadField(field)) errors[field] = FIELD_MESSAGES[field]
    else errors.form = LEAD_REJECTED
  }
  return errors
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  actions?: SuggestedAction[]
}

interface ChatData {
  sessionId: string
  modelId: string | null
  isOpen: boolean
  messages: ChatMessage[]
  status: 'idle' | 'sending' | 'error'
  leadFormOpen: boolean
  leadId?: string
  leadName?: string
}

interface ChatActions {
  setModel: (modelId: string) => void
  open: () => void
  close: () => void
  ask: (text: string) => Promise<void>
  askAboutHotspot: (hotspot: Hotspot) => Promise<void>
  runAction: (action: SuggestedAction) => Promise<void>
  submitLead: (input: LeadInput) => Promise<SubmitLeadResult>
}

export type ChatState = ChatData & ChatActions

function initialData(): ChatData {
  return {
    sessionId: newId(),
    modelId: null,
    isOpen: false,
    messages: [],
    status: 'idle',
    leadFormOpen: false,
  }
}

function message(
  role: ChatMessage['role'],
  text: string,
  actions?: SuggestedAction[],
): ChatMessage {
  return { id: newId(), role, text, actions }
}

export const useChatStore = create<ChatState>()((set, get) => ({
  ...initialData(),

  setModel: (modelId) => set({ modelId }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  ask: async (text) => {
    const content = text.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!content || get().status === 'sending') return

    set((state) => ({
      messages: [...state.messages, message('user', content)],
      status: 'sending',
    }))
    try {
      const { sessionId, modelId } = get()
      const response = await api.chat({
        sessionId,
        message: content,
        modelId: modelId ?? undefined,
      })
      set((state) => ({
        messages: [
          ...state.messages,
          message('assistant', response.reply, response.suggestedActions),
        ],
        status: 'idle',
      }))
      if (response.hotspot) {
        useViewerStore.getState().focusHotspot(response.hotspot)
      }
    } catch (error) {
      const rateLimited = error instanceof ApiError && error.status === 429
      set((state) => ({
        messages: [
          ...state.messages,
          message('assistant', rateLimited ? CHAT_RATE_LIMITED : CHAT_FAILED),
        ],
        status: 'error',
      }))
    }
  },

  askAboutHotspot: (hotspot) => {
    get().open()
    return get().ask(HOTSPOT_QUESTIONS[hotspot])
  },

  runAction: async (action) => {
    switch (action) {
      case 'leave_contact':
        set({ leadFormOpen: true })
        return
      case 'view_3d':
        useViewerStore.getState().clearFocus()
        return
      default:
        return get().ask(ACTION_PROMPTS[action])
    }
  },

  submitLead: async ({ name, phone, consent }) => {
    const parsed = LeadCreateSchema.safeParse({
      name: name.trim(),
      phone: phone.trim(),
      consent,
      source: 'web',
      interest: LEAD_INTEREST,
      sessionId: get().sessionId,
    })
    if (!parsed.success) {
      return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    }

    try {
      const lead = await api.createLead(parsed.data)
      // De la respuesta solo se guardan id y nombre (nunca el teléfono).
      set((state) => ({
        leadId: lead.id,
        leadName: lead.name,
        leadFormOpen: false,
        messages: [
          ...state.messages,
          message(
            'assistant',
            `¡Listo, ${lead.name}! Un asesor de BYD te contactará pronto.`,
          ),
        ],
      }))
      return { ok: true }
    } catch (error) {
      const rejected = error instanceof ApiError && error.status === 422
      return {
        ok: false,
        fieldErrors: { form: rejected ? LEAD_REJECTED : LEAD_FAILED },
      }
    }
  },
}))

/** Solo para tests: estado inicial con un sessionId nuevo. */
export function resetChatStore(): void {
  useChatStore.setState({
    ...initialData(),
    leadId: undefined,
    leadName: undefined,
  })
}

const NO_ACTIONS: SuggestedAction[] = []

// Chips: acciones de la última respuesta del asistente (referencia estable).
export function selectSuggestedActions(state: ChatState): SuggestedAction[] {
  const last = state.messages.at(-1)
  return last?.role === 'assistant' ? (last.actions ?? NO_ACTIONS) : NO_ACTIONS
}
