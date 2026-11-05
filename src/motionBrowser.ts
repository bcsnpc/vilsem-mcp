import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'
import {encodePreviewApng} from '@vilsem/core/images/decode'

export function browserCandidates(env:NodeJS.ProcessEnv=process.env,platform=process.platform){
 if(env.VILSEM_PREVIEW_BROWSER_PATH)return[path.resolve(env.VILSEM_PREVIEW_BROWSER_PATH)]
 if(platform==='win32')return['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
 if(platform==='darwin')return['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
 return['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/opt/google/chrome/chrome']
}
export function browserEnvironment(env:NodeJS.ProcessEnv=process.env){
 const allowed=new Set(['SYSTEMROOT','WINDIR','COMSPEC','PATH','PATHEXT','TEMP','TMP','HOME','USERPROFILE','LOCALAPPDATA','APPDATA','LANG','DISPLAY','WAYLAND_DISPLAY','XDG_RUNTIME_DIR','XDG_CONFIG_HOME'])
 return Object.fromEntries(Object.entries(env).filter(([key,value])=>allowed.has(key.toUpperCase())&&typeof value==='string')) as Record<string,string>
}
export function motionCapturePlan(spec:any,option:any,width:number,height:number,count=8){
 if(!Number.isInteger(count)||count<2||count>12||width*height*count>12000000)throw Error('Browser capture requires2..12 frames within12 million pixels')
 const definition=spec.template?.animation,phase=definition?.enter??{},stagger=phase.delayByIndex,rawSeries=option.series??option.baseOption?.series??[],series=Array.isArray(rawSeries)?rawSeries:[rawSeries],points=Math.max(0,...series.map(s=>s.data?.length??0))
 const timeline=option.baseOption?.timeline??option.timeline,steps=option.options?.length??0
 const sourceDuration=Math.max(100,Number(phase.duration??option.animationDuration??500)+(stagger?Math.min(stagger.max,stagger.milliseconds*Math.max(0,points-1)):0),steps>1?(timeline?.playInterval??500)*steps:0)
 const duration=Math.min(3000,sourceDuration+(steps>1?0:32)),times=Array.from({length:count},(_,i)=>Math.round(16+i*(duration-16)/(count-1)))
 return {duration,sourceDuration,times,count}
}
let captureActive=false
export async function captureBrowserMotion(spec:any,rows:any[],option:any,width:number,height:number,context:any={},count=8){
 if(captureActive)throw Error('Browser motion capture is already active; retry after it completes or use motion:states')
 captureActive=true
 try{return await captureMotion(spec,rows,option,width,height,context,count)}finally{captureActive=false}
}
async function captureMotion(spec:any,rows:any[],option:any,width:number,height:number,context:any,count:number){
 if(Buffer.byteLength(JSON.stringify({spec,rows,context}))>8388608)throw Error('Browser capture payload exceeds8 MiB')
 const plan=motionCapturePlan(spec,option,width,height,count)
 let executablePath:string|undefined
 for(const candidate of browserCandidates())try{if((await fs.stat(candidate)).isFile()){executablePath=await fs.realpath(candidate);break}}catch{}
 if(!executablePath)throw Error('No preview browser found; install Chrome/Edge/Chromium or configure VILSEM_PREVIEW_BROWSER_PATH')
 const runtime=await fs.readFile(fileURLToPath(new URL('../dist/motion-runtime.js',import.meta.url)),'utf8')
 const browser=await chromium.launch({executablePath,headless:true,chromiumSandbox:true,timeout:10000,env:browserEnvironment(),args:['--disable-extensions','--no-first-run','--disable-background-networking']})
 let deadline:ReturnType<typeof setTimeout>|undefined
 try{
  return await Promise.race([(async()=>{
   const session=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false,locale:context.locale??'en-US'})
   let blockedRequests=0
   await session.route('**/*',route=>{blockedRequests++;return route.abort()})
   await session.routeWebSocket('**/*',socket=>{blockedRequests++;socket.close({code:1008,reason:'Network disabled for motion capture'})})
   const page=await session.newPage();page.setDefaultTimeout(10000)
   await page.clock.install({time:new Date('2020-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2020-01-01T00:00:10Z'))
   await page.addScriptTag({content:runtime})
   const state=await page.evaluate(payload=>(window as any).VilsemMotion.start(payload),{spec,rows,width,height,context})
   const frames:Buffer[]=[];let previous=0
   for(const time of plan.times){await page.clock.runFor(time-previous);previous=time;frames.push(await page.screenshot({type:'png',animations:'allow',timeout:10000}))}
   await page.evaluate(()=>(window as any).VilsemMotion.dispose())
   return{apng:encodePreviewApng(frames,{duration:plan.duration}),frames,metadata:{kind:'browser-clock',clock:'controlled requestAnimationFrame/timers; not an FPS measurement',sampledTimesMs:plan.times,durationMs:plan.duration,sourceDurationMs:plan.sourceDuration,truncated:plan.sourceDuration>plan.duration,pointCount:state.points,seriesTypes:state.seriesTypes,network:'blocked',blockedRequests,freshProfile:true}}
  })(),new Promise<never>((_,reject)=>{deadline=setTimeout(()=>reject(Error('Browser motion capture exceeded45 seconds')),45000)})])
 }finally{if(deadline)clearTimeout(deadline);await browser.close()}
}
