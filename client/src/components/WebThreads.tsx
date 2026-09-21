import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import './WebThreads.css';

type FanMode = 'center' | 'left' | 'right';

export interface WebThreadsProps {
  color1?: string;
  color2?: string;
  color3?: string;
  speed?: number;
  threadCount?: number;
  frequency?: number;
  spread?: number;
  taper?: number;
  position?: number;
  fanMode?: FanMode;
  glow?: number;
  falloff?: number;
  thickness?: number;
  brightness?: number;
  opacity?: number;
  mirror?: boolean;
  shimmer?: boolean;
  grain?: boolean;
  grainIntensity?: number;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  backgroundColor?: string;
  lightMode?: boolean;
  className?: string;
}

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime, uSpeed, uThreadCount, uFrequency, uSpread, uTaper, uPosition, uFanMode, uGlow, uFalloff, uThickness, uBrightness, uOpacity, uMirror, uShimmer, uGrain, uGrainIntensity;
uniform vec3 uColor1, uColor2, uColor3;
uniform vec2 uMouse;
uniform float uMouseStrength, uEnableMouse, uMouseActive;
out vec4 fragColor;
#define TAU 6.28318530718
#define MAX_THREADS 10
float glow(float x, float str, float dist) { return dist / pow(max(x, 1e-4), str); }
void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float n = max(uThreadCount, 1.0);
  float pinchX = uFanMode < 0.5 ? 0.5 : (uFanMode < 1.5 ? 0.0 : 1.0);
  if (uEnableMouse > 0.5) pinchX = mix(pinchX, uMouse.x, clamp(uMouseStrength, 0.0, 1.0) * uMouseActive);
  float spreadDx = uSpread * abs(uv.x - pinchX);
  float baseT = iTime * uSpeed;
  float tauOverN = TAU / n;
  float mirror = uMirror > 0.5 ? sign(pinchX - uv.x) : 1.0;
  float invThickness = 1.0 / max(uThickness, 0.01);
  float ciScale = n > 1.0 ? 1.0 / (n - 1.0) : 0.0;
  vec3 col = vec3(0.0);
  float gsum = 0.0;
  for (int idx = 0; idx < MAX_THREADS; idx++) {
    float i = float(idx);
    if (i >= n) break;
    float amplitude = spreadDx * (1.0 + i * uTaper);
    float shimmer = uShimmer > 0.5 ? sin(iTime * 1.7 + i * 1.3) * 0.35 : 0.0;
    float phase = (baseT + i * tauOverN) * mirror + shimmer;
    float sdf = abs((uv.y - uPosition) + sin(uv.x * uFrequency + phase) * amplitude) * invThickness;
    float g = glow(sdf, uFalloff, uGlow);
    vec3 threadCol = mix(uColor1, uColor2, i * ciScale);
    col += g * threadCol;
    gsum += g;
  }
  float coreAmt = smoothstep(0.5, 2.2, gsum);
  col = mix(col, uColor3 * gsum, coreAmt * 0.5);
  float bright = uBrightness;
  if (uEnableMouse > 0.5) bright += clamp(uMouseStrength, 0.0, 1.0) * uMouseActive * exp(-dot(uv - uMouse, uv - uMouse) * 6.0) * 0.6;
  col *= bright;
  float alpha = clamp(gsum, 0.0, 1.0) * uOpacity;
  vec3 outRgb = col * alpha;
  if (uGrain > 0.5) {
    float gv = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453) - 0.5) * uGrainIntensity;
    outRgb = clamp(outRgb + gv, 0.0, 1.0);
    alpha = clamp(alpha + gv, 0.0, 1.0);
  }
  fragColor = vec4(outRgb, alpha);
}`;

const fanModes: Record<FanMode, number> = { center: 0, left: 1, right: 2 };
const hexToRgb = (hex: string) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match ? [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255] : [1, 1, 1];
};

export default function WebThreads({
  color1 = '#80D0B2', color2 = '#F4B860', color3 = '#FFFFFF', speed = 0.2,
  threadCount = 6, frequency = 5, spread = 0.18, taper = 1, position = 0.5,
  fanMode = 'center', glow = 0.02, falloff = 0.6, thickness = 1.1, brightness = 0.6,
  opacity = 1, mirror = true, shimmer = false, grain = true, grainIntensity = 0.05,
  mouseInteraction = true, mouseStrength = 0.3, className = ''
}: WebThreadsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ enabled: mouseInteraction, strength: mouseStrength });
  const settingsRef = useRef({ color1, color2, color3, speed, threadCount, frequency, spread, taper, position, fanMode, glow, falloff, thickness, brightness, opacity, mirror, shimmer, grain, grainIntensity });

  settingsRef.current = { color1, color2, color3, speed, threadCount, frequency, spread, taper, position, fanMode, glow, falloff, thickness, brightness, opacity, mirror, shimmer, grain, grainIntensity };
  mouseRef.current = { enabled: mouseInteraction, strength: mouseStrength };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new Renderer({ webgl: 2, alpha: true, premultipliedAlpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    container.appendChild(canvas);
    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex, fragment, uniforms: {
      iTime: { value: 0 }, iResolution: { value: new Float32Array([1, 1]) }, uSpeed: { value: speed }, uThreadCount: { value: threadCount }, uFrequency: { value: frequency }, uSpread: { value: spread }, uTaper: { value: taper }, uPosition: { value: position }, uFanMode: { value: 0 }, uGlow: { value: glow }, uFalloff: { value: falloff }, uThickness: { value: thickness }, uBrightness: { value: brightness }, uOpacity: { value: opacity }, uMirror: { value: mirror ? 1 : 0 }, uShimmer: { value: shimmer ? 1 : 0 }, uGrain: { value: grain ? 1 : 0 }, uGrainIntensity: { value: grainIntensity }, uColor1: { value: new Float32Array([1, 1, 1]) }, uColor2: { value: new Float32Array([1, 1, 1]) }, uColor3: { value: new Float32Array([1, 1, 1]) }, uMouse: { value: new Float32Array([0.5, 0.5]) }, uMouseStrength: { value: mouseStrength }, uEnableMouse: { value: mouseInteraction ? 1 : 0 }, uMouseActive: { value: 0 }
    } });
    const mesh = new Mesh(gl, { geometry, program });
    const resize = () => { const rect = container.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height)); const resolution = program.uniforms.iResolution.value as Float32Array; resolution[0] = gl.drawingBufferWidth; resolution[1] = gl.drawingBufferHeight; };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const currentMouse = [0.5, 0.5];
    const targetMouse = [0.5, 0.5];
    let active = 0;
    let targetActive = 0;
    const move = (event: MouseEvent) => { const rect = canvas.getBoundingClientRect(); targetMouse[0] = (event.clientX - rect.left) / rect.width; targetMouse[1] = 1 - (event.clientY - rect.top) / rect.height; targetActive = 1; };
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseenter', () => { targetActive = 1; });
    canvas.addEventListener('mouseleave', () => { targetActive = 0; });
    let animation = 0;
    let visible = true;
    let pageVisible = !document.hidden;
    const started = performance.now();
    const render = (time: number) => {
      const settings = settingsRef.current;
      const uniforms = program.uniforms;
      uniforms.iTime.value = (time - started) * 0.001;
      uniforms.uSpeed.value = settings.speed;
      uniforms.uThreadCount.value = Math.min(10, Math.max(1, Math.round(settings.threadCount)));
      uniforms.uFrequency.value = settings.frequency; uniforms.uSpread.value = settings.spread; uniforms.uTaper.value = settings.taper; uniforms.uPosition.value = settings.position; uniforms.uFanMode.value = fanModes[settings.fanMode]; uniforms.uGlow.value = settings.glow; uniforms.uFalloff.value = settings.falloff; uniforms.uThickness.value = settings.thickness; uniforms.uBrightness.value = settings.brightness; uniforms.uOpacity.value = settings.opacity; uniforms.uMirror.value = settings.mirror ? 1 : 0; uniforms.uShimmer.value = settings.shimmer ? 1 : 0; uniforms.uGrain.value = settings.grain ? 1 : 0; uniforms.uGrainIntensity.value = settings.grainIntensity;
      [settings.color1, settings.color2, settings.color3].forEach((color, index) => { const target = uniforms[['uColor1', 'uColor2', 'uColor3'][index]].value as Float32Array; target.set(hexToRgb(color)); });
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]); currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]); active += 0.05 * (targetActive - active);
      (uniforms.uMouse.value as Float32Array).set(currentMouse); uniforms.uMouseActive.value = active; uniforms.uEnableMouse.value = mouseRef.current.enabled ? 1 : 0; uniforms.uMouseStrength.value = mouseRef.current.strength;
      renderer.render({ scene: mesh });
      animation = requestAnimationFrame(render);
    };
    const start = () => { if (visible && pageVisible && !animation) animation = requestAnimationFrame(render); };
    const stop = () => { if (animation) { cancelAnimationFrame(animation); animation = 0; } };
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); });
    intersection.observe(container);
    const visibility = () => { pageVisible = !document.hidden; pageVisible ? start() : stop(); };
    document.addEventListener('visibilitychange', visibility);
    start();
    return () => { stop(); observer.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('mousemove', move); container.removeChild(canvas); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []);

  return <div ref={containerRef} className={`web-threads-container ${className}`.trim()} aria-hidden="true" />;
}
