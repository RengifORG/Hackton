import type { components } from './schema'

export {
  appointmentTypeValues,
  chatResponseSuggestedActionsValues,
  hotspotValues,
} from './schema'

export type Hotspot = components['schemas']['Hotspot']
export type AppointmentType = components['schemas']['AppointmentType']
export type Model = components['schemas']['Model']
export type ModelSummary = components['schemas']['ModelSummary']
export type Recommendation = components['schemas']['Recommendation']
export type ChatRequest = components['schemas']['ChatRequest']
export type ChatResponse = components['schemas']['ChatResponse']
export type SuggestedAction = ChatResponse['suggestedActions'][number]
export type LeadCreate = components['schemas']['LeadCreate']
export type Lead = components['schemas']['Lead']
