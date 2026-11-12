import {it,expect,vi} from 'vitest'
import {Models,stripDaxComments} from '../src/models.js'
it('accepts commented DAX and preserves comment-like text in values and identifiers through the adapter',async()=>{
 const adapter={connect:vi.fn(async source=>({source})),query:vi.fn(async()=>[]),schema:vi.fn()},models=new Models(adapter),{connectionId}=await models.connect({kind:'desktop',port:12345})
 for(const query of ['-- note\nEVALUATE ROW("x",1)','// note\r\n/* note */ -- more\r\nEVALUATE ROW("x",1)','DEFINE -- note\nMEASURE \'T\'[x] = 1\nEVALUATE ROW("x",[x])']){
  await models.query(connectionId,query);expect(adapter.query.mock.calls.at(-1)![1]).toMatch(/^(EVALUATE|DEFINE)/)
 }
 const literal='EVALUATE ROW("x--//", "https://example.invalid/a--b", "quoted""--value", \'T--x\'[a//b])'
 expect(stripDaxComments(literal)).toBe(literal);await models.query(connectionId,literal);expect(adapter.query.mock.calls.at(-1)![1]).toBe(literal)
})
it.each(['{ "createOrReplace": {} }','<Batch>xmla</Batch>','plain text','-- EVALUATE fake\ncreateOrReplace','/* EVALUATE */ <Batch/>','-- comments only','/* unterminated'])('rejects nonqueries before the adapter: %s',async dax=>{
 const adapter={connect:vi.fn(async()=>({})),query:vi.fn(),schema:vi.fn()},models=new Models(adapter),{connectionId}=await models.connect({kind:'desktop'})
 await expect(models.query(connectionId,dax)).rejects.toThrow();expect(adapter.query).not.toHaveBeenCalled()
})
