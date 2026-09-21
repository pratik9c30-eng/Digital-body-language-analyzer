import type { FeatureVector } from '../capture/sensorFusion';
const names=['typing_speed','dwell_mean','flight_mean','digraph_mean','typing_variance','mouse_velocity','mouse_acceleration','mouse_curvature','mouse_jitter','click_dwell','scroll_speed','scroll_reversals','touch_pressure','touch_radius','timing_entropy'];
export function normalizeFeatures(input:FeatureVector):FeatureVector{return Object.fromEntries(names.map(name=>[name,Math.max(0,Math.min(1,Number(input[name]??0.5)))]));}
