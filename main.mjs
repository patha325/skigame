import {MountainView} from './world.mjs';
import {Heightfield} from './terrain.mjs';
import {Skier,FIXED_STEP} from './physics.mjs';
import {ACTION_KEYS,actionForKey,readMovement} from './input.mjs';
import {loadNordicRide} from './resorts.mjs';
import {NordicPicker} from './nordic-picker.mjs';

const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const colours={novice:'#45a879',easy:'#478bbb',intermediate:'#c75c6b',advanced:'#3d4558',expert:'#292d3d',unknown:'#8590a5'};
const timeText=t=>`${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,'0')}`;
const flag={SE:'🇸🇪',NO:'🇳🇴',AU:'🇦🇺'};
const embeddedNode=$('embedded-data'),embedded=embeddedNode?JSON.parse(embeddedNode.textContent):null;
const cache=new Map(),keys=new Set(),touch={steer:0};
let catalog,profile,meta,terrain,skier,view,run,runIndex=0,routeCum=[],gates=[],nextGate=0;
let state='loading',gear='ski',timed=true,started=false,changedSelection=false;
let accumulator=0,lastFrame=0,lastHud=0,lastMap=0,toastUntil=0,loadingSerial=0;
let pendingBoost=false,pendingFlip=0,cameraMode='chase',lyingDown=false,modalState=null,relief;
let history=[],historyAt=0,replay=null,lift=null,nordicPicker;
function setState(value){state=value;document.body.dataset.state=value;}
function tell(text,seconds=2.8){$('toast').textContent=text;$('toast').classList.remove('hidden');toastUntil=performance.now()+seconds*1000;}
function storageGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function storageSet(key,value){try{localStorage.setItem(key,String(value));}catch{}}
function bestKey(){return `local-ride:v2:${profile?.slug}:${gear}:${run?.id}`;}
function bestTime(){return Number(storageGet(bestKey()))||(profile?.slug==='romme-alpin'?Number(storageGet(`romme-local:v1:${gear}:${run?.id}`)):0)||Number(storageGet(`nordic-line-best-${profile?.nordicId}-${run?.id}-${gear==='ski'?'skis':gear}`))||0;}
function updateBest(){const best=bestTime();$('best').textContent=best?timeText(best):'local best';$('personal-best').textContent=best?`Your local best · ${timeText(best)}`:'Your times stay on this device.';}
function chooseGear(value){gear=value;for(const id of ['ski','snowboard']){$(id).classList.toggle('selected',id===gear);$(id).setAttribute('aria-pressed',String(id===gear));}if(skier)skier.mode=gear;view?.setGear(gear);updateBest();}
function chooseMode(value){timed=value;for(const id of ['timed','freeride']){$(id).classList.toggle('selected',value===(id==='timed'));$(id).setAttribute('aria-pressed',String(value===(id==='timed')));}$('clock-pill').classList.toggle('hidden',!timed);}
async function jsonFile(path){const r=await fetch('./data/'+path);if(!r.ok)throw Error('Missing bundled file: '+path);return r.json();}
function decode64(text){return Uint8Array.from(atob(text),c=>c.charCodeAt(0)).buffer;}
async function getResort(slug){
  if(cache.has(slug))return cache.get(slug);const p=catalog.resorts.find(p=>p.slug===slug);let metadata,h,d;
  if(p.nordicRecord){const result=await loadNordicRide(p.nordicRecord,t=>$('loading-copy').textContent=t);cache.set(slug,result);return result;}
  if(embedded){const r=embedded.resorts[slug];if(!r)throw Error('Resort was not embedded: '+slug);metadata=r.metadata;h=decode64(r.height);d=decode64(r.distance);}
  else {const root=p.path+'/';const rows=await Promise.all([jsonFile(root+'metadata.json'),fetch('./data/'+root+'height.f32').then(r=>{if(!r.ok)throw Error('Missing terrain');return r.arrayBuffer();}),fetch('./data/'+root+'piste-distance.u16').then(r=>{if(!r.ok)throw Error('Missing piste map');return r.arrayBuffer();})]);[metadata,h,d]=rows;}
  const result={profile:p,meta:metadata,terrain:new Heightfield(metadata,new Float32Array(h),new Uint16Array(d))};cache.set(slug,result);return result;
}
function preferredRun(){
  let i=meta.runs.findIndex(r=>r.name.toLocaleLowerCase()===(profile.defaultName||'').toLocaleLowerCase()&&r.length>300);
  if(i<0){const candidates=meta.runs.map((r,i)=>({r,i})).filter(({r})=>r.length>550&&r.drop>65&&['easy','intermediate','novice'].includes(r.difficulty));candidates.sort((a,b)=>(b.r.length+Math.min(b.r.drop,200))-(a.r.length+Math.min(a.r.drop,200)));i=candidates[0]?.i??0;}return i;
}
async function changeResort(slug,selectedId){
  const serial=++loadingSerial;keys.clear();setState('loading');$('loading').classList.remove('hidden');$('loading-title').textContent='Preparing '+catalog.resorts.find(p=>p.slug===slug).name;$('resort').disabled=true;
  try{const loaded=await getResort(slug);if(serial!==loadingSerial)return;
    ({profile,meta,terrain}=loaded);await new Promise(requestAnimationFrame);view.load(terrain,meta,profile);skier=new Skier(terrain,gear);
    $('route').replaceChildren();meta.runs.forEach((r,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${r.name}${r.ref?' · '+r.ref:''} · ${r.length} m`;$('route').append(o);});
    $('resort').value=slug;$('setup-title').textContent='Ride '+profile.name;$('resort-region').textContent=profile.region+' · '+profile.country;$('resort-count').textContent=meta.runs.length+' mapped descents';$('map-title').textContent=profile.name;
    const selectedIndex=selectedId?meta.runs.findIndex(r=>r.id===selectedId||r.id.startsWith(selectedId+'-')):-1;
    buildRelief();selectRun(selectedIndex>=0?selectedIndex:preferredRun());view.setGear(gear);storageSet('local-ride:last-resort',slug);changedSelection=true;
    $('offline-state').textContent=meta.approximate?'Estimated terrain surface':'Terrain ready';$('terrain-note').textContent=meta.approximate?'Estimated surface from mapped heights · DEM unavailable':'Real elevation · Mapterhorn';
    document.body.dataset.terrain=meta.approximate?'estimated':'measured';
    $('terrain-badge').classList.toggle('hidden',!meta.approximate);
    $('loading').classList.add('hidden');$('resort').disabled=false;$('setup').classList.remove('hidden');$('hud').classList.remove('hidden');$('pause-panel').classList.add('hidden');setState('setup');
    document.body.dataset.resort=slug;document.body.dataset.routes=String(meta.runs.length);document.body.dataset.ready='true';
  }catch(e){console.error(e);$('loading-title').textContent='The mountain could not load';$('loading-copy').textContent=e.message+' · Extract the entire download and use a WebGL 2 browser.';$('resort').disabled=false;setState('error');}
}
async function browseNordic(){
  if(embedded)return;
  openDialog('nordic-dialog');
  nordicPicker??=new NordicPicker(async(record,selectedId)=>{
    const featured={'Romme Alpin':'romme-alpin','Åre':'are','Trysil':'trysil'}[record.name];
    const slug=featured??'nordic-'+record.id;
    if(!catalog.resorts.some(p=>p.slug===slug)){
      catalog.resorts.push({slug,name:record.name,nordicRecord:record});
      const o=document.createElement('option');o.value=slug;o.textContent=record.name;$('resort').append(o);
    }
    $('nordic-dialog').close();await changeResort(slug,selectedId);
  });
  await nordicPicker.open();
}
function pointAt(distance){
  const points=run.points,last=routeCum.at(-1);distance=clamp(distance,0,last);let i=1;while(i<routeCum.length-1&&routeCum[i]<distance)i++;
  const a=points[i-1],b=points[i],f=(distance-routeCum[i-1])/Math.max(.001,routeCum[i]-routeCum[i-1]);const x=a[0]+(b[0]-a[0])*f,z=a[2]+(b[2]-a[2])*f;
  return{x,z,y:terrain.height(x,z),heading:Math.atan2(b[0]-a[0],b[2]-a[2])};
}
function selectRun(index){
  runIndex=Number(index);run=meta.runs[runIndex];$('route').value=String(runIndex);routeCum=[0];
  for(let i=1;i<run.points.length;i++)routeCum.push(routeCum.at(-1)+Math.hypot(run.points[i][0]-run.points[i-1][0],run.points[i][2]-run.points[i-1][2]));
  gates=[];for(let d=110;d<routeCum.at(-1)-40;d+=155)gates.push(pointAt(d));gates.push(pointAt(Math.max(5,routeCum.at(-1)-15)));
  $('run-name').textContent=run.name;$('run-dot').style.background=colours[run.difficulty]??colours.unknown;$('difficulty').textContent=run.difficulty;$('difficulty').style.color=colours[run.difficulty]??colours.unknown;
  $('length').textContent=run.length.toLocaleString()+' m';$('drop').textContent=run.drop+' m descent';view.setRun(run);resetSkier();updateBest();changedSelection=true;
}
function resetSkier(){const p=pointAt(7);skier.reset(p.x,p.z,p.heading);nextGate=0;accumulator=0;pendingBoost=false;pendingFlip=0;history=[];historyAt=0;replay=null;lift=null;lyingDown=false;view.cameraReady=false;view.trailN=0;view.trailClock=0;for(const t of view.trails)t.geometry.setDrawRange(0,0);updateHud();}
function startRide(){resetSkier();keys.clear();started=true;changedSelection=false;$('setup').classList.add('hidden');$('pause-panel').classList.add('hidden');$('close-setup').classList.remove('hidden');setState('riding');tell(timed?'Follow the piste markers. Esc pauses; Backspace retries.':'Freeride · L takes a nearby lift.',3);}
function openSetup(){if(replay)stopReplay();keys.clear();changedSelection=false;setState('setup');$('pause-panel').classList.add('hidden');$('setup').classList.remove('hidden');$('close-setup').classList.toggle('hidden',!started);}
function closeSetup(){if(!started||changedSelection){startRide();return;}$('setup').classList.add('hidden');keys.clear();setState('riding');}
function showPause(finished=false){
  keys.clear();$('pause-eyebrow').textContent=(finished?'FINISHED':'PAUSED')+' · '+profile.name.toLocaleUpperCase();$('pause-title').textContent=finished?'Descent complete':run.name;
  $('pause-copy').textContent=finished?`${timeText(skier.time)} · ${run.name}`:timed?'Your run is paused.':'Freeride · no clock.';$('resume').textContent=finished||skier.crashed?'Ride again':'Resume';$('pause-panel').classList.remove('hidden');
}
function pause(){if(state==='replay'){stopReplay();return;}if(state==='riding'||state==='lift'){setState('paused');showPause();}else if(state==='paused')resume();}
function resume(){if(state==='finished'||skier.crashed){startRide();return;}keys.clear();$('pause-panel').classList.add('hidden');setState(lift?'lift':'riding');}
function finish(){const best=bestTime();if(!best||skier.time<best)storageSet(bestKey(),skier.time);setState('finished');showPause(true);updateBest();}
function updateHud(){
  if(!skier)return;$('clock').textContent=timeText(skier.time);$('speed').textContent=String(Math.round(skier.speed*3.6));$('altitude').textContent=Math.round(skier.y).toLocaleString();$('boost').style.setProperty('--charge',(skier.boostCharges/3*100)+'%');
  $('clock-pill').classList.toggle('hidden',!timed||state==='lift');
  const label=state==='replay'?'REPLAY · P / Esc to return':state==='lift'?'RIDING THE LIFT':skier.grab??(!skier.grounded?'AIR':lyingDown?'SNOW REST · X to stand up':'');$('ride-tag').textContent=label;$('ride-tag').classList.toggle('hidden',!label);
  Object.assign(document.body.dataset,{state,resort:profile.slug,run:run.id,camera:cameraMode,time:skier.time.toFixed(3),x:skier.x.toFixed(2),y:skier.y.toFixed(2),z:skier.z.toFixed(2),speed:skier.speed.toFixed(3),grounded:String(skier.grounded),boost:skier.boostCharges.toFixed(3),gate:String(nextGate),gear,mode:timed?'timed':'freeride',frames:String(view.frame),drawCalls:String(view.renderer.info.render.calls),triangles:String(view.renderer.info.render.triangles)});
}
function buildRelief(){
  relief=document.createElement('canvas');relief.width=relief.height=320;const ctx=relief.getContext('2d'),image=ctx.createImageData(320,320),side=terrain.side;
  for(let j=0;j<320;j++)for(let i=0;i<320;i++){
    const x=(i/319-.5)*side,z=(j/319-.5)*side,[gx,gz]=terrain.gradient(x,z),h=terrain.height(x,z),d=terrain.pisteDistance(x,z);
    const shade=clamp((1-.72*gx-.6*gz)/Math.hypot(gx,1,gz),.36,1.25),forest=h<profile.forestLine&&d>26;const base=forest?[170,185,186]:[222,228,237],k=(j*320+i)*4;
    image.data[k]=clamp(base[0]*shade,95,247);image.data[k+1]=clamp(base[1]*shade,107,249);image.data[k+2]=clamp(base[2]*shade,124,252);image.data[k+3]=255;
  }ctx.putImageData(image,0,0);
}
function drawPaths(ctx,scale,offsetX,offsetY){
  for(const r of meta.runs){ctx.beginPath();r.points.forEach((p,i)=>{const x=offsetX+p[0]*scale,y=offsetY+p[2]*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle='#f9fbfd';ctx.lineWidth=3.2;ctx.stroke();ctx.strokeStyle=colours[r.difficulty]??colours.unknown;ctx.lineWidth=1.3;ctx.stroke();}
  ctx.beginPath();run.points.forEach((p,i)=>{const x=offsetX+p[0]*scale,y=offsetY+p[2]*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle='#fff';ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='#d97ca9';ctx.lineWidth=3.3;ctx.stroke();
}
function drawMiniMap(){
  if(!relief)return;const canvas=$('minimap'),ctx=canvas.getContext('2d'),s=canvas.width,scale=s/(2*720);
  ctx.clearRect(0,0,s,s);ctx.fillStyle='#d9e0e9';ctx.fillRect(0,0,s,s);ctx.save();ctx.translate(s/2,s/2);ctx.rotate(skier.heading-Math.PI);
  const x=-skier.x*scale,z=-skier.z*scale;ctx.drawImage(relief,x-terrain.half*scale,z-terrain.half*scale,terrain.side*scale,terrain.side*scale);drawPaths(ctx,scale,x,z);ctx.restore();
  ctx.save();ctx.translate(s/2,s/2);ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(-10,10);ctx.lineTo(0,6);ctx.lineTo(10,10);ctx.closePath();ctx.fillStyle='#d35496';ctx.strokeStyle='white';ctx.lineWidth=3;ctx.fill();ctx.stroke();ctx.restore();
  const north=document.querySelector('.north');north.style.left=(50-42*Math.sin(skier.heading))+'%';north.style.top=(50+42*Math.cos(skier.heading))+'%';north.style.transform='translate(-50%,-50%)';
}
function drawBigMap(){
  const canvas=$('big-map'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,size=Math.min(w,h)-24,scale=size/terrain.side;
  ctx.fillStyle='#e5eaf0';ctx.fillRect(0,0,w,h);ctx.drawImage(relief,(w-size)/2,(h-size)/2,size,size);drawPaths(ctx,scale,w/2,h/2);
  ctx.beginPath();ctx.arc(w/2+skier.x*scale,h/2+skier.z*scale,5,0,Math.PI*2);ctx.fillStyle='#5b56a8';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#52617d';ctx.font='bold 11px sans-serif';ctx.fillText('N ↑',20,25);
}
function openDialog(id){
  keys.clear();modalState=state;if(state==='riding'||state==='lift')setState('paused');if(id==='map-dialog')drawBigMap();$(id).showModal();
}
function nearestRunFromMap(event){
  const canvas=$('big-map'),b=canvas.getBoundingClientRect(),scale=(Math.min(canvas.width,canvas.height)-24)/terrain.side;
  const x=((event.clientX-b.left)*canvas.width/b.width-canvas.width/2)/scale,z=((event.clientY-b.top)*canvas.height/b.height-canvas.height/2)/scale;let best=Infinity,index=0;
  meta.runs.forEach((r,i)=>{for(let j=1;j<r.points.length;j++){const a=r.points[j-1],b=r.points[j],dx=b[0]-a[0],dz=b[2]-a[2],f=clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1),0,1),d=Math.hypot(x-a[0]-f*dx,z-a[2]-f*dz);if(d<best){best=d;index=i;}}});
  if(best<terrain.side*.05){$('map-dialog').close();openSetup();selectRun(index);}
}
const recordedFields=['x','y','z','vx','vy','vz','heading','time','grounded','charge','spin','flip','lean','grab'];
function recordFrame(){if(skier.time-historyAt<1/30)return;historyAt=skier.time;const sample={};for(const key of recordedFields)sample[key]=skier[key];history.push(sample);if(history.length>420)history.shift();}
function startReplay(){
  if(replay){stopReplay();return;}if(history.length<20){tell('Ride a little further to record a replay.');return;}
  replay={saved:{...skier},returnState:['paused','finished'].includes(state)?state:'riding',frames:history.slice(-260),t:0,index:0};setState('replay');keys.clear();$('pause-panel').classList.add('hidden');view.cameraReady=false;
}
function stopReplay(){
  if(!replay)return;const r=replay;Object.assign(skier,r.saved);replay=null;setState(r.returnState);view.cameraReady=false;if(state==='paused'||state==='finished')showPause(state==='finished');
}
function advanceReplay(dt){
  replay.t+=dt*.85;const frames=replay.frames,target=frames[0].time+replay.t;
  while(replay.index<frames.length-2&&frames[replay.index+1].time<target)replay.index++;
  if(target>=frames.at(-1).time){stopReplay();return;}
  const a=frames[replay.index],b=frames[replay.index+1],f=clamp((target-a.time)/(b.time-a.time),0,1);
  for(const key of recordedFields)skier[key]=typeof a[key]==='number'&&typeof b[key]==='number'?a[key]+(b[key]-a[key])*f:a[key];
}
function takeLift(){
  if(state==='lift'){lift=null;setState('riding');return;}if(state!=='riding')return;
  let nearest=null,distance=Infinity;
  for(const l of meta.lifts){const a=l.points[0],b=l.points.at(-1),base=a[1]<b[1]?a:b,d=Math.hypot(skier.x-base[0],skier.z-base[2]);if(d<distance){distance=d;nearest={...l,points:a[1]<b[1]?l.points:[...l.points].reverse()};}}
  if(!nearest||distance>220){tell(nearest?`The nearest lift base is ${Math.round(distance)} m away.`:'No lift is mapped here.');return;}
  const points=nearest.points,cum=[0];for(let i=1;i<points.length;i++)cum.push(cum.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
  lift={points,cum,distance:0,name:nearest.name};chooseMode(false);setState('lift');keys.clear();tell('Boarding '+nearest.name+'. L steps off.');
}
function advanceLift(dt){
  lift.distance+=dt*7;let i=1;while(i<lift.cum.length-1&&lift.cum[i]<lift.distance)i++;
  const a=lift.points[i-1],b=lift.points[i],f=clamp((lift.distance-lift.cum[i-1])/Math.max(.001,lift.cum[i]-lift.cum[i-1]),0,1);
  skier.x=a[0]+(b[0]-a[0])*f;skier.z=a[2]+(b[2]-a[2])*f;skier.y=terrain.height(skier.x,skier.z)+7.8;skier.heading=Math.atan2(b[0]-a[0],b[2]-a[2]);skier.vx=skier.vy=skier.vz=0;skier.grounded=false;
  if(lift.distance>=lift.cum.at(-1)){const x=skier.x,z=skier.z,[gx,gz]=terrain.gradient(x,z);lift=null;skier.reset(x,z,Math.atan2(-gx,-gz));setState('riding');tell('At the top · enjoy the mountain.');}
}
function cycleCamera(){const modes=['chase','first','side'];cameraMode=modes[(modes.indexOf(cameraMode)+1)%modes.length];view.cameraReady=false;tell(cameraMode==='first'?'Rider view':cameraMode==='side'?'Side camera':'Chase camera');}
function handleAction(action){
  if(action==='pause'){pause();return;}
  if(action==='retry'||action==='dropIn'){if(started&&state!=='loading')startRide();return;}
  if(action==='map'){if($('map-dialog').open)$('map-dialog').close();else if(skier)openDialog('map-dialog');return;}
  if(action==='replay'){if(started&&['riding','paused','finished','replay'].includes(state))startReplay();return;}
  if(action==='camera'){cycleCamera();return;}
  if(action==='wide'){view.wide=!view.wide;tell(view.wide?'Wide lens':'Standard lens');return;}
  if(action==='cameraTuner'){openDialog('camera-dialog');return;}
  if(action==='lift'){takeLift();return;}
  if(action==='lieDown'&&state==='riding'){
    if(terrain.pisteDistance(skier.x,skier.z)<24&&!lyingDown){tell('Leave the piste to rest in the snow.');return;}
    lyingDown=!lyingDown;skier.vx=skier.vy=skier.vz=0;return;
  }
  if(action==='boost'&&state==='riding')pendingBoost=true;
}
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min(.07,Math.max(0,(now-lastFrame)/1000||0));lastFrame=now;
  if(!skier||!view||state==='loading'||state==='error')return;
  const input=readMovement(keys,touch);
  if(state==='riding'&&!lyingDown){
    accumulator+=dt;
    while(accumulator>=FIXED_STEP){skier.step(FIXED_STEP,{...input,boostPressed:pendingBoost,flipPressed:pendingFlip});pendingBoost=false;pendingFlip=0;accumulator-=FIXED_STEP;}
    recordFrame();const gate=gates[nextGate];if(timed&&gate&&Math.hypot(skier.x-gate.x,skier.z-gate.z)<65){nextGate++;if(nextGate===gates.length)finish();}
    if(skier.crashed){setState('paused');showPause();$('pause-title').textContent='A hard landing';$('pause-copy').textContent='Retry to drop back in.';}
  }else if(state==='replay')advanceReplay(dt);else if(state==='lift')advanceLift(dt);
  view.update(dt,skier,input,{camera:cameraMode,lieDown:lyingDown,recordTrail:state==='riding'&&!lyingDown});
  if(now-lastHud>100){updateHud();lastHud=now;}if(now-lastMap>220){drawMiniMap();lastMap=now;}
  if(now>toastUntil)$('toast').classList.add('hidden');
}
function bindControls(){
  $('resort').addEventListener('change',()=>changeResort($('resort').value));$('route').addEventListener('change',()=>selectRun($('route').value));
  $('start').addEventListener('click',startRide);$('close-setup').addEventListener('click',closeSetup);
  $('browse-nordic').addEventListener('click',browseNordic);
  $('snowboard').addEventListener('click',()=>chooseGear('snowboard'));$('ski').addEventListener('click',()=>chooseGear('ski'));
  $('timed').addEventListener('click',()=>chooseMode(true));$('freeride').addEventListener('click',()=>chooseMode(false));
  $('pause').addEventListener('click',pause);$('close-pause').addEventListener('click',resume);$('resume').addEventListener('click',resume);
  $('retry').addEventListener('click',startRide);$('ride-again').addEventListener('click',startRide);$('pick-run').addEventListener('click',openSetup);$('change-run').addEventListener('click',openSetup);
  $('watch-replay').addEventListener('click',startReplay);$('free-here').addEventListener('click',()=>{chooseMode(false);resume();tell('Freeride · every mapped slope is open.');});
  $('boost').addEventListener('click',()=>handleAction('boost'));$('open-map').addEventListener('click',()=>openDialog('map-dialog'));
  $('settings-button').addEventListener('click',()=>$('settings-panel').classList.toggle('hidden'));
  $('world-mood').addEventListener('change',()=>view.setWorldMood($('world-mood').value));$('quality').addEventListener('change',()=>view.setQuality($('quality').value));
  $('help-button').addEventListener('click',()=>openDialog('help-dialog'));$('credits-button').addEventListener('click',()=>openDialog('credits-dialog'));
  $('camera-settings').addEventListener('click',()=>openDialog('camera-dialog'));$('camera-cycle').addEventListener('click',cycleCamera);$('wide-toggle').addEventListener('click',()=>{view.wide=!view.wide;});
  $('camera-distance').addEventListener('input',()=>{view.cameraDistance=Number($('camera-distance').value);});$('camera-height').addEventListener('input',()=>{view.cameraHeight=Number($('camera-height').value);});
  $('map-pick').addEventListener('click',()=>{$('map-dialog').close();openSetup();});$('big-map').addEventListener('click',nearestRunFromMap);
  for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$(button.dataset.close).close());
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{if(state==='paused'&&modalState==='riding')setState('riding');else if(state==='paused'&&modalState==='lift')setState('lift');modalState=null;keys.clear();});
  window.addEventListener('keydown',e=>{
    const editing=['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
    if(editing)return;
    if(document.querySelector('dialog[open]')){if(e.code==='KeyM'||e.code==='KeyN'){$('map-dialog').open&&$('map-dialog').close();e.preventDefault();}return;}
    const action=actionForKey(e.code);
    if(action||e.code==='Enter')e.preventDefault();keys.add(e.code);
    if(e.repeat)return;
    if(e.code==='Enter'){if(state==='setup')startRide();else if(state==='finished')startRide();return;}
    if(e.code==='KeyN'&&state==='finished'){selectRun((runIndex+1)%meta.runs.length);startRide();return;}
    if((action==='tuck'||action==='brake')&&state==='riding'&&!skier.grounded)pendingFlip=action==='tuck'?1:-1;
    if(!['steerLeft','steerRight','tuck','brake','jump','grab'].includes(action))handleAction(action);
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();if(state==='riding'||state==='lift')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='riding'||state==='lift'))pause();});
  window.addEventListener('resize',()=>view?.resize());
  for(const [id,key] of [['touch-jump','jump'],['touch-grab','grab']]){
    $(id).addEventListener('pointerdown',e=>{e.preventDefault();$(id).setPointerCapture(e.pointerId);touch[key]=true;});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])$(id).addEventListener(event,()=>{touch[key]=false;});
  }
  $('touch-boost').addEventListener('pointerdown',e=>{e.preventDefault();pendingBoost=true;});
  const joystick=$('joystick');const moveStick=e=>{const b=joystick.getBoundingClientRect(),x=clamp((e.clientX-b.left-b.width/2)/42,-1,1),y=clamp((e.clientY-b.top-b.height/2)/42,-1,1);touch.steer=x;touch.tuck=y<-.4;touch.brake=y>.4;$('stick').style.transform=`translate(${x*28}px,${y*28}px)`;};
  joystick.addEventListener('pointerdown',e=>{joystick.setPointerCapture(e.pointerId);moveStick(e);});joystick.addEventListener('pointermove',e=>{if(joystick.hasPointerCapture(e.pointerId))moveStick(e);});
  for(const event of ['pointerup','pointercancel'])joystick.addEventListener(event,()=>{touch.steer=0;touch.tuck=touch.brake=false;$('stick').style.transform='none';});
  const rows=[['Steer / spin','← → or A D'],['Tuck / fresh front flip','↑ or W'],['Brake / fresh back flip','↓ or S'],['Jump · hold, release','Space'],['Grab','Shift or J K'],['Boost','E or B'],['Drop-in / retry','R / Backspace'],['Nearest lift base','L'],['Rest off piste','X'],['Big map','M or N'],['Instant replay','P'],['Camera / wide lens','C / V'],['Camera settings','T'],['Pause / resume','Esc']];
  for(const [name,key] of rows){const tr=document.createElement('tr'),a=document.createElement('td'),b=document.createElement('td');a.textContent=name;b.textContent=key;tr.append(a,b);$('key-table').append(tr);}
}
async function init(){
  try{catalog=embedded?.catalog??await jsonFile('featured/catalog.json');
    if(!embedded)catalog.resorts=catalog.resorts.map(p=>({...p,path:'featured/'+p.path}));
    $('browse-nordic').classList.toggle('hidden',!!embedded);
    view=new MountainView($('world'));bindControls();
    for(const p of catalog.resorts){const option=document.createElement('option');option.value=p.slug;option.textContent=(flag[p.country]??'')+' '+p.name;$('resort').append(option);}
    const stored=storageGet('local-ride:last-resort'),slug=catalog.resorts.some(r=>r.slug===stored)?stored:'romme-alpin';
    requestAnimationFrame(frame);await changeResort(slug);chooseGear(gear);chooseMode(timed);
  }catch(e){console.error(e);setState('error');$('loading-title').textContent='The 3D view could not start';$('loading-copy').textContent=e.message+' · A browser with WebGL 2 is required.';}
}
init();
