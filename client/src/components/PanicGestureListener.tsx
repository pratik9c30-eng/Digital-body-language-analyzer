import { useEffect } from 'react';

const PANIC_DEBUG = true;
const SAMPLE_INTERVAL_MS = 50;
const WINDOW_MS = 1200;
const DISTANCE_THRESHOLD = 0.7;

export function PanicGestureListener({onLock}:{onLock:()=>void}){useEffect(()=>{let points:{x:number;y:number;t:number}[]=[];let dragging=false;let lastSample=0;const down=(e:PointerEvent)=>{if(e.button===0)dragging=true;points=[]};const up=(e:PointerEvent)=>{if(e.button===0)dragging=false;points=[]};const move=(e:PointerEvent)=>{const now=Date.now();if(dragging||now-lastSample<SAMPLE_INTERVAL_MS)return;lastSample=now;points.push({x:e.clientX,y:e.clientY,t:now});points=points.filter(p=>now-p.t<WINDOW_MS);if(points.length>2){const a=points[0],b=points[points.length-1],distance=Math.hypot(b.x-a.x,b.y-a.y),threshold=Math.min(innerWidth,innerHeight)*DISTANCE_THRESHOLD;if(distance>threshold){if(PANIC_DEBUG)console.log('[DBLA] verification trigger', {metric:'rapid_free_pointer_distance',value:Math.round(distance),threshold:Math.round(threshold),windowMs:WINDOW_MS});onLock();points=[];}}};window.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('pointermove',move);return()=>{window.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('pointermove',move)}},[onLock]);return null}
