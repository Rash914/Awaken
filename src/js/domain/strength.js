// Strength ladder logic: daily rep targets auto-adjust from performance (pure functions).
import { EXERCISES, stageOf } from '../data/exercises.js';

export const TARGET_MIN = 3;
export const TARGET_MAX = 60;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Starting target from a max-reps test: ~60% of max = quality reps with a buffer. */
export function initialTarget(maxReps) {
  const n = Number(maxReps);
  return clamp(Math.round((Number.isFinite(n) ? n : 0) * 0.6), TARGET_MIN, TARGET_MAX);
}

export function newEntry(exId, stage, maxReps) {
  return { stage: stage ?? EXERCISES[exId].defaultStage, target: initialTarget(maxReps), hits: 0, misses: 0 };
}

/**
 * Update after a quest set. Two hits in a row -> +1 (or +2 if the user smashed it);
 * two clear misses (<80%) in a row -> -1. Near-misses hold steady.
 */
export function afterSet(entry, reps, questTarget = entry.target) {
  const e = { ...entry };
  const r = Math.max(0, Math.floor(Number(reps) || 0));
  if (r >= questTarget) {
    e.hits += 1;
    e.misses = 0;
    if (e.hits >= 2) {
      e.target = clamp(e.target + (r >= questTarget + 3 ? 2 : 1), TARGET_MIN, TARGET_MAX);
      e.hits = 0;
    }
  } else if (r < questTarget * 0.8) {
    e.misses += 1;
    e.hits = 0;
    if (e.misses >= 2) {
      e.target = clamp(e.target - 1, TARGET_MIN, TARGET_MAX);
      e.misses = 0;
    }
  } else {
    e.hits = 0;
    e.misses = 0;
  }
  return e;
}

export function canAdvance(exId, entry) {
  const stages = EXERCISES[exId].stages;
  const s = stageOf(exId, entry.stage);
  return entry.stage < stages.length - 1 && s.advanceAt != null && entry.target >= s.advanceAt;
}

/** Class advancement: harder variation, target resets to half. */
export function advance(exId, entry) {
  if (!canAdvance(exId, entry)) return entry;
  return { stage: entry.stage + 1, target: clamp(Math.round(entry.target * 0.5), TARGET_MIN, TARGET_MAX), hits: 0, misses: 0 };
}

/** Target shown in today's quest. Penalty = +20% reps (time stays the same); recovery day = 60%. */
export function questTarget(entry, { penalty = false, recovery = false } = {}) {
  if (penalty) return Math.ceil(entry.target * 1.2);
  if (recovery) return Math.max(TARGET_MIN, Math.round(entry.target * 0.6));
  return entry.target;
}
