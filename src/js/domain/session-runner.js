// Timestamp-based interval engine (survives tab sleep / screen lock: time is computed, never counted).
// Clock is injected so tests can drive it.

export class SessionRunner {
  constructor(segments, { now = () => Date.now() } = {}) {
    this.segments = segments;
    this.now = now;
    this.i = 0;
    this.base = 0; // ms accumulated in current segment before the last resume
    this.startedAt = null;
    this.finished = false;
    this.results = segments.map(() => ({ secs: 0, reps: null, skipped: false }));
  }

  get current() {
    return this.segments[this.i];
  }

  get running() {
    return this.startedAt != null;
  }

  elapsed() {
    return (this.base + (this.startedAt != null ? this.now() - this.startedAt : 0)) / 1000;
  }

  remaining() {
    return this.current ? Math.max(0, this.current.seconds - this.elapsed()) : 0;
  }

  start() {
    if (!this.finished && this.startedAt == null) this.startedAt = this.now();
  }

  pause() {
    if (this.startedAt != null) {
      this.base += this.now() - this.startedAt;
      this.startedAt = null;
    }
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  /** Call often. Returns 'next' when a timed segment auto-completes, 'awaitReps' when a rep block's clock runs out. */
  tick() {
    if (this.finished || !this.running) return null;
    const seg = this.current;
    if (this.elapsed() < seg.seconds) return null;
    if (seg.kind === 'reps') return 'awaitReps';
    this._close({});
    return this.finished ? 'done' : 'next';
  }

  /** Finish a rep block with the reps actually done. */
  submitReps(reps) {
    if (this.finished || this.current.kind !== 'reps') return;
    this._close({ reps: Math.max(0, Math.floor(Number(reps) || 0)) });
  }

  skip() {
    if (!this.finished) this._close({ skipped: true });
  }

  back() {
    if (this.i === 0) return this.restartSegment();
    const wasRunning = this.running;
    this.results[this.i] = { secs: 0, reps: null, skipped: false };
    this.i -= 1;
    this.results[this.i] = { secs: 0, reps: null, skipped: false };
    this.base = 0;
    this.startedAt = wasRunning ? this.now() : null;
  }

  restartSegment() {
    this.base = 0;
    this.startedAt = this.running ? this.now() : null;
  }

  _close({ reps = null, skipped = false }) {
    const seg = this.current;
    this.results[this.i] = { secs: Math.min(seg.seconds, this.elapsed()), reps, skipped };
    const wasRunning = this.running || this.startedAt != null;
    this.i += 1;
    this.base = 0;
    if (this.i >= this.segments.length) {
      this.finished = true;
      this.startedAt = null;
      this.i = this.segments.length - 1;
    } else {
      this.startedAt = wasRunning ? this.now() : null;
    }
  }

  /** Totals for recordSession(): seconds per discipline (timed blocks only) + reps per exercise. */
  summary({ includeCurrent = false } = {}) {
    const secs = {};
    const reps = {};
    this.segments.forEach((seg, k) => {
      const r = this.results[k];
      if (seg.kind === 'timed') secs[seg.disc] = (secs[seg.disc] || 0) + r.secs;
      else if (r.reps != null) reps[seg.ex] = r.reps;
    });
    // Quitting mid-block: count the part of the current timed block already done.
    const cur = this.current;
    if (includeCurrent && !this.finished && cur?.kind === 'timed') secs[cur.disc] = (secs[cur.disc] || 0) + Math.min(cur.seconds, this.elapsed());
    return { secs, reps, reachedEnd: this.finished };
  }

  progress() {
    if (this.finished) return 1;
    const total = this.segments.reduce((a, s) => a + s.seconds, 0);
    const done = this.segments.slice(0, this.i).reduce((a, s) => a + s.seconds, 0);
    return total ? Math.min(1, (done + Math.min(this.current.seconds, this.elapsed())) / total) : 1;
  }
}
