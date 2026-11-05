// Built into the shipped browser bundle. No connectors, Node bridge or LLM.
import * as echarts from 'echarts'
import {resolveVisualSpec} from '@vilsem/core/spec/resolve'
import {resolveReportTheme} from '@vilsem/core/theme/report'
let chart
export function start({spec,rows,width,height,context}){
 if(chart)chart.dispose()
 document.body.style.cssText='margin:0;overflow:hidden'
 document.body.style.background=resolveReportTheme(spec,context).background
 const element=document.createElement('div');element.style.width=width+'px';element.style.height=height+'px';document.body.replaceChildren(element)
 const option=resolveVisualSpec(spec,rows,{...context,width,height,measureText:(text,font)=>echarts.format.getTextRect(text,font).width})
 chart=echarts.init(element,null,{renderer:'canvas',width,height});chart.setOption(option)
 return{seriesTypes:(chart.getOption().series??[]).map(s=>s.type),points:(chart.getOption().series??[]).reduce((sum,s)=>sum+(s.data?.length??0),0)}
}
export function dispose(){chart?.dispose();chart=undefined}
