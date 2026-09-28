# Architecture

## Principles
1. **Pure domain core.** `js/domain/*` and `js/data/*` never touch the DOM or storage, so they run in Node tests unchanged.
2. **Derived, not stored.** EXP, level, rank, stats, streaks and titles are computed from the raw log (`logs`, `sessions`). They can never drift, and changing the balance later re-scores history automatically.
3. **Versioned state.** `core/store.js` owns `SCHEMA`, forward `MIGRATIONS` and a sanitiser (`migrate`). It accepts any input (old saves, imports, corrupt JSON) and returns a valid state.
4. **Deterministic plans.** `buildDayPlan(day, settings)` is a pure function. A test checks every day of every program length and session budget: total time never exceeds 10 minutes, every block is at least 30 s, knife, stick and striking appear every day, and drills never come from a later phase.
5. **Time is computed, never counted.** `SessionRunner` works from timestamps, so screen locks and background throttling can't desync the timer.
6. **Platform bridge.** `services/platform.js` is the only place that knows about Capacitor. The web build degrades gracefully (Web Audio / speechSynthesis / Wake Lock / file download).

## Data flow
```
views --(store.update(pureTransition))--> store --(persist localStorage)--> subscribers
  ^                                          |
  +---- render(ctx: state, today, info, pc) <+   (app.js re-renders the live view; watchers pop Level-up / Title windows)
```

## Scaling paths
- **More content:** add drills to `data/drills.js` (phase + cues + videos), then run `npm run verify:videos`. The generator picks them up automatically.
- **New disciplines:** add to `DISCIPLINES` and give them a weight in `DAY_TYPES`.
- **Cloud sync / accounts:** implement a storage adapter with `getItem`/`setItem` and pass it to `createStore`. State is one JSON document, and the `id`/`ts` on every log entry already allow merging.
- **i18n:** all copy lives in views and data files. Extract it to a strings module when you add languages.
- **iOS:** `npx cap add ios`. `platform.js` already abstracts the native plugins.
