// Defaults follow Bonvo's published keyboard guide, inspected 27 Nov 2026.
export const ACTION_KEYS=Object.freeze({
  steerLeft:['ArrowLeft','KeyA'],steerRight:['ArrowRight','KeyD'],
  tuck:['ArrowUp','KeyW'],brake:['ArrowDown','KeyS'],jump:['Space'],
  grab:['ShiftLeft','ShiftRight','KeyJ','KeyK'],boost:['KeyE','KeyB'],
  pause:['Escape'],retry:['Backspace'],dropIn:['KeyR'],map:['KeyM','KeyN'],
  replay:['KeyP'],camera:['KeyC'],wide:['KeyV'],cameraTuner:['KeyT'],lift:['KeyL'],lieDown:['KeyX']
});
export const actionForKey=code=>Object.keys(ACTION_KEYS).find(action=>ACTION_KEYS[action].includes(code))??null;
export const isDown=(keys,action)=>ACTION_KEYS[action]?.some(code=>keys.has(code))??false;
export function readMovement(keys,touch={}){
  return {steer:Math.max(-1,Math.min(1,(isDown(keys,'steerRight')?1:0)-(isDown(keys,'steerLeft')?1:0)+(touch.steer??0))),
    tuck:isDown(keys,'tuck')||!!touch.tuck,brake:isDown(keys,'brake')||!!touch.brake,
    jump:isDown(keys,'jump')||!!touch.jump,grab:isDown(keys,'grab')||!!touch.grab};
}
