import type { components } from './schema'

export type Hotspot = components['schemas']['Hotspot']
export type AppointmentType = components['schemas']['AppointmentType']
export type Model = components['schemas']['Model']
export type ModelSummary = components['schemas']['ModelSummary']
export type ChatRequest = components['schemas']['ChatRequest']
export type ChatResponse = components['schemas']['ChatResponse']
export type SuggestedAction = ChatResponse['suggestedActions'][number]
