import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {browserEnvironment,browserCandidates} from '../dist/motionBrowser.js';
let executablePath;
for(const candidate of browserCandidates())try{if((await fs.stat(candidate)).isFile()){executablePath=candidate;break}}catch{}
if(!executablePath)throw Error('No installed preview browser');
const browser=await chromium.launch({executablePath,headless:true,chromiumSandbox:true,env:browserEnvironment()});
try{
 const context=await browser.newContext({viewport:{width:1200,height:700},serviceWorkers:'block'});await context.route('**/*',r=>r.abort());
 const page=await context.newPage();await page.setContent('<div>Idle RAF baseline; no chart or animation</div>');
 const result=await page.evaluate(()=>new Promise(resolve=>{const frames=[],start=performance.now();function tick(t){frames.push(t);if(performance.now()-start<3000){requestAnimationFrame(tick);return}const duration=performance.now()-start,gaps=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);resolve({durationMs:duration,frames:frames.length,rafFps:frames.length/duration*1000,medianFrameMs:gaps[Math.floor(gaps.length*.5)],p95FrameMs:gaps[Math.floor(gaps.length*.95)]})}requestAnimationFrame(tick)}));
 result.environment='Fresh sandboxed headless installed Chromium; idle page; real clock; not a native Power BI measurement';
 await fs.mkdir('test-results/stress3/browser-motion',{recursive:true});await fs.writeFile('test-results/stress3/browser-motion/idle-cadence.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close()}
