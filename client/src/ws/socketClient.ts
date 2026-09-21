import type { FeatureVector } from '../capture/sensorFusion';
import { buildWsUrl } from '../config';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'backend_unavailable';
export type Score = { trust_score: number; tier: 'silent' | 'challenge' | 'lock'; status?: 'calibration_required' | 'disconnected' | 'backend_unavailable'; error?: string; reasons: { label: string; reason: string; z_score: number }[]; bot_probability: number; timestamp: string };

export class SocketClient {
  private socket?: WebSocket;
  connect(userId: string, onScore: (score: Score) => void, onStatus?: (status: ConnectionStatus) => void) {
    onStatus?.('connecting');
    this.socket = new WebSocket(buildWsUrl(`/ws/session/${userId}`));
    this.socket.onopen = () => onStatus?.('connected');
    this.socket.onmessage = (event) => {
      try {
        const value = JSON.parse(event.data) as Score;
        if (typeof value.trust_score === 'number' && value.tier) onScore(value);
        else if (value.status === 'calibration_required') onScore({ ...value, trust_score: 0, tier: 'challenge', reasons: [], bot_probability: 0, timestamp: new Date().toISOString() });
      } catch {
        onStatus?.('backend_unavailable');
      }
    };
    this.socket.onerror = () => onStatus?.('backend_unavailable');
    this.socket.onclose = () => onStatus?.('disconnected');
    return () => this.socket?.close();
  }
  send(vector: FeatureVector) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(vector));
  }
}
