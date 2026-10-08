import { Html } from '@react-three/drei'
import type { Hotspot } from '@/lib/api/types'
import type { Vec3 } from '../model/camera'

interface HotspotMarkerProps {
  id: Hotspot
  label: string
  position: Vec3
  active: boolean
  onSelect: (id: Hotspot) => void
}

export function HotspotMarker({
  id,
  label,
  position,
  active,
  onSelect,
}: HotspotMarkerProps) {
  return (
    <Html position={position} center zIndexRange={[10, 0]}>
      <button
        type="button"
        aria-label={label}
        title={label}
        className={`h-5 w-5 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-125 ${
          active ? 'scale-125 bg-red-600' : 'bg-sky-500/90'
        }`}
        onClick={() => onSelect(id)}
      />
    </Html>
  )
}
