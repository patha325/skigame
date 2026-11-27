import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {adaptNordicArea,pisteDistances} from '../resorts.mjs';
import {Skier,FIXED_STEP} from '../physics.mjs';
const read=async name=>JSON.parse(await fs.readFile(new URL('../data/'+name,import.meta.url),'utf8'));
test('existing cached Nordic resorts drive the same free-moving physics as featured resorts',async()=>{
  const catalog=await read('catalog.json');catalog.resorts=(await Promise.all(catalog.resortParts.map(read))).flat();
  let count=0;
  for(const record of catalog.resorts.filter(r=>r.cachedTerrain)){
    const area=await read(record.id+'.json');
    for(const kind of ['runs','lifts'])if(area[kind+'Parts'])area[kind]=(await Promise.all(area[kind+'Parts'].map(read))).flat();
    const dem=await read(record.id+'.dem.json'),encoded=dem.heights??(await Promise.all(dem.heightParts.map(n=>fs.readFile(new URL('../data/'+n,import.meta.url),'utf8')))).join(''),bytes=Buffer.from(encoded,'base64');
    const {meta,terrain,profile}=adaptNordicArea({...area,...record}, {...dem,values:new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4)});
    assert.equal(meta.approximate,false);assert.equal(profile.nordicId,record.id);assert.ok(meta.runs.length>0);assert.ok(terrain.heights.every(Number.isFinite));
    for(const route of meta.runs){for(const p of route.points){assert.ok(Math.abs(p[0])<terrain.half);assert.ok(Math.abs(p[2])<terrain.half);}assert.ok(route.drop>=0);}
    const route=meta.runs.find(r=>r.drop>50&&r.length>400)||meta.runs[0],[a,b]=route.points,skier=new Skier(terrain);
    skier.reset(a[0],a[2],Math.atan2(b[0]-a[0],b[2]-a[2]));for(let i=0;i<360;i++)skier.step(FIXED_STEP,{});
    assert.ok(Number.isFinite(skier.speed));assert.ok(skier.distance>0);count++;
  }
  assert.equal(count,8);
});
test('a location-only record cannot silently become a playable mountain',()=>{
  assert.throws(()=>adaptNordicArea({id:'empty',name:'Empty',country:'SE',center:[0,0],bounds:[0,0,.01,.01],runs:[],lifts:[]},{bounds:[0,0,.01,.01],size:2,values:new Float32Array([10,20,30,40])}),/no mapped descent/);
});
test('distance raster preserves clear piste corridors and distant forest space',()=>{
  const n=101,side=1000,dist=pisteDistances([{points:[[0,100,-400],[0,0,400]]}],n,side);
  assert.equal(dist[50*n+50],0);assert.ok(Math.abs(dist[50*n+70]/10-200)<1);assert.ok(dist[0]>3000);
});
