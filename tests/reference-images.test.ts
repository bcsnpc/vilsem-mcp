import {it,expect}from'vitest'
import{Client}from'@modelcontextprotocol/sdk/client/index.js'
import{InMemoryTransport}from'@modelcontextprotocol/sdk/inMemory.js'
import{createServer}from'../src/server.js'
import{Models}from'../src/models.js'
import{rasterizeSvg}from'../src/preview.js'
import{referenceImage,structuralDiff}from'../src/referenceImages.js'
const image=()=>`data:image/png;base64,${rasterizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="white"/><rect x="40" y="80" width="80" height="120" fill="#118DFF"/><rect x="160" y="130" width="80" height="70" fill="#118DFF"/></svg>').toString('base64')}`
it('refuses remote/SVG resources and decodes a bounded reference without a model call',async()=>{
 await expect(referenceImage('https://example.com/chart.png')).rejects.toThrow(/remote/)
 await expect(referenceImage('data:image/svg+xml;base64,PHN2Zz4=')).rejects.toThrow(/remote/)
 expect((await referenceImage(image())).tokens.layout.aspectRatio).toBeCloseTo(400/240)
 expect((await referenceImage(image().split(',')[1])).tokens.theme.mode).toBe('light')
})
it('never invents reference chart semantics from pixel statistics',()=>{
 const tokens={theme:{palette:['#112233']}}
 const diff=structuralDiff(tokens,{series:[{type:'bar',label:{show:true}}]},tokens)
 expect(diff.reference).toEqual({seriesCount:null,legendPosition:null,labelPresence:null});expect(diff.rendered.seriesCount).toBe(1);expect(diff.paletteDistance).toBe(0)
 expect(structuralDiff(tokens,{series:[]},tokens,{seriesCount:3}).reference.seriesCount).toBe(3)
})
it('recognizes visible graphic scorecard text without reporting hidden groups as labels',()=>{
 const tokens={theme:{palette:['#112233']}},graphic={type:'group',children:[{type:'text',style:{text:'Revenue (USD)'}}]}
 expect(structuralDiff(tokens,{graphic:[graphic]},tokens).rendered.labelPresence).toBe(true)
 expect(structuralDiff(tokens,{graphic:[{...graphic,ignore:true}]},tokens).rendered.labelPresence).toBe(false)
})
it('returns image statistics, a multimodal agent prompt, and real-data comparison through MCP',async()=>{
 const adapter:any={connect:async source=>({source}),schema:async()=>({tables:[{name:'Product',columns:[{name:'Category',dataType:'string'}]}],measures:[{table:'Measures',name:'Sales',dataType:'decimal'}]}),query:async()=>[{'Product[Category]':'Bikes','[Sales]':12},{'Product[Category]':'Clothing','[Sales]':5}]}
 const server=createServer(new Models(adapter)),client=new Client({name:'reference-qa',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b)
 const unpack=(r:any)=>JSON.parse(r.content.find(c=>c.type==='text').text)
 try{
  const connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}})),reference_image=image()
  const tokens:any=await client.callTool({name:'extract_design_tokens',arguments:{image:reference_image}});expect(tokens.isError).not.toBe(true)
  const prompt=await client.getPrompt({name:'design_visual',arguments:{intent:'Match the reference',connectionId:connection.connectionId,reference_image}})
  expect(prompt.messages.some(m=>m.content.type==='image')).toBe(true);expect(JSON.stringify(prompt)).toContain('never pixels')
  const result:any=await client.callTool({name:'compare_preview',arguments:{connectionId:connection.connectionId,spec:{type:'bar'},bindings:{dimensions:[{table:'Product',column:'Category'}],measures:[{table:'Measures',name:'Sales'}]},reference_image,reference_structure:{seriesCount:1,legendPosition:'none',labelPresence:false}}})
  expect(result.isError,result.content?.[0]?.text).not.toBe(true);expect(result.content.filter(c=>c.type==='image')).toHaveLength(1);expect(unpack(result).rowCount).toBe(2);expect(unpack(result).structuralDiff.reference.seriesCount).toBe(1)
 }finally{await client.close();await server.close()}
})
