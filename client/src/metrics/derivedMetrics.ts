export type MetricKey = 'typing_wpm' | 'key_flight_ms' | 'key_dwell_ms' | 'digraph_ms' | 'mouse_velocity_px_ms' | 'mouse_acceleration' | 'mouse_curvature' | 'scroll_speed_px_ms' | 'scroll_reversals' | 'active_minutes' | 'idle_minutes';

export type DerivedMetrics = Record<MetricKey, number>;
export type BaselineMetric = { mean: number; std: number };
export type MetricsBaseline = Record<MetricKey, BaselineMetric>;

const BASELINE_KEY = 'dbla:baseline:';

export function deriveMetrics(vector: Record<string, number>, session: { activeMs?: number; idleMs?: number } = {}): DerivedMetrics {
  return {
    typing_wpm: (vector.typing_speed || 0) * 48,
    key_flight_ms: (vector.flight_mean || 0) * 300,
    key_dwell_ms: (vector.dwell_mean || 0) * 200,
    digraph_ms: (vector.digraph_mean || 0) * 300,
    mouse_velocity_px_ms: (vector.mouse_velocity || 0) * 2,
    mouse_acceleration: (vector.mouse_acceleration || 0) * 1.5,
    mouse_curvature: (vector.mouse_curvature || 0) * 100,
    scroll_speed_px_ms: (vector.scroll_speed || 0) * 2,
    scroll_reversals: (vector.scroll_reversals || 0) * 5,
    active_minutes: (session.activeMs || 0) / 60000,
    idle_minutes: (session.idleMs || 0) / 60000,
  };
}

export function buildBaseline(vectors: Record<string, number>[]): MetricsBaseline | null {
  if (vectors.length < 3) return null;
  const rows = vectors.map((vector) => deriveMetrics(vector));
  return Object.fromEntries(Object.keys(rows[0]).map((key) => {
    const values = rows.map((row) => row[key as MetricKey]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return [key, { mean, std: Math.sqrt(variance) }];
  })) as MetricsBaseline;
}

export function saveBaseline(userId: string, vectors: Record<string, number>[]) {
  const baseline = buildBaseline(vectors);
  if (baseline) localStorage.setItem(`${BASELINE_KEY}${userId}`, JSON.stringify(baseline));
  return baseline;
}

export function loadBaseline(userId: string): MetricsBaseline | null {
  try { return JSON.parse(localStorage.getItem(`${BASELINE_KEY}${userId}`) || 'null') as MetricsBaseline | null; } catch { return null; }
}

export function clearBaseline(userId: string) { localStorage.removeItem(`${BASELINE_KEY}${userId}`); }

export function deltaPercent(value: number, baseline: BaselineMetric | undefined) {
  if (!baseline || baseline.mean === 0) return null;
  return ((value - baseline.mean) / Math.abs(baseline.mean)) * 100;
}

export function patternPercentages(metrics: DerivedMetrics): Record<'focused' | 'exploratory' | 'idle' | 'erratic', number> {
  const focusedScore = Math.min(1, (metrics.typing_wpm / 40 + metrics.mouse_velocity_px_ms / 1.5) / 2);
  const exploratoryScore = Math.min(1, (metrics.mouse_curvature / 100 + metrics.scroll_reversals / 5) / 2);
  const idleScore = Math.min(1, metrics.idle_minutes / Math.max(1, metrics.active_minutes + metrics.idle_minutes));
  const erraticScore = Math.min(1, (metrics.mouse_acceleration + metrics.scroll_reversals / 5) / 2);
  const total = focusedScore + exploratoryScore + idleScore + erraticScore;
  if (!total) return { focused: 25, exploratory: 25, idle: 25, erratic: 25 };
  const raw = [focusedScore, exploratoryScore, idleScore, erraticScore].map((score) => score / total * 100);
  const rounded = raw.map(Math.round);
  rounded[0] += 100 - rounded.reduce((sum, value) => sum + value, 0);
  return { focused: rounded[0], exploratory: rounded[1], idle: rounded[2], erratic: rounded[3] };
}

export const metricLabels: Record<MetricKey, string> = {
  typing_wpm: 'WPM', key_flight_ms: 'Flight', key_dwell_ms: 'Dwell', digraph_ms: 'Digraph',
  mouse_velocity_px_ms: 'px/ms', mouse_acceleration: 'Acceleration', mouse_curvature: 'Curvature',
  scroll_speed_px_ms: 'px/ms', scroll_reversals: 'Reversals', active_minutes: 'Active', idle_minutes: 'Idle',
};
