import {validateVisualContainer,VISUAL_SCHEMA} from '@vilsem/core/pbir'

// Existing Desktop saves can advance the declaration before Microsoft publishes
// its schema. Never fetch it, relabel the file, strip fields, or relax validation.
// Accept only the complete known field contract; disclose the narrower check.
export async function validateExistingContainer(value:any){
 if(value?.$schema===VISUAL_SCHEMA){await validateVisualContainer(value);return {mode:'official-2.7',declaredSchema:value.$schema,warnings:[] as string[]}}
 const declared=value?.$schema
 if(typeof declared!=='string'||!/^https:\/\/developer\.microsoft\.com\/json-schemas\/fabric\/item\/report\/definition\/visualContainer\/2\.\d{1,3}\.\d{1,3}\/schema\.json$/.test(declared)){
  await validateVisualContainer(value)
  throw Error('Unsupported container declaration')
 }
 await validateVisualContainer({...value,$schema:VISUAL_SCHEMA})
 return {mode:'known-2.7-contract',declaredSchema:declared,warnings:[`Container declares ${declared}; its complete field structure passes the bundled2.7 contract. Full validation against the declared schema was not performed. The declaration and other fields are preserved.`]}
}
