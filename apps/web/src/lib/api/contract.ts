import type { z } from 'zod'

// Guardas de contrato: `tsc -b` falla si un esquema zod se desvía del tipo
// generado desde openapi.yaml. La asignabilidad mutua no detecta un opcional
// de más o de menos, por eso también se comparan las claves.
export type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false

export type MatchesContract<Schema extends z.ZodType, Contract> =
  MutuallyAssignable<z.infer<Schema>, Contract> extends true
    ? MutuallyAssignable<keyof z.infer<Schema>, keyof Contract>
    : false

export type Assert<T extends true> = T
