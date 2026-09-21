import { useEffect, useRef, useState } from 'react';
import { SensorFusion } from '../capture/sensorFusion';
import { CALIBRATION_MIN_QUALITY, buildApiUrl } from '../config';
import { normalizeFeatures } from '../ml-client/featureNormalizer';
import { apiRequest } from '../services/apiClient';
import { saveBaseline } from '../metrics/derivedMetrics';

const TARGET = Number(import.meta.env.VITE_CALIBRATION_SAMPLES || 30);
type CalibrationStatus = { collected: number; typing: number; mouse: number; scroll: number; confidence: number };

export function CalibrationGame({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [sampleCount, setSampleCount] = useState(0);
  const [latest, setLatest] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [backendError, setBackendError] = useState('');
  const sensors = useRef(new SensorFusion());
  const sampleVectors = useRef<Record<string, number>[]>([]);

  useEffect(() => {
    let active = true;
    const applyStatus = (status: CalibrationStatus) => {
      if (!active) return;
      setSampleCount(status.collected);
      setLatest((current) => ({ ...current, __typingQuality: status.typing, __mouseQuality: status.mouse, __scrollQuality: status.scroll, __confidence: status.confidence }));
    };
    const checkHealth = () => apiRequest('/health', { method: 'GET' })
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); if (active) { setBackendReady(true); setBackendError(''); } })
      .catch((caught) => { if (active) { setBackendReady(false); setBackendError(caught instanceof Error ? caught.message : 'Connection failed.'); } });
    const refreshStatus = () => apiRequest(`/api/calibration/status?session_id=${encodeURIComponent(userId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(applyStatus)
      .catch(() => undefined);
    void checkHealth();
    void refreshStatus();

    const sensor = sensors.current;
    const keyDown = (event: KeyboardEvent) => sensor.keys.onKeyDown(event);
    const keyUp = (event: KeyboardEvent) => sensor.keys.onKeyUp(event);
    const move = (event: PointerEvent) => { sensor.mouse.onMove(event); sensor.touch.onPointer(event); };
    const down = () => sensor.mouse.onDown();
    const up = () => sensor.mouse.onUp();
    const wheel = (event: WheelEvent) => sensor.scroll.onWheel(event);
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('pointermove', move); window.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('wheel', wheel);

    const timer = window.setInterval(() => {
      const vector = normalizeFeatures(sensor.snapshot());
      sampleVectors.current = [...sampleVectors.current.slice(-29), vector];
      setLatest((current) => ({ ...current, ...vector }));
      void apiRequest('/api/calibration/sample', { method: 'POST', body: JSON.stringify({ session_id: userId, ts: new Date().toISOString(), vector }) })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
        .then(applyStatus)
        .catch((caught) => { if (active) { setBackendReady(false); setBackendError(caught instanceof Error ? caught.message : 'Calibration sample failed.'); } });
    }, 1250);
    const healthTimer = window.setInterval(() => { void checkHealth(); }, 5000);
    return () => { active = false; window.clearInterval(timer); window.clearInterval(healthTimer); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('wheel', wheel); };
  }, [userId]);

  const typingQuality = latest.__typingQuality ?? 0;
  const mouseQuality = latest.__mouseQuality ?? 0;
  const scrollQuality = latest.__scrollQuality ?? 0;
  const confidence = Math.round((latest.__confidence ?? 0) * 100);
  const canSubmit = sampleCount >= TARGET && confidence >= CALIBRATION_MIN_QUALITY * 100 && backendReady === true;
  const complete = async () => {
    if (!canSubmit || saving) return;
    setSaving(true); setError('');
    try {
      const response = await apiRequest(`/api/calibration/finalize?session_id=${encodeURIComponent(userId)}`, { method: 'POST' });
      if (!response.ok) { const detail = await response.json().catch(() => null); throw new Error(detail?.detail || detail?.error || 'Calibration could not be saved'); }
      saveBaseline(userId, sampleVectors.current);
      onDone();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Calibration could not be saved'); setSaving(false); }
  };
  const progress = Math.min(100, Math.round((sampleCount / TARGET) * 100));
  const signalThreshold = CALIBRATION_MIN_QUALITY * 100;
  const signalStatus = (value: number) => value * 100 < signalThreshold ? 'weak' : value * 100 < 75 ? 'moderate' : 'healthy';
  const statusLabel = sampleCount >= TARGET && confidence >= signalThreshold ? 'BASELINE READY' : confidence < signalThreshold ? 'LIMITED SIGNAL' : 'COLLECTING';
  const statusClass = statusLabel === 'BASELINE READY' ? 'ready' : statusLabel === 'LIMITED SIGNAL' ? 'limited' : 'collecting';
  const signals = [{ label: 'Typing', value: typingQuality, hint: 'Keep typing naturally.' }, { label: 'Mouse', value: mouseQuality, hint: 'Move your mouse more.' }, { label: 'Scroll', value: scrollQuality, hint: 'Scroll a little to enrich this signal.' }, { label: 'Confidence', value: confidence / 100, hint: 'More varied activity will improve confidence.' }];

  return <section className="calibration-panel" aria-labelledby="calibration-title">
    <div className="calibration-corner calibration-corner-top" /><div className="calibration-corner calibration-corner-bottom" />
    <div className="calibration-eyebrow"><span>BASELINE CALIBRATION · 01</span><span className="session-pill">SESSION · {userId}</span></div>
    <div className="calibration-heading"><div className="calibration-kicker">CONTINUOUS BEHAVIORAL VERIFICATION</div><h1 id="calibration-title">Teach DBLA your <em>rhythm.</em></h1><p>Timing and motion statistics only. No text is recorded.</p></div>
    <div className="calibration-progress" aria-label={`${sampleCount} of ${TARGET} samples collected`}><div className="progress-segments">{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < Math.ceil(progress / 10) ? 'active' : ''} />)}</div><div className="progress-readout"><strong>{sampleCount} <span>/ {TARGET}</span></strong><span className={`calibration-status-label ${statusClass}`}>{statusLabel}</span></div></div>
    <div className="calibration-signals">{signals.map((signal) => { const state = signalStatus(signal.value); return <div className={`signal-meter ${state}`} key={signal.label}><div className="signal-meter-head"><span>{signal.label}</span><strong>{Math.round(signal.value * 100)}%</strong></div><div className="signal-meter-track"><i style={{ width: `${Math.round(signal.value * 100)}%` }} /></div>{state !== 'healthy' && <small>{signal.hint}</small>}</div>; })}</div>
    {backendReady === false && <div className="calibration-alert"><b>BACKEND UNAVAILABLE <button type="button" onClick={() => void window.location.reload()}>Retry</button></b><span>{backendError || `Unable to reach DBLA at ${buildApiUrl('')}.`}</span></div>}
    {error && <div className="calibration-alert"><b>CALIBRATION ERROR</b><span>{error}</span></div>}
    <button className="calibration-cta" onClick={complete} disabled={!canSubmit || saving}><span>{saving ? 'Saving baseline...' : 'Enter live mode'}</span><span aria-hidden="true">↗</span></button>
    <div className="calibration-footer"><span>REAL DERIVED VECTORS · {sampleCount} / {TARGET} COLLECTED · SAMPLED EVERY 1.25S</span><span className={`backend-status ${backendReady === true ? 'connected' : backendReady === false ? 'unavailable' : 'checking'}`}><i />{backendReady === true ? 'CONNECTED' : backendReady === false ? 'UNAVAILABLE' : 'CHECKING'}</span></div>
  </section>;
}
