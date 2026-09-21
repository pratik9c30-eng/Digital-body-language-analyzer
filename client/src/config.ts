export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export function buildApiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}
export function buildWsUrl(path: string) {
  return buildApiUrl(path).replace(/^http/, 'ws');
}

export const CALIBRATION_MIN_QUALITY = Number(import.meta.env.VITE_CALIBRATION_MIN_QUALITY || 0.55);
