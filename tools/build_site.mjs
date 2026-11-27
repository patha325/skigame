// Stage the static GitHub Pages application, including verified local libraries.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const files=['index.html','style.css','nordic-map.css','main.mjs','world.mjs','game-art.mjs','render-pipeline.mjs','physics.mjs','terrain.mjs','input.mjs','resorts.mjs','nordic-picker.mjs','map.js','core.mjs','terrain.js','LICENSE.txt','DATA-SOURCES.md','DATA-LICENSES.md','data','vendor'];
for(const a of JSON.parse(await fs.readFile(path.join(root,'vendor/manifest.json'),'utf8'))){const bytes=await fs.readFile(path.join(root,'vendor',a.path));if(createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw Error('Run python3 bootstrap.py to prepare verified libraries: '+a.path);}
await fs.mkdir(dist,{recursive:true});
for(const f of files)await fs.cp(path.join(root,f),path.join(dist,f),{recursive:true});
await fs.writeFile(path.join(dist,'.nojekyll'),'');
console.log('Static site:',dist);
