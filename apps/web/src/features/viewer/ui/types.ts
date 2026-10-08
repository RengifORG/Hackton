import type { Hotspot, Model } from '@/lib/api/types'

export interface ViewerProps {
  model: Model
  onHotspotSelect: (id: Hotspot) => void
}
