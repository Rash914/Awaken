// Settings: training prefs, reminders, program cycle, backup/restore, reset, about.
import { h, win, segmented, toggle } from '../ui/dom.js';
import { APP } from '../config.js';
import { restartProgram } from '../domain/quest.js';
import { remindersSupported, scheduleReminder, exportText, isNative } from '../services/platform.js';
import { systemAlert, systemConfirm, toast } from '../ui/system.js';

const ui = { nextLen: null };

export function render({ state, store, today, info, refresh }) {
  const set = (fn) => store.update(fn);
  const st = state.settings;
  ui.nextLen = ui.nextLen || st.programDays;

  const nameIn = h('input', { class: 'text-in', maxlength: 24, value: state.profile.name, 'aria-label': 'Player name' });
  nameIn.addEventListener('change', () => { const v = nameIn.value.trim(); if (v) set((s) => { s.profile.name = v; }); });

  const reminderTime = h('input', { type: 'time', class: 'text-in', value: st.reminderTime, 'aria-label': 'Reminder time', disabled: !st.reminderOn });
  reminderTime.addEventListener('change', async () => {
    set((s) => { s.settings.reminderTime = reminderTime.value || '07:00'; });
    await applyReminder(store);
  });

  return h('div', { class: 'stack' },
    win('PLAYER', [h('label', { class: 'small muted' }, 'Name'), nameIn]),
    win('TRAINING', [
      h('p', { class: 'muted small' }, 'Daily session length (hard cap - never more than 10 min)'),
      segmented(APP.sessionMinuteOptions.map((m) => ({ value: m, label: `${m} min` })), st.sessionMinutes, (v) => set((s) => { s.settings.sessionMinutes = v; }), 'Session length'),
      toggle('Strength sets in the quest', st.includeStrength, (v) => set((s) => { s.settings.includeStrength = v; }), 'Push-ups, squats, crunches inside the session'),
      toggle('Penalty Quests', st.penalty, (v) => set((s) => { s.settings.penalty = v; }), 'Missed day → +20% reps next day'),
      toggle('Voice callouts', st.voice, (v) => set((s) => { s.settings.voice = v; })),
      toggle('Sound effects', st.sound, (v) => set((s) => { s.settings.sound = v; })),
    ]),
    win('DAILY REMINDER', [
      toggle('Remind me', st.reminderOn, async (v) => { set((s) => { s.settings.reminderOn = v; }); await applyReminder(store); },
        remindersSupported() ? 'Local notification at a set time' : 'Available in the Android app'),
      reminderTime,
    ]),
    win('PROGRAM', [
      h('p', {}, `Cycle ${state.program.cycle} · ${st.programDays} days · ${info.finished ? 'finished' : `day ${info.day}`}`),
      h('p', { class: 'muted small' }, 'Start a new cycle from today. History, levels and stats are kept.'),
      segmented(APP.programLengths.map((d) => ({ value: d, label: `${d} days` })), ui.nextLen, (v) => { ui.nextLen = v; refresh(); }, 'New program length'),
      h('button', { class: 'btn', onClick: async () => {
        if (await systemConfirm('NEW CYCLE', `Start a new ${ui.nextLen}-day program today?`, { confirm: 'Start' })) {
          set((s) => restartProgram(s, { today, programDays: ui.nextLen }));
          toast('New cycle started');
        }
      } }, 'Start new cycle'),
    ]),
    win('DATA', [
      h('p', { class: 'muted small' }, 'Everything stays on this device. Export a backup regularly.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', onClick: () => doExport(state) }, isNative() ? 'Copy backup' : 'Export backup'),
        h('button', { class: 'btn', onClick: () => doImport(store) }, 'Import backup')),
      h('button', { class: 'btn danger', onClick: async () => {
        if (!(await systemConfirm('RESET', 'Erase ALL progress, logs and settings on this device?', { confirm: 'Erase', danger: true }))) return;
        if (!(await systemConfirm('ARE YOU SURE?', 'This cannot be undone.', { confirm: 'Erase everything', danger: true }))) return;
        store.reset();
        location.hash = '#/awaken';
      } }, 'Reset everything'),
    ]),
    win('ABOUT', [
      h('p', {}, `${APP.name} ${APP.version} - ${APP.tagline}`),
      h('p', { class: 'muted small' }, 'A progression-fantasy "System" for real-world training. Not affiliated with any anime, manhwa or game.'),
      h('p', { class: 'muted small' }, 'Not medical advice. Weapons drills use training tools only. Stop if anything hurts.'),
      h('p', { class: 'muted small' }, 'Tutorial videos are hosted on YouTube and belong to their creators.'),
    ]));
}

async function applyReminder(store) {
  const s = store.get();
  if (!remindersSupported()) {
    if (s.settings.reminderOn) toast('Reminders need the Android app. In the browser, add this app to your home screen.');
    return;
  }
  const r = await scheduleReminder(s.settings.reminderOn, s.settings.reminderTime, s.profile.name);
  if (!r.ok) {
    store.update((x) => { x.settings.reminderOn = false; });
    toast(r.reason === 'denied' ? 'Notification permission denied' : 'Could not schedule reminder');
  } else if (s.settings.reminderOn) toast(`Reminder set for ${s.settings.reminderTime}`);
}

async function doExport(state) {
  const text = JSON.stringify({ app: 'awaken', exportedAt: new Date().toISOString(), state }, null, 1);
  try {
    const how = await exportText(`awaken-backup-${new Date().toISOString().slice(0, 10)}.json`, text);
    toast(how === 'copied' ? 'Backup copied - paste it somewhere safe (notes, email).' : 'Backup downloaded');
  } catch {
    toast('Export failed');
  }
}

async function doImport(store) {
  const ta = h('textarea', { class: 'text-in', rows: 5, placeholder: 'Paste backup text here…', 'aria-label': 'Backup text' });
  const file = h('input', { type: 'file', accept: 'application/json,.json,text/plain', 'aria-label': 'Backup file' });
  file.addEventListener('change', async () => { if (file.files[0]) ta.value = await file.files[0].text(); });
  const v = await systemAlert({
    title: 'IMPORT BACKUP',
    lines: [h('p', { class: 'small muted' }, 'Choose a backup file or paste its text. This replaces current data.'), file, ta],
    actions: [{ label: 'Cancel', value: false }, { label: 'Import', value: true, primary: true }],
  });
  if (!v) return;
  try {
    const parsed = JSON.parse(ta.value);
    const raw = parsed?.app === 'awaken' ? parsed.state : parsed;
    if (!raw || typeof raw !== 'object' || !raw.profile) throw new Error('not a backup');
    store.replace(raw);
    toast('Backup restored');
  } catch {
    systemAlert({ title: 'IMPORT FAILED', tone: 'danger', lines: ['That does not look like an Awaken backup.'] });
  }
}
