export class ScrollCapture { private last=0; private lastTime=0; private speeds:number[]=[]; private reversals=0;
  onWheel(e: WheelEvent){const now=performance.now(); if(this.last && Math.sign(e.deltaY)!==Math.sign(this.last))this.reversals++; if(this.lastTime)this.speeds.push(Math.abs(e.deltaY)/Math.max(1,now-this.lastTime)); this.last=e.deltaY;this.lastTime=now;}
  snapshot(){return {scroll_speed:Math.min(1,(this.speeds.reduce((a,b)=>a+b,0)/Math.max(1,this.speeds.length))/10),scroll_reversals:Math.min(1,this.reversals/10)};}
}
