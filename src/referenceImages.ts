import {assertLocalPath,localRealpath} from './paths.js'
import fs from 'node:fs/promises'
import {decodeDesignImage} from '@vilsem/core/images/decode'
import {extractDesignTokens} from '@vilsem/core/images'
import {isStaticDecoration} from './decorativeSeries.js'
const MAX_BYTES=8388608
export async function referenceImage(image:string){
 let bytes:Buffer
 const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(image)
 const rawBase64=/^(?:iVBORw0KGgo|\/9j\/)[A-Za-z0-9+/=\r\n]+$/.test(image)?image.replace(/[\r\n]/g,''):null
 if(match||rawBase64){const encoded=match?.[2]||rawBase64!;if(encoded.length>Math.ceil(MAX_BYTES*4/3)+4)throw Error('Reference image exceeds8 MiB');bytes=Buffer.from(encoded,'base64')}
 else{
  if(image.length>4096||/^https?:|^data:/i.test(image))throw Error('Use a local PNG/JPEG path or data:image/png|jpeg;base64 URI; remote resources are not fetched')
  assertLocalPath(image,'image')
  image=await localRealpath(image,'image')
  const stat=await fs.stat(image);if(!stat.isFile()||stat.size>MAX_BYTES)throw Error('Reference must be a regular PNG/JPEG file up to8 MiB');bytes=await fs.readFile(image)
 }
 const decoded=decodeDesignImage(bytes),tokens=extractDesignTokens({image:decoded})
 return {bytes,mimeType:bytes[0]===137?'image/png':'image/jpeg',tokens}
}
export function structuralDiff(reference:any,option:any,renderTokens:any,declared:any={}){
 const series=(Array.isArray(option.series)?option.series:option.series?[option.series]:[]).filter(s=>!isStaticDecoration(s)),legend=Array.isArray(option.legend)?option.legend[0]:option.legend
 const graphic=option.graphic?.elements??option.graphic,pending=Array.isArray(graphic)?[...graphic]:graphic?[graphic]:[];let graphicText=false,visited=0
 while(pending.length&&visited++<10000){const element=pending.pop();if(element?.ignore||element?.invisible||element?.style?.opacity===0)continue;if(element?.type==='text'&&element.style?.text!=null&&element.style.text!==''){graphicText=true;break}if(Array.isArray(element?.children))pending.push(...element.children)}
 const rendered={seriesCount:series.length,legendPosition:legend?.show===false||!legend?'none':legend.left??legend.right??legend.top??'default',labelPresence:graphicText||series.some(s=>s.label?.show||s.renderItem?.vilsemExpression?.ast?.root?.type==='text'||JSON.stringify(s.renderItem?.vilsemExpression?.ast||{}).includes('"type":"text"'))}
 const rgb=hex=>hex.match(/[\da-f]{2}/gi).map(v=>parseInt(v,16)),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))/Math.sqrt(3*255*255)
 const palette=reference.theme.palette,other=renderTokens.theme.palette
 const paletteDistance=palette.length&&other.length?palette.reduce((sum,c)=>sum+Math.min(...other.map(d=>distance(rgb(c),rgb(d)))),0)/palette.length:null
 return {reference:{seriesCount:declared.seriesCount??null,legendPosition:declared.legendPosition??null,labelPresence:declared.labelPresence??null},rendered,paletteDistance,notes:['Pixel statistics cannot identify chart semantics. Reference series/legend/labels remain unknown unless the calling agent explicitly supplies reference_structure.','Palette distance is normalized nearest RGB distance, not a perceptual or semantic match score.','Numbers and bindings come from the model; reference-image numbers are never used as data.']}
}
