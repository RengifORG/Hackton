import createClient from 'openapi-fetch'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { paths } from './schema'
import {
  ChatResponseSchema,
  ModelSchema,
  ModelSummarySchema,
  RecommendationsResponseSchema,
} from './schemas'
import type {
  ChatRequest,
  ChatResponse,
  Model,
  ModelSummary,
  Recommendation,
} from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const ModelSummaryListSchema = z.array(ModelSummarySchema)

function ensureOk(response: Response, operation: string): void {
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `${operation} respondió ${response.status}`,
    )
  }
}

export function createApiClient(baseUrl: string) {
  // fetch se resuelve en cada llamada (no al crear el cliente) para que MSW
  // en Node intercepte también al singleton `api`.
  const client = createClient<paths>({
    baseUrl,
    fetch: (request) => globalThis.fetch(request),
  })

  return {
    async listModels(): Promise<ModelSummary[]> {
      const { data, response } = await client.GET('/models')
      ensureOk(response, 'GET /models')
      return ModelSummaryListSchema.parse(data)
    },

    async getModel(modelId: string): Promise<Model> {
      const { data, response } = await client.GET('/models/{modelId}', {
        params: { path: { modelId } },
      })
      ensureOk(response, `GET /models/${modelId}`)
      return ModelSchema.parse(data)
    },

    async chat(request: ChatRequest): Promise<ChatResponse> {
      const { data, response } = await client.POST('/chat', { body: request })
      ensureOk(response, 'POST /chat')
      return ChatResponseSchema.parse(data)
    },

    async recommend(
      profile: string,
      sessionId?: string,
    ): Promise<Recommendation[]> {
      const { data, response } = await client.POST('/recommendations', {
        body: { profile, sessionId },
      })
      ensureOk(response, 'POST /recommendations')
      return RecommendationsResponseSchema.parse(data).items
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

export const api = createApiClient(env.apiUrl)
