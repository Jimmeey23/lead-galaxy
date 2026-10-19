const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const lead={id:'lead1',hostId:'13752',center:'Bandra',fullName:'Test Lead',createdAt:'2026-10-01',phone:'',email:'',followUps:[{date:'2026-10-02',comment:'Original'},{date:null,comment:''},{date:null,comment:''},{date:null,comment:''}]};
let patchCount=0;let succeeds=false;
const deps={
 '@/lib/momence-host':{resolveMomenceHost:()=> '13752'},
 '@/lib/momence-auth':{momenceConfigured:()=>true,momenceFetch:async()=>new Response('',{status:succeeds?200:401})},
 '@/lib/sheet':{getLeads:async()=>({leads:[lead]}),cleanDate:(s)=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s:null,patchLead:(_id,patch)=>{patchCount++;Object.assign(lead,patch);}},
 'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}}};
const moduleObject={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/app/api/followups/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)((name)=>deps[name],moduleObject,moduleObject.exports);
const call=(body)=>moduleObject.exports.PUT(new Request('http://localhost/api/followups',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
(async()=>{
 let response=await call({id:'lead1',index:0,date:'2026-10-03',comment:'Updated'});assert.equal(response.status,502);assert.equal(patchCount,0);assert.equal(lead.followUps[0].comment,'Original');
 succeeds=true;response=await call({id:'lead1',index:0,date:'2026-10-03',comment:'Updated'});assert.equal(response.status,200);assert.equal(patchCount,1);assert.equal(lead.followUps[0].comment,'Updated');
 response=await call({id:'lead1',index:0,comment:'Comment-only edit'});assert.equal(response.status,200);assert.equal(lead.followUps[0].date,'2026-10-03');
 response=await call({id:'lead1',index:0.5});assert.equal(response.status,400);
 response=await call({id:'lead1',index:0,date:'invalid'});assert.equal(response.status,400);
 console.log('PASS: rejected provider save preserves original data; successful save updates derived fields; comment-only edits preserve dates; invalid index/date rejected.');
})().catch(error=>{console.error(error);process.exitCode=1;});
