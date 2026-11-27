import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Heightfield} from '../terrain.mjs';
import {Skier,FIXED_STEP} from '../physics.mjs';
import {actionForKey,readMovement} from '../input.mjs';
const data=new URL('../data/featured/',import.meta.url);
test('the reference action keys keep pause, retry, replay and camera separate',()=>{
  const expected={Escape:'pause',Backspace:'retry',KeyR:'dropIn',KeyP:'replay',KeyC:'camera',KeyV:'wide',KeyT:'cameraTuner',KeyM:'map',KeyN:'map',KeyE:'boost',KeyB:'boost',ShiftLeft:'grab',KeyJ:'grab',KeyK:'grab',KeyL:'lift',KeyX:'lieDown'};
  for(const [key,action] of Object.entries(expected))assert.equal(actionForKey(key),action,key);
  const a=readMovement(new Set(['ArrowLeft','ArrowUp','Space','ShiftLeft'])),b=readMovement(new Set(['KeyA','KeyW','Space','KeyJ']));assert.deepEqual(a,b);
  assert.equal(a.steer,-1);assert.equal(a.tuck,true);assert.equal(a.jump,true);assert.equal(a.grab,true);
});
test('all four resorts have complete, distinct, bounded real terrain and descent data',async()=>{
  const catalog=JSON.parse(await readFile(new URL('catalog.json',data),'utf8'));
  assert.deepEqual(catalog.resorts.map(r=>r.slug),['romme-alpin','are','trysil','thredbo-resort']);
  const expected={'romme-alpin':52,are:200,trysil:167,'thredbo-resort':96};
  for(const resort of catalog.resorts){
    const folder=new URL(resort.path+'/',data),meta=JSON.parse(await readFile(new URL('metadata.json',folder),'utf8'));
    const h=await readFile(new URL('height.f32',folder)),d=await readFile(new URL('piste-distance.u16',folder));
    assert.equal(h.length,meta.gridSize**2*4);assert.equal(d.length,meta.gridSize**2*2);assert.equal(meta.runs.length,expected[resort.slug]);
    const heights=new Float32Array(h.buffer.slice(h.byteOffset,h.byteOffset+h.length)),distances=new Uint16Array(d.buffer.slice(d.byteOffset,d.byteOffset+d.length));
    let min=Infinity,max=-Infinity;for(const x of heights){assert.ok(Number.isFinite(x));min=Math.min(min,x);max=Math.max(max,x);}assert.ok(max-min>200);assert.ok(Math.abs(min-meta.heightRange[0])<.03);assert.ok(Math.abs(max-meta.heightRange[1])<.03);
    const terrain=new Heightfield(meta,heights,distances);
    const ids=new Set();for(const r of meta.runs){assert.ok(!ids.has(r.id));ids.add(r.id);assert.ok(r.points.length>1);for(const p of r.points){assert.ok(Math.abs(p[0])<terrain.half);assert.ok(Math.abs(p[2])<terrain.half);assert.ok(Number.isFinite(terrain.height(p[0],p[2])));}}
    const candidate=meta.runs.find(r=>r.length>600&&r.drop>100);assert.ok(candidate);const [a,b]=candidate.points,s=new Skier(terrain);s.reset(a[0],a[2],Math.atan2(b[0]-a[0],b[2]-a[2]));for(let i=0;i<360;i++)s.step(FIXED_STEP,{});assert.ok(s.distance>2);assert.ok(Number.isFinite(s.speed));
  }
});
test('boost adds speed using one charge, and fresh airborne flips and grabs work',()=>{
  const ramp={half:2500,height:(x,z)=>400-.2*z,gradient:()=>[0,-.2],pisteDistance:()=>0};
  const normal=new Skier(ramp),boost=new Skier(ramp);normal.reset(0,0,0);boost.reset(0,0,0);
  boost.step(FIXED_STEP,{boostPressed:true});normal.step(FIXED_STEP,{});
  for(let i=0;i<180;i++){normal.step(FIXED_STEP,{});boost.step(FIXED_STEP,{});}
  assert.ok(boost.speed>normal.speed+2);assert.ok(boost.boostCharges>2&&boost.boostCharges<2.3);
  const jump=new Skier(ramp);jump.reset(0,0,0);for(let i=0;i<60;i++)jump.step(FIXED_STEP,{jump:true,flipPressed:1});assert.equal(jump.flip,0);
  jump.step(FIXED_STEP,{jump:false});assert.equal(jump.grounded,false);jump.step(FIXED_STEP,{flipPressed:1,grab:true,steer:1});assert.ok(jump.flip>0);assert.equal(jump.grab,'Indy');
});
