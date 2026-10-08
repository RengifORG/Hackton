import { useState, type FormEvent } from 'react'
import { LeadForm } from '@/features/lead'
import { selectSuggestedActions, useChatStore } from '../model/chatStore'
import { ACTION_LABELS, LOPDP_NOTICE } from '../model/prompts'

export function ChatPanel() {
  const messages = useChatStore((state) => state.messages)
  const status = useChatStore((state) => state.status)
  const actions = useChatStore(selectSuggestedActions)
  const ask = useChatStore((state) => state.ask)
  const runAction = useChatStore((state) => state.runAction)
  const leadFormOpen = useChatStore((state) => state.leadFormOpen)
  const [draft, setDraft] = useState('')
  const sending = status === 'sending'

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void ask(draft)
    setDraft('')
  }

  return (
    <aside
      aria-label="Asesor virtual BYD"
      className="flex min-h-[28rem] flex-col border-t border-slate-200 bg-white md:h-full md:border-t-0 md:border-l"
    >
      <header className="border-b border-slate-200 p-4">
        <h2 className="font-semibold">Asesor virtual BYD</h2>
        <p className="mt-1 text-xs text-slate-500">{LOPDP_NOTICE}</p>
      </header>

      <ol aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map(({ id, role, text }) => (
          <li
            key={id}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
              role === 'user'
                ? 'ml-auto bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            {text}
          </li>
        ))}
        {sending && (
          <li className="text-xs text-slate-500 italic">escribiendo…</li>
        )}
      </ol>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
              onClick={() => void runAction(action)}
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      )}

      {leadFormOpen && <LeadForm />}

      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-slate-200 p-3"
      >
        <input
          aria-label="Escribe tu pregunta"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Pregunta por llantas, batería, asientos…"
          maxLength={1000}
          value={draft}
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </aside>
  )
}
