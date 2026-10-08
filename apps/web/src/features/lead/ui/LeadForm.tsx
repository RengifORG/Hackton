import { useState, type FormEvent } from 'react'
import {
  useChatStore,
  type LeadFieldErrors,
} from '@/features/chat/model/chatStore'
import { LOPDP_NOTICE } from '@/features/chat/model/prompts'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  )
}

export function LeadForm() {
  const submitLead = useChatStore((state) => state.submitLead)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<LeadFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    const result = await submitLead({ name, phone, consent })
    setSubmitting(false)
    if (!result.ok) setErrors(result.fieldErrors)
  }

  return (
    <form
      aria-label="Dejar mis datos"
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="space-y-3 border-t border-slate-200 p-4"
    >
      <div>
        <label htmlFor="lead-name" className="block text-sm font-medium">
          Nombre
        </label>
        <input
          id="lead-name"
          autoComplete="name"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby="lead-name-error"
          onChange={(event) => setName(event.target.value)}
        />
        <FieldError id="lead-name-error" message={errors.name} />
      </div>
      <div>
        <label htmlFor="lead-phone" className="block text-sm font-medium">
          Teléfono
        </label>
        <input
          id="lead-phone"
          type="tel"
          autoComplete="tel"
          placeholder="0991234567"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={phone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby="lead-phone-error"
          onChange={(event) => setPhone(event.target.value)}
        />
        <FieldError id="lead-phone-error" message={errors.phone} />
      </div>
      <div>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>Acepto el tratamiento de mis datos. {LOPDP_NOTICE}</span>
        </label>
        <FieldError id="lead-consent-error" message={errors.consent} />
      </div>
      <FieldError id="lead-form-error" message={errors.form} />
      <button
        type="submit"
        disabled={!consent || submitting}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Enviar mis datos
      </button>
    </form>
  )
}
