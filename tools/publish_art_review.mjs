// Publish CI-created review images to a separate evidence branch, never to the game branch.
import fs from 'node:fs/promises';
import path from 'node:path';
const repo=process.env.GITHUB_REPOSITORY,source=process.env.SOURCE_SHA,token=process.env.GITHUB_TOKEN,branch='codex/art-review-assets';
if(repo!=='patha325/skigame'||!token||!/^[a-f0-9]{40}$/.test(source??''))throw Error('Visual evidence publication requires this repository and an explicit source commit.');
async function api(method,resource,body,optional=false){
  const r=await fetch('https://api.github.com/repos/'+repo+'/'+resource,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});
  if(optional&&r.status===404)return null;
  if(!r.ok)throw Error('GitHub visual evidence request failed: '+r.status+' '+resource);
  return r.json();
}
const folder='tests/_artifacts',names=(await fs.readdir(folder)).filter(n=>/^art-[a-z-]+\.jpg$/.test(n)||n==='art-review.json');
if(!names.includes('art-review.json')){console.log('No visual report to publish.');process.exit(0);}
const ref=await api('GET','git/ref/heads/'+branch,undefined,true),parent=ref?.object?.sha??source,base=await api('GET','git/commits/'+parent);
const entries=[];
for(const name of names){const bytes=await fs.readFile(path.join(folder,name));const blob=await api('POST','git/blobs',{content:bytes.toString('base64'),encoding:'base64'});entries.push({path:'docs/art-review/'+name,mode:'100644',type:'blob',sha:blob.sha});}
const tree=await api('POST','git/trees',{base_tree:base.tree.sha,tree:entries}),commit=await api('POST','git/commits',{message:'Render visual review for '+source,tree:tree.sha,parents:[parent]});
if(ref)await api('PATCH','git/refs/heads/'+branch,{sha:commit.sha,force:false});else await api('POST','git/refs',{ref:'refs/heads/'+branch,sha:commit.sha});
console.log('Visual review images: https://github.com/'+repo+'/tree/'+branch+'/docs/art-review');
