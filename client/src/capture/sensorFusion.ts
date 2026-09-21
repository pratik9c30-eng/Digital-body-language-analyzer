import { KeystrokeCapture } from './keystrokeCapture'; import { MouseCapture } from './mouseCapture'; import { ScrollCapture } from './scrollCapture'; import { TouchCapture } from './touchCapture';
export type FeatureVector = Record<string, number>;
export class SensorFusion { keys=new KeystrokeCapture(); mouse=new MouseCapture(); scroll=new ScrollCapture(); touch=new TouchCapture(); snapshot():FeatureVector{return {...this.keys.snapshot(),...this.mouse.snapshot(),...this.scroll.snapshot(),...this.touch.snapshot()};} }
