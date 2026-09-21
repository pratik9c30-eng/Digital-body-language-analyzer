export type KeyStats = { typing_speed: number; dwell_mean: number; flight_mean: number; digraph_mean: number; typing_variance: number; timing_entropy: number };
export class KeystrokeCapture {
  private down = new Map<string, number>(); private lastUp = 0; private dwell: number[] = []; private flight: number[] = []; private digraph: number[] = [];
  onKeyDown(event: KeyboardEvent) { const now = performance.now(); if (!this.down.has(event.code)) { this.down.set(event.code, now); if (this.lastUp) this.flight.push(now - this.lastUp); } }
  onKeyUp(event: KeyboardEvent) { const now = performance.now(); const started = this.down.get(event.code); if (started !== undefined) this.dwell.push(now - started); if (this.lastUp) this.digraph.push(now - this.lastUp); this.lastUp = now; this.down.delete(event.code); }
  snapshot(): KeyStats { const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 120; const avg = mean(this.dwell); const variance = this.dwell.length > 1 ? this.dwell.reduce((s, x) => s + (x - avg) ** 2, 0) / this.dwell.length : 40; return { typing_speed: Math.min(1, this.dwell.length / 30), dwell_mean: avg / 200, flight_mean: mean(this.flight) / 300, digraph_mean: mean(this.digraph) / 300, typing_variance: Math.min(1, variance / 5000), timing_entropy: Math.min(1, (new Set(this.dwell.map(x => Math.round(x / 10))).size) / 12) }; }
}
