import { useEffect, useRef, useState } from 'react';
import { SensorFusion } from '../capture/sensorFusion';
import { CALIBRATION_MIN_QUALITY, buildApiUrl } from '../config';
import { normalizeFeatures } from '../ml-client/featureNormalizer';
import { apiRequest } from '../services/apiClient';
import { saveBaseline } from '../metrics/derivedMetrics';
import { CALIBRATION_MINIMUM, CALIBRATION_TARGET, isCalibrationComplete, loadCalibrationProgress, missingBehaviors, saveCalibrationProgress, totalCollected, type Behavior, type CalibrationProgress } from '../metrics/calibrationProgress';

const TYPING_PAUSE_MS = 500;
const MOUSE_SEGMENT_MS = 300;
const MOUSE_SEGMENT_DISTANCE = 100;
const SCROLL_PAUSE_MS = 500;
const MIN_SCROLL_EVENTS = 3;
type CalibrationStatus = { collected: number; confidence: number };
type SegmentState = { keyCount: number; lastKeyAt: number; pointerSegmentAt: number; pointerStart: { x: number; y: number } | null; pointerDistance: number; scrollEvents: number; lastScrollAt: number };

function createSegmentState(): SegmentState { return { keyCount: 0, lastKeyAt: 0, pointerSegmentAt: 0, pointerStart: null, pointerDistance: 0, scrollEvents: 0, lastScrollAt: 0 }; }

