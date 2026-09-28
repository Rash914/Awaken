// Synthesised UI sounds (no audio files) + text-to-speech callouts.
// Native: Capacitor TextToSpeech plugin (Android WebView has no speechSynthesis). Web: speechSynthesis.
import { plugin } from './platform.js';

const prefs = { sound: true, voice: true };
let ctx = null;

export function setAudioPrefs(p) {
  Object.assign(prefs, p);
}

/** Must be called from a user gesture once (browsers block audio until then). */
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq, dur, { type = 'sine', gain = 0.12, at = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SOUNDS = {
  tick: () => tone(880, 0.08, { type: 'square', gain: 0.05 }),
  go: () => { tone(660, 0.12); tone(990, 0.2, { at: 0.12 }); },
  notify: () => { tone(740, 0.1, { type: 'triangle' }); tone(1110, 0.18, { type: 'triangle', at: 0.1 }); },
  alert: () => { tone(220, 0.18, { type: 'sawtooth', gain: 0.08 }); tone(180, 0.25, { type: 'sawtooth', gain: 0.08, at: 0.2 }); },
  levelup: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', at: i * 0.11 })),
};

export function sfx(name) {
  if (!prefs.sound) return;
  try {
    SOUNDS[name]?.();
  } catch { /* audio is best-effort */ }
}

/** "1-2-3" -> "1, 2, 3" so TTS reads numbers as a combo. */
export function speechText(s) {
  return String(s).replace(/(\d)\s*-\s*(?=\d)/g, '$1, ');
}

export function speak(text) {
  if (!prefs.voice || !text) return;
  const t = speechText(text);
  const tts = plugin('TextToSpeech');
  if (tts) {
    tts.stop?.().catch?.(() => {});
    tts.speak({ text: t, lang: 'en-US', rate: 1.05, pitch: 1.0, volume: 1.0, category: 'playback' }).catch(() => {});
    return;
  }
  if ('speechSynthesis' in window) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.rate = 1.05;
      u.lang = 'en-US';
      speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }
}
