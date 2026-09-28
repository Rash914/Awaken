// Calendar program generator: deterministic day plans that never exceed the session budget (max 10 min).
import { APP } from '../config.js';
import { DISCIPLINES, drillsFor } from '../data/drills.js';
import { EXERCISE_IDS } from '../data/exercises.js';
import { diffDays } from '../core/dates.js';

export const PHASES = [
  { id: 0, rank: 'E', name: 'Awakening', focus: 'Stance, basic strikes, angles 1-5' },
  { id: 1, rank: 'C', name: 'Hunter', focus: 'Combinations, defence, all 12 angles' },
  { id: 2, rank: 'A', name: 'Ascendant', focus: 'Flow, shadow rounds, sinawali' },
];

/** 7-day cycle. Index = (programDay - 1) % 7. */
export const WEEK = ['boxing', 'muaythai', 'boxing', 'muaythai', 'mixed', 'weapons', 'recovery'];

export const DAY_TYPES = {
  boxing: { name: 'Boxing Day', weights: { boxing: 0.55, knife: 0.225, stick: 0.225 } },
  muaythai: { name: 'Muay Thai Day', weights: { muaythai: 0.55, knife: 0.225, stick: 0.225 } },
  mixed: { name: 'Mixed Striking', weights: { boxing: 0.275, muaythai: 0.275, knife: 0.225, stick: 0.225 } },
  weapons: { name: 'Weapons Day', weights: { striking: 0.3, knife: 0.35, stick: 0.35 } },
  recovery: { name: 'Active Recovery', weights: { striking: 0.2, knife: 0.15, stick: 0.15, mobility: 0.5 } },
};

const ROUND = 5;
const MIN_SEG = 30;
const SPLIT_OVER = 150; // striking blocks longer than this become two rounds

export function programDay(startDate, today) {
  return diffDays(startDate, today) + 1;
}

export function phaseOf(day, programDays) {
  return Math.max(0, Math.min(2, Math.floor((day - 1) / (programDays / 3))));
}

export function dayType(day) {
  return WEEK[(((day - 1) % 7) + 7) % 7];
}

function budgetSeconds(minutes) {
  const m = Math.min(APP.maxSessionMinutes, Math.max(1, Number(minutes) || APP.maxSessionMinutes));
  return m * 60;
}

/** Alternates boxing / Muay Thai for "striking" slots by week. */
function strikingDisc(day) {
  return Math.floor((day - 1) / 7) % 2 === 0 ? 'boxing' : 'muaythai';
}

/**
 * Drill rotation: the first pick is from the current phase; later picks review earlier phases
 * (or continue the current phase in phase 0). `n` = how many times this discipline has appeared.
 */
export function pickDrills(disc, phase, n, count) {
  const current = drillsFor(disc, phase).filter((d) => d.phase === phase);
  const review = drillsFor(disc, phase).filter((d) => d.phase < phase);
  const pool = current.length ? current : drillsFor(disc, phase);
  const out = [];
  for (let k = 0; k < count; k++) {
    let d;
    if (k === 0 || !review.length) d = pool[(n + k) % pool.length];
    else d = review[(n + k) % review.length];
    if (out.some((x) => x.id === d.id)) d = pool[(n + k + 1) % pool.length];
    out.push(d);
  }
  return out;
}

function distribute(flex, weights) {
  const keys = Object.keys(weights);
  const secs = {};
  let used = 0;
  keys.forEach((k) => {
    secs[k] = Math.max(MIN_SEG, Math.round((flex * weights[k]) / ROUND) * ROUND);
    used += secs[k];
  });
  // Put rounding drift on the largest block, never below MIN_SEG.
  const big = keys.reduce((a, b) => (secs[a] >= secs[b] ? a : b));
  secs[big] = Math.max(MIN_SEG, secs[big] + (flex - used));
  return secs;
}

/**
 * Builds the plan for a program day.
 * @returns {{day, phase, type, typeName, budget, segments: Array, totalSeconds}}
 */
export function buildDayPlan(day, { programDays = 90, sessionMinutes = 10, includeStrength = true } = {}) {
  const budget = budgetSeconds(sessionMinutes);
  const phase = phaseOf(day, programDays);
  const type = dayType(day);
  const small = budget < 480;
  const warm = small ? 45 : 60;
  const cool = type === 'recovery' ? 0 : 30; // recovery day has its own long mobility block
  const repSecs = includeStrength ? (small ? 30 : 40) : 0;
  const flex = budget - warm - cool - repSecs * EXERCISE_IDS.length;

  const weights = { ...DAY_TYPES[type].weights };
  if (weights.striking != null) {
    weights[strikingDisc(day)] = weights.striking;
    delete weights.striking;
  }
  const secs = distribute(flex, weights);
  const week = Math.floor((day - 1) / 7);
  const segs = [];
  const push = (disc, drill, seconds, label) =>
    segs.push({ kind: 'timed', disc, drillId: drill.id, seconds, title: label || `${DISCIPLINES[disc].short}: ${drill.name}` });

  push('warmup', pickDrills('warmup', 0, day, 1)[0], warm);
  for (const disc of ['boxing', 'muaythai']) {
    if (!secs[disc]) continue;
    const rounds = secs[disc] > SPLIT_OVER ? 2 : 1;
    const drills = pickDrills(disc, phase, week * 3 + day, rounds);
    const each = Math.floor(secs[disc] / rounds / ROUND) * ROUND;
    drills.forEach((d, i) => push(disc, d, i === rounds - 1 ? secs[disc] - each * (rounds - 1) : each));
  }
  if (secs.knife) push('knife', pickDrills('knife', phase, day, 1)[0], secs.knife);
  if (secs.stick) push('stick', pickDrills('stick', phase, day + 1, 1)[0], secs.stick);
  if (includeStrength) for (const ex of EXERCISE_IDS) segs.push({ kind: 'reps', ex, seconds: repSecs, title: ex });
  if (secs.mobility) push('mobility', pickDrills('mobility', 0, day, 1)[0], secs.mobility);
  if (cool) push('mobility', pickDrills('mobility', 0, 0, 1)[0], cool, 'Cool-down & Breathing');

  const totalSeconds = segs.reduce((a, s) => a + s.seconds, 0);
  return { day, phase, type, typeName: DAY_TYPES[type].name, budget, segments: segs, totalSeconds };
}
