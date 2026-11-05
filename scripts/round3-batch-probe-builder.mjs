// QA experiment only. Not imported or enabled by any product renderer.
import fs from'node:fs/promises';const original=await fs.readFile('scripts/round3-chromium-performance.mjs','utf8');let source=original;
const replace=(from,to)=>{if(!source.includes(from))throw Error('Benchmark source changed: '+from);source=source.replace(from,to)};
replace('large:false','large:true');
replace("const before=performance.now();chart.setOption", "const before=performance.now(),oldPath=chart.getZr().storage.getDisplayList().find(el=>el.symbolProxy&&el.shape?.points?.length===10000),oldPoints=Array.from(oldPath.shape.points);chart.setOption");
replace('animation:true,animationThreshold:10000','animation:false,animationThreshold:10000');
replace('costs.push(performance.now()-before);','const nextPath=chart.getZr().storage.getDisplayList().find(el=>el.symbolProxy&&el.shape?.points?.length===10000),target=Array.from(nextPath.shape.points);nextPath.setShape("points",oldPoints);nextPath.animateTo({shape:{points:target}},{duration:800,easing:"linear"});costs.push(performance.now()-before);');
replace('animationEnabled:chart.getModel().getSeriesByIndex(0).isAnimationEnabled(),','animationEnabled:"trusted one-path tween; series animation disabled for batch draw",');
replace("'test-results/stress3/browser-motion/performance.json'","'test-results/stress3/browser-motion/batch-probe.json'");
replace("result.environment='Fresh", "result.experimental=true;result.notEnabledInProduct=true;result.environment='QA batch-path experiment. Fresh");
replace('result={points:chart.getModel()', 'finalPath=chart.getZr().storage.getDisplayList().find(el=>el.symbolProxy&&el.shape?.points?.length===10000),identityProbe=[0,99,100,999,1000,2500,4999].every(i=>finalPath.findDataIndex(finalPath.shape.points[2*i],finalPath.shape.points[2*i+1])===i),result={identityProbe,points:chart.getModel()');
await fs.writeFile('scripts/round3-chromium-batch-probe.generated.mjs',source);
