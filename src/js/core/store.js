// Persistent state: versioned schema, forward migrations, defensive sanitising, pub/sub.
// Storage is injected (localStorage in the app, an in-memory map in tests).
import { APP } from '../config.js';
import { EXERCISES, EXERCISE_IDS } from '../data/exercises.js';
import { DISCIPLINES } from '../data/drills.js';
import { isDateKey } from './dates.js';

export const SCHEMA = 1;

export function defaultState() {
  return {
    schema: SCHEMA,
    profile: { name: '', awakened: false, createdAt: null },
    settings: {
      programDays: 90,
      sessionMinutes: 10,
      includeStrength: true,
      penalty: true,
      voice: true,
      sound: true,
      reminderOn: false,
      reminderTime: '07:00',
    },
    program: { startDate: null, cycle: 1, completedCycles: 0 },
    baseline: { pushup: 0, squat: 0, crunch: 0, date: null },
    strength: Object.fromEntries(EXERCISE_IDS.map((id) => [id, { stage: EXERCISES[id].defaultStage, target: 10, hits: 0, misses: 0 }])),
    startStages: Object.fromEntries(EXERCISE_IDS.map((id) => [id, EXERCISES[id].defaultStage])),
    logs: [], // { id, date, ts, ex, stage, reps, src: 'quest' | 'manual' }
    sessions: [], // { id, date, ts, day, type, secs: {disc: n}, reps: {ex: n}, complete, penalty }
    seenAchievements: [],
  };
}

// migrations[n] upgrades schema n -> n+1. Add new ones here; never edit old ones.
const MIGRATIONS = {};

const int = (v, lo, hi, dflt) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

/** Accepts anything (old save, import file, garbage) and returns a valid current-schema state. */
export function migrate(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  let s = structuredClone(raw);
  let v = int(s.schema, 0, SCHEMA, 1);
  while (v < SCHEMA) {
    s = MIGRATIONS[v] ? MIGRATIONS[v](s) : s;
    v += 1;
  }

  const p = s.profile || {};
  const st = s.settings || {};
  const pr = s.program || {};
  const b = s.baseline || {};
  const out = {
    schema: SCHEMA,
    profile: {
      name: typeof p.name === 'string' ? p.name.slice(0, 24) : '',
      awakened: bool(p.awakened, false),
      createdAt: Number.isFinite(p.createdAt) ? p.createdAt : null,
    },
    settings: {
      programDays: APP.programLengths.includes(st.programDays) ? st.programDays : d.settings.programDays,
      sessionMinutes: APP.sessionMinuteOptions.includes(st.sessionMinutes) ? st.sessionMinutes : d.settings.sessionMinutes,
      includeStrength: bool(st.includeStrength, true),
      penalty: bool(st.penalty, true),
      voice: bool(st.voice, true),
      sound: bool(st.sound, true),
      reminderOn: bool(st.reminderOn, false),
      reminderTime: /^\d{2}:\d{2}$/.test(st.reminderTime) ? st.reminderTime : '07:00',
    },
    program: {
      startDate: isDateKey(pr.startDate) ? pr.startDate : null,
      cycle: int(pr.cycle, 1, 999, 1),
      completedCycles: int(pr.completedCycles, 0, 999, 0),
    },
    baseline: {
      pushup: int(b.pushup, 0, 500, 0),
      squat: int(b.squat, 0, 500, 0),
      crunch: int(b.crunch, 0, 500, 0),
      date: isDateKey(b.date) ? b.date : null,
    },
    strength: {},
    startStages: {},
    logs: [],
    sessions: [],
    seenAchievements: Array.isArray(s.seenAchievements) ? s.seenAchievements.filter((x) => typeof x === 'string') : [],
  };

  for (const id of EXERCISE_IDS) {
    const e = (s.strength || {})[id] || {};
    const maxStage = EXERCISES[id].stages.length - 1;
    out.strength[id] = {
      stage: int(e.stage, 0, maxStage, d.strength[id].stage),
      target: int(e.target, 3, 60, 10),
      hits: int(e.hits, 0, 10, 0),
      misses: int(e.misses, 0, 10, 0),
    };
    out.startStages[id] = int((s.startStages || {})[id], 0, maxStage, out.strength[id].stage);
  }

  if (Array.isArray(s.logs)) {
    out.logs = s.logs
      .filter((l) => l && EXERCISES[l.ex] && isDateKey(l.date) && Number.isFinite(l.ts))
      .map((l) => ({
        id: String(l.id || l.ts),
        date: l.date,
        ts: l.ts,
        ex: l.ex,
        stage: int(l.stage, 0, EXERCISES[l.ex].stages.length - 1, 0),
        reps: int(l.reps, 0, 1000, 0),
        src: l.src === 'quest' ? 'quest' : 'manual',
      }))
      .filter((l) => l.reps > 0);
  }

  if (Array.isArray(s.sessions)) {
    out.sessions = s.sessions
      .filter((x) => x && isDateKey(x.date) && Number.isFinite(x.ts))
      .map((x) => ({
        id: String(x.id || x.ts),
        date: x.date,
        ts: x.ts,
        day: int(x.day, 0, 10000, 0),
        type: typeof x.type === 'string' ? x.type : '',
        secs: Object.fromEntries(Object.keys(DISCIPLINES).map((k) => [k, int((x.secs || {})[k], 0, 3600, 0)])),
        reps: Object.fromEntries(EXERCISE_IDS.map((k) => [k, int((x.reps || {})[k], 0, 1000, 0)])),
        complete: bool(x.complete, false),
        penalty: bool(x.penalty, false),
      }));
  }
  return out;
}

export function createMemoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

export function createStore({ storage, key = APP.storageKey, onError = () => {} } = {}) {
  const subs = new Set();
  let state;
  try {
    const raw = storage.getItem(key);
    state = raw ? migrate(JSON.parse(raw)) : defaultState();
  } catch (e) {
    onError(e);
    state = defaultState();
  }

  const persist = () => {
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch (e) {
      onError(e); // quota / private mode: keep running in memory
    }
  };

  return {
    get: () => state,
    /** fn receives a draft copy and returns the next state (or mutates and returns nothing). */
    update(fn) {
      const draft = structuredClone(state);
      const next = fn(draft) ?? draft;
      state = next;
      persist();
      subs.forEach((f) => f(state));
      return state;
    },
    replace(raw) {
      state = migrate(raw);
      persist();
      subs.forEach((f) => f(state));
    },
    reset() {
      state = defaultState();
      persist();
      subs.forEach((f) => f(state));
    },
    subscribe(f) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}
