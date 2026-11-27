// Render actual gameplay for visual review, including the previous renderer as a baseline.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright-core');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'tests/_artifacts');
await fs.mkdir(out,{recursive:true});
const baseline='a66e4ec4031bd589c0d00ef8c80baacb509c2824';
const previous=file=>execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
await fs.writeFile(path.join(root,'__art-before-world.mjs'),previous('world.mjs'));
await fs.writeFile(path.join(root,'__art-before-main.mjs'),previous('main.mjs').replace("from './world.mjs'","from './__art-before-world.mjs'"));
await fs.writeFile(path.join(root,'__art-before.html'),previous('index.html').replace('src="main.mjs"','src="__art-before-main.mjs"'));
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!p.startsWith(root+path.sep))throw Error('Invalid path');const bytes=await fs.readFile(p),ext=path.extname(p);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[ext]??'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const executable=process.env.LOCAL_RIDE_BROWSER??(process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome');
const browser=await chromium.launch({headless:true,executablePath:executable,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],external=[],records=[];let page;
try{
  for(const before of [true,false]){
    const context=await browser.newContext({viewport:{width:2048,height:780},deviceScaleFactor:1});
    await context.route('**/*',route=>{if(route.request().url().startsWith(base))return route.continue();external.push(route.request().url());return route.abort();});
    page=await context.newPage();page.setDefaultTimeout(90000);
    page.on('pageerror',e=>errors.push(e.message.slice(0,2500)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,2500));});
    console.log('Capturing '+(before?'previous renderer':'new sunset renderer'));
    await page.goto(base+(before?'/__art-before.html':'/index.html'),{waitUntil:'load'});
    await page.waitForFunction(()=>['setup','error'].includes(document.body.dataset.state),null,{timeout:180000});
    assert.equal(await page.locator('body').getAttribute('data-state'),'setup',errors.join('\n'));
    await page.locator('#ski').click();await page.locator('#start').click();
    await page.waitForFunction(()=>Number(document.body.dataset.time)>.12,null,{timeout:180000});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>document.body.dataset.state==='paused');
    const sheet=await page.addStyleTag({content:'body>*:not(#world){visibility:hidden!important}'});
    const start=Number(await page.locator('body').getAttribute('data-frames'));
    await page.waitForFunction(start=>Number(document.body.dataset.frames)>start+2,start,{timeout:90000});
    await page.screenshot({type:'jpeg',quality:91,path:path.join(out,before?'art-before.jpg':'art-sunset.jpg'),timeout:90000});
    const metrics=await page.evaluate(()=>document.getElementById('world').__mountainView?.photoMetrics?.()??null);
    records.push({capture:before?'before':'sunset',metrics});
    if(!before){
      assert.ok(metrics.riderScreenHeight>.30&&metrics.riderScreenHeight<.8,'Rider framing should be substantially closer.');
      assert.ok(metrics.trees.near+metrics.trees.middle+metrics.trees.far>20000,'Dense forest LODs must be populated.');
      await sheet.evaluate(el=>el.remove());await page.locator('#settings-button').click();await page.locator('#world-mood').selectOption('day');
      const lightStart=Number(await page.locator('body').getAttribute('data-frames'));
      await page.waitForFunction(start=>Number(document.body.dataset.frames)>start+2,lightStart,{timeout:90000});
      await page.addStyleTag({content:'body>*:not(#world){visibility:hidden!important}'});
      await page.screenshot({type:'jpeg',quality:91,path:path.join(out,'art-daylight.jpg'),timeout:90000});
      records.push({capture:'daylight',metrics:await page.evaluate(()=>document.getElementById('world').__mountainView.photoMetrics())});
    }
    await context.close();page=null;
  }
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(external.length,0,'Art rendering unexpectedly required online assets.');
}catch(e){
  process.exitCode=1;errors.push(e.message.slice(0,4000));
  if(page)await page.screenshot({type:'jpeg',quality:88,path:path.join(out,'art-failure.jpg'),timeout:90000}).catch(()=>{});
  console.error(e.message.slice(0,4000));
}finally{
  const report={renderedUTC:new Date().toISOString(),sourceSHA:process.env.SOURCE_SHA??null,baselineSHA:baseline,viewport:{width:2048,height:780},records,errors,externalRequests:external};
  await fs.writeFile(path.join(out,'art-review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  await browser.close();await new Promise(r=>server.close(r));
  for(const name of ['__art-before.html','__art-before-main.mjs','__art-before-world.mjs'])await fs.unlink(path.join(root,name)).catch(()=>{});
}
