// Skill library: every drill and exercise stage with how-to, callouts, safety and verified videos.
import { h, win, segmented } from '../ui/dom.js';
import { DISCIPLINES, drillsFor } from '../data/drills.js';
import { EXERCISES } from '../data/exercises.js';
import { VIDEOS, VERIFIED_ON } from '../data/videos.js';
import { PHASES } from '../domain/program.js';

const ui = { tab: 'boxing' };
const TABS = [
  { value: 'boxing', label: 'Boxing' },
  { value: 'muaythai', label: 'Muay Thai' },
  { value: 'knife', label: 'Knife' },
  { value: 'stick', label: 'Rod' },
  { value: 'strength', label: 'Strength' },
  { value: 'other', label: 'Warm/Cool' },
];

const videoList = (ids) => ids.map((id) => h('a', { class: 'video', href: `https://www.youtube.com/watch?v=${id}`, target: '_blank', rel: 'noopener noreferrer' },
  h('span', { class: 'play', 'aria-hidden': 'true' }, '▶'),
  h('span', {}, VIDEOS[id]?.title || id, h('small', { class: 'muted block' }, VIDEOS[id]?.author || ''))));

export function render({ refresh }) {
  const pick = (v) => { ui.tab = v; refresh(); };
  let body;
  if (ui.tab === 'strength') {
    body = Object.values(EXERCISES).map((ex) => win(ex.name.toUpperCase(), ex.stages.map((s, i) =>
      h('details', { class: 'lib' },
        h('summary', {}, `${i + 1}. ${s.name}`, s.advanceAt ? h('small', { class: 'muted' }, ` · advance at ${s.advanceAt}`) : null),
        h('ol', {}, s.how.map((x) => h('li', {}, x))),
        videoList(s.videos)))));
  } else {
    const discs = ui.tab === 'other' ? ['warmup', 'mobility'] : [ui.tab];
    body = discs.flatMap((disc) => drillsFor(disc).map((d) => win(d.name.toUpperCase(), [
      h('div', { class: 'chips' },
        h('span', { class: 'chip', style: { borderColor: DISCIPLINES[disc].color, color: DISCIPLINES[disc].color } }, DISCIPLINES[disc].short),
        h('span', { class: 'chip' }, `Phase ${d.phase + 1}: ${PHASES[d.phase].name}`)),
      h('ol', {}, d.how.map((x) => h('li', {}, x))),
      d.safety ? h('p', { class: 'warn small' }, d.safety) : null,
      h('p', { class: 'muted small' }, 'Callouts: ', d.cues.join(' · ')),
      videoList(d.videos),
      h('a', { class: 'small muted', href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${d.name} ${DISCIPLINES[disc].name} tutorial`)}`, target: '_blank', rel: 'noopener noreferrer' }, 'More on YouTube →'),
    ])));
  }
  return h('div', { class: 'stack' },
    h('div', { class: 'tabs-scroll' }, segmented(TABS, ui.tab, pick, 'Skill category')),
    body,
    h('p', { class: 'muted small center' }, `All video links checked public on ${VERIFIED_ON}. Videos belong to their creators.`));
}
