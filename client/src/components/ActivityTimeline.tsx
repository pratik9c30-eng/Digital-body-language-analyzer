import { MousePointer2, MoveDown, Keyboard, MonitorUp } from 'lucide-react';

type ActivityItem = { label: string; time: string; icon: typeof Keyboard };

export function ActivityTimeline({ vector, compact = false }: { vector: Record<string, number>; compact?: boolean }) {
  const now = new Date();
  const stamp = (offset: number) => new Date(now.getTime() - offset * 1250).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: compact ? undefined : '2-digit' });
  const items: ActivityItem[] = [
    { label: vector.typing_speed ? 'Typing detected' : 'Waiting for typing signal', time: stamp(0), icon: Keyboard },
    { label: vector.mouse_velocity ? 'Mouse movement' : 'Mouse signal pending', time: stamp(1), icon: MousePointer2 },
    { label: vector.scroll_speed ? 'Scroll detected' : 'Scroll signal pending', time: stamp(2), icon: MoveDown },
    { label: 'Session observed', time: stamp(3), icon: MonitorUp },
  ];
  return <div className={`activity-list ${compact ? 'compact' : ''}`}>{items.map(({ label, time, icon: Icon }) => <div className="activity-item" key={`${label}-${time}`}><span className="activity-icon"><Icon size={13} /></span><span><strong>{label}</strong><small>{time}</small></span></div>)}</div>;
}