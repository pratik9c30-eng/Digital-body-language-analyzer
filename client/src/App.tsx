import { useCallback, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { CalibrationGame } from './components/CalibrationGame';
import { TrustScoreGauge } from './components/TrustScoreGauge';
import { BehavioralHeartbeat } from './components/BehavioralHeartbeat';
import { DriftTimeline } from './components/DriftTimeline';
import { ExplainabilityPanel } from './components/ExplainabilityPanel';
import { PassiveChallenge } from './components/PassiveChallenge';
import { PanicGestureListener } from './components/PanicGestureListener';
import { AdminDashboard } from './components/AdminDashboard';
import { LiveSignalPanel } from './components/LiveSignalPanel';
import WebThreads from './components/WebThreads';
import { useBehaviorStream } from './hooks/useBehaviorStream';
import { DashboardShell } from './components/DashboardPages';
import { apiRequest } from './services/apiClient';
import './styles/globals.css';
import { clearBaseline } from './metrics/derivedMetrics';
import { clearCalibrationProgress } from './metrics/calibrationProgress';

function VerificationModal({ onComplete }: { onComplete: () => void }) {
  return <div className="verification-overlay" role="presentation">
    <section className="verification-modal" role="dialog" aria-modal="true" aria-labelledby="verification-title">
      <div className="verification-icon"><ShieldCheck size={28} /></div>
      <span className="eyebrow">CONTINUOUS VERIFICATION</span>
      <h2 id="verification-title">Confirm your rhythm.</h2>
      <p>Move naturally and press any key to re-establish your behavioral baseline.</p>
      <button className="verification-action" onClick={onComplete}>Complete verification</button>
    </section>
  </div>;
}

export default function App() {
  const [calibrated, setCalibrated] = useState(false);
  const [locked, setLocked] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const userId = 'demo-session';
  const { score, vector, metrics, baseline, connection } = useBehaviorStream(userId, calibrated);
  const lock = useCallback(() => setLocked(true), []);
  const resetDemo = () => { void apiRequest(`/api/admin/session/${userId}`, { method: 'DELETE' }).catch(() => undefined); clearBaseline(userId); clearCalibrationProgress(userId); setLocked(false); setVerificationOpen(false); setCalibrated(false); };
  const background = <WebThreads color1="#80D0B2" color2="#F4B860" color3="#FFFFFF" speed={0.16} threadCount={6} frequency={5} spread={0.2} brightness={0.5} opacity={0.9} mouseInteraction mouseStrength={0.24} />;

  if (!calibrated) return <div className="app-shell calibration-shell">{background}<div className="app-content"><CalibrationGame userId={userId} onDone={() => setCalibrated(true)} /></div></div>;

  return <div className="app-shell">
    {background}
    <div className="app-content">
      <PanicGestureListener onLock={lock} />
      <DashboardShell score={score} vector={vector} metrics={metrics} baseline={baseline} connection={connection} locked={locked} onReset={resetDemo} onRecalibrate={resetDemo} />
    </div>
    {locked && <div className="lock-screen"><LockKeyhole size={40} /><h2>Verification recommended.</h2><p>A high-risk behavioral anomaly or duress gesture was detected.</p><button onClick={() => { setLocked(false); setVerificationOpen(true); }}>Resume with verification</button></div>}
    {verificationOpen && <VerificationModal onComplete={() => setVerificationOpen(false)} />}
  </div>;
}
