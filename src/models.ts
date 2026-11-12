import {validateInputPaths} from './paths.js'
import crypto from 'node:crypto'
import { createConnector } from '@vilsem/core/connect'
import { enrichSchema, schemaDetail } from '@vilsem/core/connect/context'

type Source = {kind:'desktop',port?:number} | {kind:'fabric',workspaceId:string,datasetId:string} | {kind:'report',reportDir:string}
export interface ModelAdapter {
  connect(source: Source): Promise<any>
  query(connection:any,dax:string,maxRows:number): Promise<any[]>
  schema(connection:any,options?:any): Promise<any>
}

// Connections own their target IDs. No process-global dataset mutation is used.
export class Models {
  private connections=new Map<string,any>()
  private metadata=new Map<string,any>()
  private profiles=new Map<string,{expires:number,promise:Promise<any>}>()
  constructor(private adapter:ModelAdapter=new VilsemAdapter()){}
  async connect(source:Source){await validateInputPaths({source});const connection=await this.adapter.connect(source);const connectionId=crypto.randomUUID();this.connections.set(connectionId,connection);return {connectionId,kind:source.kind,schemaOnly:!!connection.schemaOnly,...(connection.discovery?{discovery:connection.discovery,...(connection.source.port?{port:connection.source.port}:{})}:{})}}
  private get(id:string){const connection=this.connections.get(id);if(!connection)throw Error('Unknown connectionId; connect_model first');return connection}
  async query(id:string,dax:string,maxRows=200){
    // This endpoint is for DAX table queries, not XMLA/model commands.
    const code=dax.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').trim()
    if(!/^(EVALUATE\b|DEFINE\b[\s\S]*?\bEVALUATE\b)/i.test(code))throw Error('Only DAX EVALUATE queries are supported')
    const rows=await this.adapter.query(this.get(id),dax,maxRows)
    return rows.slice(0,maxRows)
  }
  reportDir(id:string){return this.get(id).reportDir as string|undefined}
  async schema(id:string,{detail='summary',refresh=false}:{detail?:'summary'|'full',refresh?:boolean}={}){
    const connection=this.get(id)
    if(refresh){this.metadata.delete(id);this.profiles.delete(id)}
    let entry=this.profiles.get(id)
    if(!entry || entry.expires<Date.now()){
      const next={expires:Infinity,promise:Promise.resolve(null) as Promise<any>}
      next.promise=this.fields(id,refresh).then(schema=>enrichSchema(schema,(dax,maxRows)=>this.query(id,dax,maxRows),{schemaOnly:!!connection.schemaOnly})).then(value=>{next.expires=Date.now()+60000;return value}).catch(error=>{if(this.profiles.get(id)===next)this.profiles.delete(id);throw error})
      this.profiles.set(id,next);entry=next
    }
    return schemaDetail(structuredClone(await entry.promise),detail)
  }
  async fields(id:string,refresh=false){
    if(!refresh&&this.metadata.has(id))return this.metadata.get(id)
    const discovered=await this.adapter.schema(this.get(id),{refresh})
    const schema={tables:discovered.tables || [],measures:discovered.measures || [],relationships:discovered.relationships || [],...(discovered.relationshipWarning?{relationshipWarning:discovered.relationshipWarning}:{})}
    this.metadata.set(id,schema);return schema
  }
}

export class VilsemAdapter implements ModelAdapter {
 private connector=createConnector()
 connect(source:Source){return this.connector.connect(source)}
 query(connection:any,dax:string,maxRows:number){return this.connector.query(connection,dax,maxRows)}
 schema(connection:any,options?:any){return this.connector.schema(connection,options)}
}
