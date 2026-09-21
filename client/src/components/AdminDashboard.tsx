import { useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient';

type AwsStatus = { configured: boolean; services: Record<string, boolean> };
type History = { source: 'aws' | 'local'; events: { trust_score: number; tier: string }[] };

export function AdminDashboard() {
  const [aws, setAws] = useState<AwsStatus>();
  const [history, setHistory] = useState<History>();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    Promise.all([apiRequest('/api/admin/aws'), apiRequest('/api/admin/history')])
      .then(async ([status, events]) => {
        if (status.ok) setAws(await status.json());
        if (events.ok) setHistory(await events.json());
        if (!status.ok || !events.ok) setUnavailable(true);
      })
      .catch(() => setUnavailable(true));
  }, []);

  const highRisk = history?.events.filter((event) => event.tier !== 'silent').length || 0;
  const eventCount = history?.events.length || 0;
  const trustedWidth = eventCount ? Math.max(1, 100 - highRisk / eventCount * 100) : 78;
  const watchWidth = eventCount ? highRisk / eventCount * 100 : 16;

  return <section className="admin panel">
    <div className="panel-title"><span>Organization pulse</span><small>ANONYMIZED VIEW</small></div>
    {unavailable && <small className="state-warning">Dashboard service unavailable. Live scoring is separate.</small>}
    <div className="admin-grid">
      <strong>{eventCount} <small>recent events</small></strong>
      <strong>{eventCount ? Math.round(history!.events.reduce((sum, event) => sum + event.trust_score, 0) / eventCount * 10) / 10 : '--'} <small>avg trust</small></strong>
      <strong>{highRisk} <small>watchlist</small></strong>
    </div>
    <div className="bar"><i style={{ width: `${trustedWidth}%` }} /><i style={{ width: `${watchWidth}%` }} /><i style={{ width: '6%' }} /></div>
    <div className="legend"><span>Trusted</span><span>Watch {highRisk}</span><span>{history?.source === 'aws' ? 'AWS history' : 'Local fallback'}</span></div>
    <div className="aws-status"><b>AWS services</b><span>{aws?.configured ? 'configured' : 'not configured'}</span>{aws && <small>{Object.entries(aws.services).filter(([, ready]) => ready).map(([name]) => name).join(' · ') || 'No AWS resources configured'}</small>}</div>
    <div className="security-events"><b>Recent security events</b>{history?.events.slice(0, 3).map((event, index) => <span key={index}><i className={event.tier} /><strong>{event.tier}</strong><small>trust {Math.round(event.trust_score)}</small></span>) || <small>No events recorded yet.</small>}</div>
  </section>;
}
