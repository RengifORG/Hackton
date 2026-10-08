import { create } from 'zustand'
import { useViewerStore } from '@/features/viewer'
import { ApiError, api } from '@/lib/api/client'
import type { Hotspot, SuggestedAction } from '@/lib/api/types'
import {
  ACTION_PROMPTS,
  CHAT_FAILED,
  CHAT_RATE_LIMITED,
  HOTSPOT_QUESTIONS,
} from './prompts'

const MAX_MESSAGE_LENGTH = 1000

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
}

export type ChatState = ChatData & ChatActions

function initialData(): ChatData {
  return {
    sessionId: crypto.randomUUID(),
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
  return { id: crypto.randomUUID(), role, text, actions }
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
