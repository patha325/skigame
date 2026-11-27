import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Heightfield} from '../terrain.mjs';
import {Skier,FIXED_STEP} from '../physics.mjs';
const ramp={half:2500,height:(x,z)=>400-.2*z,gradient:()=>[0,-.2],pisteDistance:()=>0};
const simulate=(skier,seconds,input)=>{for(let i=0;i<Math.round(seconds/FIXED_STEP);i++)skier.step(FIXED_STEP,input);return skier;};
test('gravity accelerates a skier downhill while braking reduces speed',()=>{
  const free=new Skier(ramp),braking=new Skier(ramp);free.reset(0,0,0);braking.reset(0,0,0);
  simulate(free,6,{});simulate(braking,6,{brake:true});
  assert.ok(free.z>30);assert.ok(free.speed>8);assert.ok(braking.speed<free.speed*.3);
  assert.equal(free.y,ramp.height(free.x,free.z));
});
test('left and right steering produce opposite lateral trajectories',()=>{
  const left=new Skier(ramp),right=new Skier(ramp);left.reset(0,0,0);right.reset(0,0,0);
  simulate(left,1,{steer:-1});simulate(right,1,{steer:1});
  assert.ok(left.x>0);assert.ok(right.x<0);assert.ok(Math.abs(left.x+right.x)<1e-9);
});
test('a charged jump leaves the terrain and returns to it',()=>{
  const skier=new Skier(ramp);skier.reset(0,0,0);simulate(skier,.5,{jump:true});simulate(skier,.15,{jump:false});
  assert.equal(skier.grounded,false);assert.ok(skier.y>ramp.height(skier.x,skier.z)+.5);
  simulate(skier,3,{});assert.equal(skier.grounded,true);assert.equal(skier.crashed,false);
});
test('fixed-step simulation is repeatable and remains finite during long motion',()=>{
  const a=new Skier(ramp),b=new Skier(ramp);a.reset(0,0,0);b.reset(0,0,0);
  simulate(a,120,{tuck:true});simulate(b,120,{tuck:true});
  assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.ok(Number.isFinite(a.speed));
  assert.ok(Math.abs(a.z)<=ramp.half-20);assert.ok(a.speed<=45.1);
});
test('the bundled Romme field is complete and selected routes descend on actual data',async()=>{
  const folder=new URL('../data/featured/resorts/romme-alpin/',import.meta.url),meta=JSON.parse(await readFile(new URL('metadata.json',folder),'utf8'));
  const h=await readFile(new URL('height.f32',folder)),d=await readFile(new URL('piste-distance.u16',folder));
  const terrain=new Heightfield(meta,new Float32Array(h.buffer.slice(h.byteOffset,h.byteOffset+h.length)),new Uint16Array(d.buffer.slice(d.byteOffset,d.byteOffset+d.length)));
  assert.equal(meta.runs.length,52);assert.equal(meta.lifts.length,17);
  assert.ok(terrain.height(0,0)>130&&terrain.height(0,0)<410);
  const route=meta.runs.find(r=>r.name==='Bumerangen'&&r.length>700);assert.ok(route.drop>150);
  const a=route.points[0],b=route.points[1],skier=new Skier(terrain);skier.reset(a[0],a[2],Math.atan2(b[0]-a[0],b[2]-a[2]));
  simulate(skier,5,{});assert.ok(skier.distance>15);assert.ok(Number.isFinite(skier.y));assert.ok(skier.y<a[1]+1);
});
