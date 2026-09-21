export function PassiveChallenge({active}:{active:boolean}){return active?<div className="passive"><span className="pulse-dot"/> Passive checkpoint in progress <kbd>press any key</kbd></div>:null}
