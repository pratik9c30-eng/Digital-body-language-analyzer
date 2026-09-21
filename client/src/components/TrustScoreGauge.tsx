import type { CSSProperties } from 'react';

export function TrustScoreGauge({score,tier}:{score:number;tier:string}){return <div className={`gauge ${tier}`}><div className="gauge-ring" style={{'--score':`${score*3.6}deg`} as CSSProperties}><strong>{Math.round(score)}</strong><span>TRUST</span></div><small>{tier==='silent'?'Behavior consistent':tier==='challenge'?'Verification recommended':'High-risk anomaly detected'}</small></div>}