export function CalibrationGame({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [progress, setProgress] = useState<CalibrationProgress>(() => loadCalibrationProgress(userId));
  const [latest, setLatest] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [backendError, setBackendError] = useState('');
  const sensors = useRef(new SensorFusion());
  const segments = useRef<SegmentState>(createSegmentState());

  useEffect(() => {
    let active = true;
    const applyStatus = (status: CalibrationStatus) => { if (active) setLatest((current) => ({ ...current, __confidence: status.confidence })); };
    const checkHealth = () => apiRequest('/health', { method: 'GET' }).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); if (active) { setBackendReady(true); setBackendError(''); } }).catch((caught) => { if (active) { setBackendReady(false); setBackendError(caught instanceof Error ? caught.message : 'Connection failed.'); } });
    const refreshStatus = () => apiRequest(`/api/calibration/status?session_id=${encodeURIComponent(userId)}`).then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))).then(applyStatus).catch(() => undefined);
    void checkHealth(); void refreshStatus();
    const sensor = sensors.current;
    const keyDown = (event: KeyboardEvent) => { const now = performance.now(); sensor.keys.onKeyDown(event); segments.current.keyCount += 1; segments.current.lastKeyAt = now; };
    const keyUp = (event: KeyboardEvent) => sensor.keys.onKeyUp(event);
    const move = (event: PointerEvent) => { const state = segments.current; if (!state.pointerStart) { state.pointerStart = { x: event.clientX, y: event.clientY }; state.pointerSegmentAt = performance.now(); } else { state.pointerDistance += Math.hypot(event.clientX - state.pointerStart.x, event.clientY - state.pointerStart.y); state.pointerStart = { x: event.clientX, y: event.clientY }; } sensor.mouse.onMove(event); sensor.touch.onPointer(event); };
    const down = (event: PointerEvent) => { if (event.button === 0 && !segments.current.pointerSegmentAt) { segments.current.pointerSegmentAt = performance.now(); segments.current.pointerStart = { x: event.clientX, y: event.clientY }; segments.current.pointerDistance = 0; } sensor.mouse.onDown(); };
    const up = () => { sensor.mouse.onUp(); };
    const wheel = (event: WheelEvent) => { segments.current.scrollEvents += 1; segments.current.lastScrollAt = performance.now(); sensor.scroll.onWheel(event); };
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('pointermove', move); window.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('wheel', wheel);

    const timer = window.setInterval(() => {
      const now = performance.now();
      const state = segments.current;
      const qualified: Behavior[] = [];
      if (state.keyCount >= 5 && now - state.lastKeyAt >= TYPING_PAUSE_MS) { qualified.push('typing'); state.keyCount = 0; }
      if (state.pointerSegmentAt && now - state.pointerSegmentAt >= MOUSE_SEGMENT_MS && state.pointerDistance >= MOUSE_SEGMENT_DISTANCE) { qualified.push('mouse'); state.pointerSegmentAt = 0; state.pointerStart = null; state.pointerDistance = 0; }
      if (state.scrollEvents >= MIN_SCROLL_EVENTS && now - state.lastScrollAt >= SCROLL_PAUSE_MS) { qualified.push('scroll'); state.scrollEvents = 0; }
      const vector = normalizeFeatures(sensor.snapshot());
      setLatest((current) => ({ ...current, ...vector }));
      setProgress((current) => {
        if (!qualified.length) return current;
        const next = { counts: { ...current.counts }, vectors: { typing: [...current.vectors.typing], mouse: [...current.vectors.mouse], scroll: [...current.vectors.scroll] } };
        qualified.forEach((behavior) => { if (next.counts[behavior] < CALIBRATION_MINIMUM) { next.counts[behavior] += 1; next.vectors[behavior].push(vector); } });
        saveCalibrationProgress(userId, next);
        return next;
      });
      void apiRequest('/api/calibration/sample', { method: 'POST', body: JSON.stringify({ session_id: userId, ts: new Date().toISOString(), vector }) }).then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))).then(applyStatus).catch((caught) => { if (active) { setBackendReady(false); setBackendError(caught instanceof Error ? caught.message : 'Calibration sample failed.'); } });
    }, 1250);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('wheel', wheel); };
  }, [userId]);

  const counts = progress.counts;
  const complete = isCalibrationComplete(counts);
  const confidence = Math.round((latest.__confidence ?? 0) * 100);
  const canSubmit = complete && confidence >= CALIBRATION_MIN_QUALITY * 100 && backendReady === true;
  const missing = missingBehaviors(counts);
  const hints: Record<Behavior, string> = { typing: 'Type a few sentences in the box below.', mouse: 'Move and drag the mouse around.', scroll: 'Scroll the page a few times.' };
  const finish = async () => { if (!canSubmit || saving) return; setSaving(true); setError(''); try { const response = await apiRequest(`/api/calibration/finalize?session_id=${encodeURIComponent(userId)}`, { method: 'POST' }); if (!response.ok) { const detail = await response.json().catch(() => null); throw new Error(detail?.detail || detail?.error || 'Calibration could not be saved'); } saveBaseline(userId, [...progress.vectors.typing, ...progress.vectors.mouse, ...progress.vectors.scroll]); onDone(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Calibration could not be saved'); setSaving(false); } };
  const addProgress = (behavior: Behavior) => <div className="behavior-progress" key={behavior}><div><span>{behavior[0].toUpperCase() + behavior.slice(1)}</span><strong>{Math.min(counts[behavior], CALIBRATION_MINIMUM)}/{CALIBRATION_MINIMUM}</strong></div><i><b style={{ width: `${Math.min(100, counts[behavior] / CALIBRATION_MINIMUM * 100)}%` }} /></i></div>;

  return <section className="calibration-panel" aria-labelledby="calibration-title"><div className="calibration-corner calibration-corner-top" /><div className="calibration-corner calibration-corner-bottom" /><div className="calibration-eyebrow"><span>BASELINE CALIBRATION · 01</span><span className="session-pill">SESSION · {userId}</span></div><div className="calibration-heading"><div className="calibration-kicker">CONTINUOUS BEHAVIORAL VERIFICATION</div><h1 id="calibration-title">Teach DBLA your <em>rhythm.</em></h1><p>Derived timing and motion statistics only. Raw input is never stored.</p></div><div className="calibration-progress"><div className="progress-readout"><strong>{Math.min(totalCollected(counts), CALIBRATION_TARGET)} <span>/ {CALIBRATION_TARGET}</span></strong><span className={`calibration-status-label ${complete ? 'ready' : 'limited'}`}>{complete ? 'BASELINE READY' : 'CALIBRATION INCOMPLETE'}</span></div>{(['typing', 'mouse', 'scroll'] as Behavior[]).map(addProgress)}</div><textarea className="calibration-input" aria-label="Typing calibration" placeholder="Type a few sentences here to calibrate typing rhythm..." autoComplete="off" /><div className="calibration-signals">{missing.length ? <small>{hints[missing[0]]}</small> : <small>All behaviors covered. You can enter live mode.</small>}{missing.length > 1 && <small>Still needed: {missing.map((behavior) => behavior[0].toUpperCase() + behavior.slice(1)).join(', ')}</small>}</div>{backendReady === false && <div className="calibration-alert"><b>BACKEND UNAVAILABLE</b><span>{backendError || `Unable to reach DBLA at ${buildApiUrl('')}.`}</span></div>}{error && <div className="calibration-alert"><b>CALIBRATION ERROR</b><span>{error}</span></div>}<button className="calibration-cta" onClick={finish} disabled={!canSubmit || saving}><span>{saving ? 'Saving baseline...' : 'Enter live mode'}</span><span aria-hidden="true">↗</span></button><div className="calibration-footer"><span>DERIVED VECTORS · {Math.min(totalCollected(counts), CALIBRATION_TARGET)} / {CALIBRATION_TARGET} · ACTIVE {confidence}%</span><span className={`backend-status ${backendReady === true ? 'connected' : backendReady === false ? 'unavailable' : 'checking'}`}><i />{backendReady === true ? 'CONNECTED' : backendReady === false ? 'UNAVAILABLE' : 'CHECKING'}</span></div></section>;
}
