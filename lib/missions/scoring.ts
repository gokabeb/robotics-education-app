//
// score = 100 - (hintsUsed * 10) - timePenalty, clamped to [0, 100]
// timePenalty = max(0, (timeSeconds - estimatedSeconds) / estimatedSeconds * 20)
//
// Deviates from the design spec's formula by dropping the +10
// flashed-to-hardware bonus (flasher ships in Phase 5) and clamping to
// [0, 100] instead of [0, 110], since the bonus is unreachable right now.

export interface ScoringInput {
  hintsUsed: number
  timeSeconds: number
  estimatedMinutes: number
}

export function computeScore(input: ScoringInput): number {
  const estimatedSeconds = input.estimatedMinutes * 60
  const timePenalty = Math.max(
    0,
    ((input.timeSeconds - estimatedSeconds) / estimatedSeconds) * 20
  )
  const raw = 100 - input.hintsUsed * 10 - timePenalty
  return Math.max(0, Math.min(100, Math.round(raw)))
}
