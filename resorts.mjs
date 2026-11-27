import {Heightfield} from './terrain.mjs';
import {makeProjection, paddedBounds, sampleGrid, prepareRoute} from './core.mjs';
import {loadTerrain} from './terrain.js';

const areaCache=new Map();
async function json(path){const r=await fetch(path);if(!r.ok)throw Error('Missing resort data: '+path);return r.json();}
export async function loadNordicCatalog(){
  const catalog=await json('data/catalog.json');
  if(catalog.resortParts)catalog.resorts=(await Promise.all(catalog.resortParts.map(p=>json('data/'+p)))).flat();
  return catalog;
}
export async function loadArea(record){
  if(!areaCache.has(record.id))areaCache.set(record.id,(async()=>{
    const area=await json('data/'+record.id+'.json');
    for(const kind of ['runs','lifts'])if(area[kind+'Parts'])area[kind]=(await Promise.all(area[kind+'Parts'].map(p=>json('data/'+p)))).flat();
    return {...area,cachedTerrain:record.cachedTerrain};
  })().catch(e=>{areaCache.delete(record.id);throw e;}));
  return areaCache.get(record.id);
}
// A two-pass distance transform keeps the imported piste corridors clear of trees.
export function pisteDistances(runs,n,side){
  const spacing=side/(n-1),half=side/2,dist=new Float32Array(n*n).fill(6553.5);
  for(const run of runs)for(let i=1;i<run.points.length;i++){
    const a=run.points[i-1],b=run.points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/spacing*2));
    for(let j=0;j<=steps;j++){
      const f=j/steps,x=Math.round((a[0]+(b[0]-a[0])*f+half)/spacing),z=Math.round((a[2]+(b[2]-a[2])*f+half)/spacing);
      if(x>=0&&x<n&&z>=0&&z<n)dist[z*n+x]=0;
    }
  }
  const diag=spacing*Math.SQRT2;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const k=z*n+x;let d=dist[k];if(x)d=Math.min(d,dist[k-1]+spacing);
    if(z){d=Math.min(d,dist[k-n]+spacing);if(x)d=Math.min(d,dist[k-n-1]+diag);if(x<n-1)d=Math.min(d,dist[k-n+1]+diag);}dist[k]=d;
  }
  for(let z=n-1;z>=0;z--)for(let x=n-1;x>=0;x--){
    const k=z*n+x;let d=dist[k];if(x<n-1)d=Math.min(d,dist[k+1]+spacing);
    if(z<n-1){d=Math.min(d,dist[k+n]+spacing);if(x)d=Math.min(d,dist[k+n-1]+diag);if(x<n-1)d=Math.min(d,dist[k+n+1]+diag);}dist[k]=d;
  }
  return Uint16Array.from(dist,d=>Math.min(65535,Math.round(d*10)));
}
export function adaptNordicArea(area,grid){
  const projection=makeProjection(grid.bounds??paddedBounds(area.bounds)),a=projection.toLocal([grid.bounds[0],grid.bounds[3]]),b=projection.toLocal([grid.bounds[2],grid.bounds[1]]);
  const side=Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.z-a.z))/100)*100,n=257,heights=new Float32Array(n*n);
  const elevation=(x,z)=>{const [lon,lat]=projection.toGeo(x,z);return sampleGrid(grid,lon,lat);};
  let min=Infinity,max=-Infinity;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const h=elevation((x/(n-1)-.5)*side,(z/(n-1)-.5)*side);heights[z*n+x]=h;min=Math.min(min,h);max=Math.max(max,h);}
  const convert=line=>{
    const route=prepareRoute(line,projection,elevation);
    const points=route.points.map(p=>[p.x,elevation(p.x,p.z),p.z]);
    return {id:line.id,name:line.name||line.ref||'Mapped slope',ref:line.ref||'',difficulty:line.difficulty||'unknown',length:Math.round(route.length),drop:Math.max(0,Math.round(points[0][1]-points.at(-1)[1])),points};
  };
  const runs=area.runs.filter(r=>r.coordinates.length>1&&r.length>=10).map(convert).filter(r=>r.length>=10);
  if(!runs.length)throw Error('This area has no mapped descent lines. Please select another resort.');
  const lifts=area.lifts.filter(l=>l.coordinates.length>1).map(convert).filter(l=>l.length>1);
  const profile={slug:'nordic-'+area.id,name:area.name,country:area.country,region:'Nordic catalogue',defaultName:'',forestLine:area.country==='IS'?0:area.country==='FI'?650:area.center[1]>66?650:1000,treeType:'spruce',routes:runs.length,nordicId:area.id};
  const meta={name:area.name,centre:[projection.lon,projection.lat],gridSize:n,side,heightRange:[min,max],runs,lifts,projection:'Local east/south metres',approximate:!!grid.approximate,source:grid.source};
  return {profile,meta,terrain:new Heightfield(meta,heights,pisteDistances(runs,n,side))};
}
export async function loadNordicRide(record,progress){const area=await loadArea(record);return adaptNordicArea(area,await loadTerrain(area,progress));}
