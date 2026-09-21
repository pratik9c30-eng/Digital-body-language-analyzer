import { useEffect, useRef, useState } from 'react';
import { SensorFusion } from '../capture/sensorFusion';
import { normalizeFeatures } from '../ml-client/featureNormalizer';
import { SocketClient, type ConnectionStatus, type Score } from '../ws/socketClient';
import { sendAwsBatch, type AwsEvent } from '../services/awsBatch';
import { deriveMetrics, loadBaseline, type DerivedMetrics, type MetricsBaseline } from '../metrics/derivedMetrics';

export function useBehaviorStream(userId: string, enabled = true) {
	const [score, setScore] = useState<Score>({ trust_score: 0, tier: 'silent', status: 'calibration_required', reasons: [], bot_probability: 0, timestamp: new Date().toISOString() });
	const [vector, setVector] = useState<Record<string, number>>({});
	const [metrics, setMetrics] = useState<DerivedMetrics | null>(null);
	const [baseline, setBaseline] = useState<MetricsBaseline | null>(() => loadBaseline(userId));
	const [connection, setConnection] = useState<ConnectionStatus>('disconnected');
	const sensors = useRef(new SensorFusion());
	const socket = useRef(new SocketClient());
	const scoreRef = useRef(score);
	const awsQueue = useRef<AwsEvent[]>([]);
	const startedAt = useRef(Date.now());
	const lastActivity = useRef(Date.now());
	scoreRef.current = score;

	useEffect(() => {
		setBaseline(loadBaseline(userId));
		if (!enabled) { setConnection('disconnected'); return; }
		const sensor = sensors.current;
		const clean = socket.current.connect(userId, setScore, setConnection);
		const markActivity = () => { lastActivity.current = Date.now(); };
		const keyDown = (event: KeyboardEvent) => { markActivity(); sensor.keys.onKeyDown(event); };
		const keyUp = (event: KeyboardEvent) => { markActivity(); sensor.keys.onKeyUp(event); };
		const move = (event: PointerEvent) => { markActivity(); sensor.mouse.onMove(event); sensor.touch.onPointer(event); };
		const down = () => { markActivity(); sensor.mouse.onDown(); };
		const up = () => { markActivity(); sensor.mouse.onUp(); };
		const wheel = (event: WheelEvent) => { markActivity(); sensor.scroll.onWheel(event); };
		window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('pointermove', move); window.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('wheel', wheel);
		const timer = window.setInterval(() => {
			const next = normalizeFeatures(sensor.snapshot());
			const now = Date.now();
			const elapsed = now - startedAt.current;
			const idle = Math.max(0, now - lastActivity.current);
			setVector(next);
			setMetrics(deriveMetrics(next, { activeMs: Math.max(0, elapsed - idle), idleMs: idle }));
			setBaseline(loadBaseline(userId));
			socket.current.send(next);
			const endpoint = import.meta.env.VITE_USE_AWS === 'true' ? import.meta.env.VITE_API_GATEWAY_ENDPOINT || '' : '';
			if (endpoint) {
				const current = scoreRef.current;
				awsQueue.current.push({ user_id: userId, timestamp: new Date().toISOString(), trust_score: current.trust_score, tier: current.tier, bot_probability: current.bot_probability, vector: next });
				if (awsQueue.current.length >= 5) { const batch = awsQueue.current.splice(0, 5); sendAwsBatch(endpoint, batch).catch(() => awsQueue.current.unshift(...batch)); }
			}
		}, 1500);
		return () => { clean(); window.clearInterval(timer); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('wheel', wheel); };
	}, [userId, enabled]);

	return { score, vector, metrics, baseline, connection };
}
