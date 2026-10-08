import { z } from 'zod'

const DEFAULT_API_URL = 'http://localhost:8000'

const envSchema = z.object({
  VITE_API_URL: z.url({ protocol: /^https?$/ }).default(DEFAULT_API_URL),
  VITE_USE_MOCKS: z.string().optional(),
})

export interface Env {
  apiUrl: string
  useMocks: boolean
}

export function parseEnv(raw: Readonly<Record<string, unknown>>): Env {
  const parsed = envSchema.parse(raw)
  return {
    apiUrl: parsed.VITE_API_URL,
    useMocks: parsed.VITE_USE_MOCKS === '1',
  }
}

export const env = parseEnv(import.meta.env)
