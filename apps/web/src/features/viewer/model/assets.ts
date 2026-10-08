// El contrato no expone la URL del .glb: los assets 3D viven en public/models.
export const DRACO_DECODER_PATH = '/draco/'

// Mismo HDR que el preset "city" de drei, servido local (sin CDN).
export const ENVIRONMENT_MAP_URL = '/hdri/potsdamer_platz_1k.hdr'

export function glbUrlFor(modelId: string): string {
  return `/models/${modelId}.glb`
}
