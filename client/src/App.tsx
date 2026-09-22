import { useCallback, useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { TrustScoreGauge } from './components/TrustScoreGauge';
import { CalibrationGame } from './components/CalibrationGame';
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
import { isCalibrationComplete, loadCalibrationProgress } from './metrics/calibrationProgress';
import { useAuth } from './auth/AuthProvider';
import { AuthPage } from './components/AuthPage';

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
  const { user, loading, logout } = useAuth();
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  const [locked, setLocked] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const userId = user?.id || '';
  const { score, vector, metrics, baseline, connection } = useBehaviorStream(userId, Boolean(user) && calibrationComplete);
  useEffect(() => {
    setCalibrationComplete(Boolean(user && isCalibrationComplete(loadCalibrationProgress(user.id).counts)));
  }, [user]);
  const lock = useCallback(() => setLocked(true), []);
  const resetDemo = () => { void apiRequest(`/api/admin/session/${userId}`, { method: 'DELETE' }).catch(() => undefined); clearBaseline(userId); clearCalibrationProgress(userId); setCalibrationComplete(false); setLocked(false); setVerificationOpen(false); };
  const signOut = async () => { await logout(); };
  const background = <WebThreads color1="#80D0B2" color2="#F4B860" color3="#FFFFFF" speed={0.16} threadCount={6} frequency={5} spread={0.2} brightness={0.5} opacity={0.9} mouseInteraction mouseStrength={0.24} />;

  if (loading) return <div className="app-shell auth-shell"><div className="auth-loading">Restoring your session...</div></div>;
  if (!user) return <AuthPage />;
  if (!calibrationComplete) return <div className="app-shell calibration-shell">{background}<div className="app-content"><CalibrationGame userId={userId} onDone={() => setCalibrationComplete(true)} /></div></div>;
  return <div className="app-shell">
    {background}
    <div className="app-content">
      <PanicGestureListener onLock={lock} />
      <DashboardShell user={user} onLogout={signOut} score={score} vector={vector} metrics={metrics} baseline={baseline} connection={connection} locked={locked} onReset={resetDemo} onRecalibrate={resetDemo} />
    </div>
    {locked && <div className="lock-screen"><LockKeyhole size={40} /><h2>Verification recommended.</h2><p>A high-risk behavioral anomaly or duress gesture was detected.</p><button onClick={() => { setLocked(false); setVerificationOpen(true); }}>Resume with verification</button></div>}
    {verificationOpen && <VerificationModal onComplete={() => setVerificationOpen(false)} />}
  </div>;
}
