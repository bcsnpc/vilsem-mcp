import crypto from 'node:crypto'
import { createConnector } from '@vilsem/core/connect'

type Source = {kind:'desktop',port?:number} | {kind:'fabric',workspaceId:string,datasetId:string}
export interface ModelAdapter {
  connect(source: Source): Promise<any>
  query(connection:any,dax:string,maxRows:number): Promise<any[]>
  schema(connection:any): Promise<any>
}

// Connections own their target IDs. No process-global dataset mutation is used.
export class Models {
  private connections=new Map<string,any>()
  constructor(private adapter:ModelAdapter=new VilsemAdapter()){}
  async connect(source:Source){const connection=await this.adapter.connect(source);const connectionId=crypto.randomUUID();this.connections.set(connectionId,connection);return {connectionId,kind:source.kind,...(connection.discovery?{discovery:connection.discovery,port:connection.source.port}:{})}}
  private get(id:string){const connection=this.connections.get(id);if(!connection)throw Error('Unknown connectionId; connect_model first');return connection}
  async query(id:string,dax:string,maxRows=200){
    // This endpoint is for DAX table queries, not XMLA/model commands.
    const code=dax.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').trim()
    if(!/^(EVALUATE\b|DEFINE\b[\s\S]*?\bEVALUATE\b)/i.test(code))throw Error('Only DAX EVALUATE queries are supported')
    const rows=await this.adapter.query(this.get(id),dax,maxRows)
    return rows.slice(0,maxRows)
  }
  async schema(id:string){
    const connection=this.get(id), discovered=await this.adapter.schema(connection)
    // Introspection may include raw model definitions for Desktop app export.
    // The MCP schema contract exposes fields/relationships only, never data sources.
    const schema={tables:discovered.tables || [],measures:discovered.measures || [],relationships:discovered.relationships || []}
    const columnTasks:any[]=[]
    for(const table of schema.tables || [])for(const column of table.columns || [])columnTasks.push({table,column})
    let index=0
    const quoteTable=name=>`'${String(name).replace(/'/g,"''")}'`
    const quoteColumn=name=>`[${String(name).replace(/\]/g,']]')}]`
    await Promise.all(Array.from({length:Math.min(4,columnTasks.length)},async()=>{
      while(index<columnTasks.length){
        const {table,column}=columnTasks[index++]
        const ref=`${quoteTable(table.name)}${quoteColumn(column.name)}`
        try{
          const rows=await this.adapter.query(connection,`EVALUATE TOPN(10, VALUES(${ref}), ${ref}, ASC)`,10)
          column.sampleValues=rows.slice(0,10).map(row=>Object.values(row)[0])
        }catch(error){column.sampleValues=[];column.sampleError=(error as Error).message}
      }
    }))
    return schema
  }
}

export class VilsemAdapter implements ModelAdapter {
 private connector=createConnector()
 connect(source:Source){return this.connector.connect(source)}
 query(connection:any,dax:string,maxRows:number){return this.connector.query(connection,dax,maxRows)}
 schema(connection:any){return this.connector.schema(connection)}
}
