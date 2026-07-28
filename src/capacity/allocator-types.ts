/** Queue axis in the capacity allocator (not the Mirador Queue API type). */
export type AllocatorQueue = {
  id: string
  name: string
  /** Colour from the existing queue colour source (`colorFromRecordId`). */
  hue: string
}

/**
 * Agents grouped by identical queue-eligibility set.
 * `skills` are indices into the allocator's `queues` array — which queues
 * this cohort can serve — not Salesforce Skill records.
 */
export type SkillProfile = {
  id: string
  /** Number of agents with exactly this skill/eligibility combination. */
  cap: number
  skills: number[]
}

export type AllocatorInput = {
  queues: AllocatorQueue[]
  profiles: SkillProfile[]
  /** Total agents in scope (online roster with at least one known queue). */
  total: number
  /** Current allocation, parallel to `queues`. Always sums to `total`. */
  current: number[]
}

export type AllocatorView = 'areas' | 'lines' | 'sliders'

export type HardRange = readonly [number, number]
export type DynRange = readonly [number, number]
