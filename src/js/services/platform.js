// Platform bridge: everything that differs between the browser PWA and the Capacitor Android app.
export const isNative = () => Boolean(window.Capacitor?.isNativePlatform?.());
export const plugin = (name) => (isNative() ? window.Capacitor?.Plugins?.[name] : undefined);

// ---- Keep the screen on during a session
let lock = null;
export async function keepAwake(on) {
  const ka = plugin('KeepAwake');
  try {
    if (ka) return on ? await ka.keepAwake() : await ka.allowSleep();
    if (on && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { /* not fatal */ }
}

// ---- Daily reminder (Android: local notification; web: not schedulable without a push server)
const REMINDER_ID = 1001;
export const remindersSupported = () => Boolean(plugin('LocalNotifications'));

export async function scheduleReminder(on, time, name) {
  const ln = plugin('LocalNotifications');
  if (!ln) return { ok: false, reason: 'unsupported' };
  try {
    await ln.cancel({ notifications: [{ id: REMINDER_ID }] });
    if (!on) return { ok: true };
    let perm = await ln.checkPermissions();
    if (perm.display !== 'granted') perm = await ln.requestPermissions();
    if (perm.display !== 'granted') return { ok: false, reason: 'denied' };
    const [hour, minute] = time.split(':').map(Number);
    await ln.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: '[SYSTEM] Daily Quest has arrived',
        body: `${name || 'Hunter'}, your 10-minute training is waiting.`,
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      }],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

// ---- Backup export
export async function exportText(filename, text) {
  if (!isNative()) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}
