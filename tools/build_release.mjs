#!/usr/bin/env node
// Standalone HTML and ZIP builder. Node 18+, no npm packages needed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash64=value=>createHash('sha256').update(value).digest('base64');
const memo=new Map();
async function moduleUrl(file){
  file=path.resolve(file);if(memo.has(file))return memo.get(file);
  let code=await fs.readFile(file,'utf8');const re=/(\bfrom\s*|\bimport\s*)['"](\.\.?\/[^'"\n]+\.(?:mjs|js))['"]/g;
  const matches=[...code.matchAll(re)];
  for(const m of matches){const dep=path.resolve(path.dirname(file),m[2]);if(!dep.startsWith(root+path.sep))throw Error('Module escapes source directory');const url=await moduleUrl(dep);code=code.replace(m[0],m[1]+JSON.stringify(url));}
  const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');memo.set(file,url);return url;
}
export async function buildStandalone(){
  const catalog=JSON.parse(await fs.readFile(path.join(root,'data/featured/catalog.json'),'utf8')),resorts={};
  for(const r of catalog.resorts){const base=path.join(root,'data/featured',r.path),metadata=JSON.parse(await fs.readFile(path.join(base,'metadata.json'),'utf8')),height=await fs.readFile(path.join(base,'height.f32')),distance=await fs.readFile(path.join(base,'piste-distance.u16'));
    if(height.length!==metadata.gridSize**2*4||distance.length!==metadata.gridSize**2*2)throw Error('Incomplete terrain: '+r.slug);
    resorts[r.slug]={metadata,height:height.toString('base64'),distance:distance.toString('base64')};}
  const module=await moduleUrl(path.join(root,'main.mjs'));
  const entry=`import ${JSON.stringify(module)};`,css=(await fs.readFile(path.join(root,'style.css'),'utf8'))+'\n'+(await fs.readFile(path.join(root,'nordic-map.css'),'utf8'));
  const data=JSON.stringify({catalog,resorts}).replaceAll('<','\\u003c').replaceAll('&','\\u0026');
  const csp=`default-src 'none';script-src data: 'sha256-${hash64(entry)}';style-src 'sha256-${hash64(css)}';connect-src 'none';img-src data:;object-src 'none';base-uri 'none'`;
  let html=await fs.readFile(path.join(root,'index.html'),'utf8');
  html=html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,(_,a,b)=>a+csp+b);
  html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>');
  html=html.replace('<link rel="stylesheet" href="nordic-map.css">','').replace('<link rel="stylesheet" href="vendor/leaflet.css">','').replace('<script src="vendor/leaflet.js"></script>','');
  html=html.replace('<script type="module" src="main.mjs"></script>','<script id="embedded-data" type="application/json">'+data+'</script>\n<script type="module">'+entry+'</script>');
  if(/<(script|link|img)[^>]+(?:src|href)="https?:\/\//i.test(html))throw Error('External runtime resource detected');
  const file=path.join(root,'Nordic-Line-Offline.html');await fs.writeFile(file,html,'utf8');console.log('Standalone:',file,Buffer.byteLength(html),'bytes');return file;
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(buffer){let crc=0xffffffff;for(const b of buffer)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
async function walk(dir){let result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules','__pycache__','_artifacts','dist'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await walk(p));else if(entry.isFile()&&!entry.name.endsWith('.pyc')&&!entry.name.endsWith('.zip')&&entry.name!=='Romme-Offline.html')result.push(p);}return result;}
export async function buildArchive(output){
  const files=(await walk(root)).filter(p=>path.basename(p)!=='CHECKSUMS.json').sort();const checksums={};
  for(const p of files)checksums[path.relative(root,p).split(path.sep).join('/')]=sha(await fs.readFile(p));
  const manifest=path.join(root,'CHECKSUMS.json');await fs.writeFile(manifest,JSON.stringify(checksums,null,2));files.push(manifest);
  const local=[],central=[];let offset=0;const now=new Date(),date=((now.getUTCFullYear()-1980)<<9)|((now.getUTCMonth()+1)<<5)|now.getUTCDate(),time=(now.getUTCHours()<<11)|(now.getUTCMinutes()<<5)|Math.floor(now.getUTCSeconds()/2);
  for(const p of files){const name=Buffer.from('nordic-line/'+path.relative(root,p).split(path.sep).join('/')),raw=await fs.readFile(p),z=deflateRawSync(raw,{level:9}),crc=crc32(raw),head=Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt16LE(8,8);head.writeUInt16LE(time,10);head.writeUInt16LE(date,12);head.writeUInt32LE(crc,14);head.writeUInt32LE(z.length,18);head.writeUInt32LE(raw.length,22);head.writeUInt16LE(name.length,26);local.push(head,name,z);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x0314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(time,12);c.writeUInt16LE(date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(z.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(((p.endsWith('.command')?0o100755:0o100644)<<16)>>>0,38);c.writeUInt32LE(offset,42);central.push(c,name);offset+=head.length+name.length+z.length;
  }
  const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  output=path.resolve(output??path.join(root,'..','nordic-line-0.3.0.zip'));await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,Buffer.concat([...local,cd,end]));const bytes=await fs.readFile(output);console.log(JSON.stringify({archive:output,files:files.length,bytes:bytes.length,sha256:sha(bytes)},null,2));return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){await buildStandalone();if(!process.argv.includes('--html-only'))await buildArchive(process.argv.find(a=>a.startsWith('--output='))?.slice(9));}
