// Bootstrap: store, router, global watchers (level-ups, titles), service worker.
import { APP } from './config.js';
import { createStore, createMemoryStorage } from './core/store.js';
import { dateKey } from './core/dates.js';
import { todayInfo, progressContext, achievementsFor } from './domain/quest.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { setAudioPrefs, sfx } from './services/audio.js';
import { isNative } from './services/platform.js';
import { systemAlert, toast } from './ui/system.js';
import { h } from './ui/dom.js';
import * as awaken from './views/onboarding.js';
import * as home from './views/home.js';
import * as session from './views/session.js';
import * as log from './views/log.js';
import * as calendar from './views/calendar.js';
import * as library from './views/library.js';
import * as settings from './views/settings.js';

const routes = { awaken, home, session, log, calendar, library, settings };
const FULLSCREEN = new Set(['awaken', 'session']);

function safeStorage() {
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    return localStorage;
  } catch {
    return createMemoryStorage();
  }
}

let warnedStorage = false;
const store = createStore({
  storage: safeStorage(),
  onError: (e) => {
    console.warn('[store]', e);
    if (!warnedStorage) { warnedStorage = true; toast('Storage unavailable - progress may not be saved. Export a backup.', 5000); }
  },
});

const viewEl = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
let currentName = '';
let lastLevel = null;

const routeName = () => location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'home';
export const go = (name) => { if (routeName() !== name) location.hash = `#/${name}`; else render(); };

function makeCtx() {
  const state = store.get();
  const today = dateKey();
  const awakened = state.profile.awakened;
  return {
    store,
    state,
    today,
    go,
    info: awakened ? todayInfo(state, today) : null,
    pc: awakened ? progressContext(state, today) : null,
    title: equippedTitle(state),
    refresh: () => render({ keepScroll: true }),
  };
}

function equippedTitle(state) {
  const id = state.seenAchievements[state.seenAchievements.length - 1];
  return ACHIEVEMENTS.find((a) => a.id === id)?.title || 'Unranked';
}

function render({ keepScroll = false } = {}) {
  const state = store.get();
  let name = routeName();
  if (!state.profile.awakened && name !== 'awaken') return location.replace('#/awaken');
  if (state.profile.awakened && name === 'awaken') return location.replace('#/home');
  if (!routes[name]) return location.replace('#/home');

  if (currentName && currentName !== name) routes[currentName].unmount?.();
  const changed = currentName !== name;
  currentName = name;
  const y = window.scrollY;
  let node;
  try {
    node = routes[name].render(makeCtx());
  } catch (e) {
    console.error(e);
    node = h('div', { class: 'win' }, h('p', {}, 'Something went wrong rendering this screen.'), h('pre', { class: 'muted small' }, String(e?.message || e)));
  }
  viewEl.replaceChildren(node);
  document.body.classList.toggle('fullscreen', FULLSCREEN.has(name));
  tabsEl.querySelectorAll('a').forEach((a) => a.setAttribute('aria-current', a.dataset.route === name ? 'page' : 'false'));
  if (changed) { window.scrollTo(0, 0); viewEl.focus({ preventScroll: true }); } else if (keepScroll) window.scrollTo(0, y);
}

function watch() {
  const state = store.get();
  setAudioPrefs({ sound: state.settings.sound, voice: state.settings.voice });
  if (!state.profile.awakened) { lastLevel = null; return; }
  const ctx = progressContext(state, dateKey());
  const level = ctx.progress.level;
  if (lastLevel != null && level > lastLevel && currentName !== 'session') {
    sfx('levelup');
    systemAlert({ title: 'LEVEL UP', tone: 'gold', lines: [`You have reached Level ${level}.`, `Rank: ${ctx.progress.rank.name}`] });
  }
  lastLevel = level;
  const fresh = achievementsFor(ctx).filter((a) => !state.seenAchievements.includes(a.id));
  if (fresh.length) {
    queueMicrotask(() => store.update((s) => { s.seenAchievements.push(...fresh.map((a) => a.id)); }));
    if (currentName !== 'session') {
      fresh.forEach((a) => systemAlert({ title: 'TITLE ACQUIRED', tone: 'gold', lines: [`[${a.title}]`, a.desc] }));
    }
  }
}

store.subscribe(() => {
  if (routes[currentName]?.live !== false) render({ keepScroll: true });
  watch();
});
window.addEventListener('hashchange', () => render());
// Day rollover / returning from background: re-render so "today" is right.
document.addEventListener('visibilitychange', () => { if (!document.hidden && routes[currentName]?.live !== false) render({ keepScroll: true }); });

document.getElementById('brand-name').textContent = APP.name.toUpperCase();
render();
watch();
// Quest arrival notice once per day.
{
  const s = store.get();
  const today = dateKey();
  let seen = null;
  try { seen = sessionStorage.getItem('arrived'); sessionStorage.setItem('arrived', today); } catch { /* ignore */ }
  if (s.profile.awakened && currentName === 'home' && seen !== today) {
    const info = todayInfo(s, today);
    if (!info.done) {
      systemAlert(info.penalty
        ? { title: 'PENALTY QUEST', tone: 'danger', lines: ['Yesterday\'s Daily Quest was not cleared.', 'Today\'s rep targets are increased by 20%.'] }
        : { title: 'DAILY QUEST ARRIVED', lines: [`Day ${info.day}: ${info.plan.typeName}.`, 'Clear it to grow stronger.'] });
    }
  }
}

if ('serviceWorker' in navigator && !isNative() && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[sw]', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (currentName === 'session') toast('Update ready - it will apply next launch.');
    else location.reload();
  });
}
