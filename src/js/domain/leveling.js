// XP, player level, hunter rank and stats - all derived from the log (never stored), so they can't drift.
import { EXERCISES } from '../data/exercises.js';
import { DISCIPLINES } from '../data/drills.js';

export const XP_RULES = Object.freeze({
  perRep: 1,
  secondsPerXp: 3,
  questBonus: 100,
  streakBonusPerDay: 5,
  streakBonusMax: 50,
  penaltyClearBonus: 50,
});

export const RANKS = [
  { id: 'E', min: 1, name: 'E-Rank' },
  { id: 'D', min: 6, name: 'D-Rank' },
  { id: 'C', min: 13, name: 'C-Rank' },
  { id: 'B', min: 21, name: 'B-Rank' },
  { id: 'A', min: 31, name: 'A-Rank' },
  { id: 'S', min: 41, name: 'S-Rank' },
];

export const STATS = [
  { id: 'STR', name: 'Strength', from: 'Push-ups' },
  { id: 'VIT', name: 'Vitality', from: 'Squats' },
  { id: 'CORE', name: 'Core', from: 'Crunches' },
  { id: 'STRIKE', name: 'Striking', from: 'Boxing + Muay Thai' },
  { id: 'BLADE', name: 'Blade', from: 'Knife skills' },
  { id: 'STAFF', name: 'Staff', from: 'Rod / stick' },
];

export const STAT_BASE = 10;
export const STAT_XP_PER_POINT = 50;

export function xpToNext(level) {
  return 100 + 25 * (level - 1);
}

export function levelFromXp(xp) {
  let level = 1;
  let rem = Math.max(0, Math.floor(xp));
  while (rem >= xpToNext(level)) {
    rem -= xpToNext(level);
    level += 1;
  }
  return { level, into: rem, need: xpToNext(level) };
}

export function rankOf(level) {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.min) r = x;
  return r;
}

/** Unique completed-quest dates, ascending. */
export function questDates(state) {
  return [...new Set(state.sessions.filter((s) => s.complete).map((s) => s.date))].sort();
}

/** Streak ending at `today` (or yesterday if today isn't done yet). */
export function currentStreak(dates, today, addDays) {
  const set = new Set(dates);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(dates, addDays) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/**
 * Full derived progress snapshot.
 * @param {object} state persisted state
 * @param {(k:string,n:number)=>string} addDays date helper (injected to keep this module pure)
 */
export function computeProgress(state, addDays) {
  const statXp = Object.fromEntries(STATS.map((s) => [s.id, 0]));
  const reps = { pushup: 0, squat: 0, crunch: 0 };
  const secs = Object.fromEntries(Object.keys(DISCIPLINES).map((k) => [k, 0]));
  let xp = 0;

  for (const log of state.logs) {
    const ex = EXERCISES[log.ex];
    if (!ex) continue;
    reps[log.ex] += log.reps;
    statXp[ex.stat] += log.reps * XP_RULES.perRep;
    xp += log.reps * XP_RULES.perRep;
  }

  const bonusDates = new Set();
  let run = 0;
  let prevDate = null;
  let penaltiesCleared = 0;
  const sorted = [...state.sessions].sort((a, b) => a.ts - b.ts);
  for (const s of sorted) {
    for (const [disc, sec] of Object.entries(s.secs || {})) {
      if (!(disc in secs)) continue;
      secs[disc] += sec;
      const gained = Math.floor(sec / XP_RULES.secondsPerXp);
      xp += gained;
      const stat = DISCIPLINES[disc].stat;
      if (stat) statXp[stat] += gained;
    }
    if (s.complete && !bonusDates.has(s.date)) {
      bonusDates.add(s.date);
      run = prevDate && addDays(prevDate, 1) === s.date ? run + 1 : 1;
      prevDate = s.date;
      xp += XP_RULES.questBonus + Math.min(XP_RULES.streakBonusMax, (run - 1) * XP_RULES.streakBonusPerDay);
      if (s.penalty) {
        xp += XP_RULES.penaltyClearBonus;
        penaltiesCleared += 1;
      }
    }
  }

  const lvl = levelFromXp(xp);
  const stats = Object.fromEntries(STATS.map((s) => [s.id, STAT_BASE + Math.floor(statXp[s.id] / STAT_XP_PER_POINT)]));
  return {
    xp,
    ...lvl,
    rank: rankOf(lvl.level),
    stats,
    statXp,
    reps,
    secs,
    questsDone: bonusDates.size,
    penaltiesCleared,
  };
}
