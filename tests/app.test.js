import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createApp} from '../server.js';
const request=(names,origin='https://four-name.onrender.com')=>new Request('https://four-name.onrender.com/api/check',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({names})});
let sequence=0;async function lookup(){const source=await readFile(new URL('../lookup.js',import.meta.url),'utf8');return (await import('data:text/javascript;base64,'+Buffer.from(source+'\n// fresh '+sequence++).toString('base64'))).checkRequest}
test('HTTP app serves UI, assets and health; rejects private paths and invalid methods/bodies',async()=>{
 let body;const server=createApp(async request=>{body=await request.json();return Response.json({results:body.names.map(name=>({name,status:'unclaimed',checked_at:new Date().toISOString()}))})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/health')).status,200);const html=await (await fetch(base+'/')).text();assert(html.includes('Four Name'));assert(html.includes('min="3" max="7"'));assert(html.includes('max="10000" step="100" value="10000"'));assert.equal((await fetch(base+'/generator.js')).status,200);assert.equal((await fetch(base+'/icon.svg')).status,200);assert.equal((await fetch(base+'/server.js')).status,404);assert.equal((await fetch(base+'/api/check')).status,405);
  assert.equal((await fetch(base+'/api/check',{method:'POST',body:'wrong'})).status,415);assert.equal((await fetch(base+'/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(1025)})).status,413);
  const result=await (await fetch(base+'/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:['cat']})})).json();assert.deepEqual(body,{names:['cat']});assert.equal(result.results[0].name,'cat');
 }finally{await new Promise(r=>server.close(r))}
});
test('bulk lookup validates profiles and never accepts upstream failures',async()=>{
 const actual=globalThis.fetch;const check=await lookup();try{
  globalThis.fetch=async()=>new Response(JSON.stringify([{name:'Notch',id:'069a79f444e94726a5befca90e38aaf5'}]));assert.deepEqual((await (await check(request(['notch','qzxv739']))).json()).results.map(r=>r.name),['qzxv739']);
  assert.equal((await check(request(['cat'],'https://elsewhere.test'))).status,403);assert.equal((await check(request(['cat','cat']))).status,400);assert.equal((await check(request(['ab']))).status,400);
  globalThis.fetch=async()=>new Response('{}',{status:429,headers:{'Retry-After':'3'}});assert.equal((await (await check(request(['cat']))).json()).retry_after,3);
  const blocked=await lookup();globalThis.fetch=async()=>new Response('Forbidden',{status:403});const response=await blocked(request(['cat']));assert.equal(response.status,502);const data=await response.json();assert(data.error.includes('HTTP 403'));assert(!data.results);
 }finally{globalThis.fetch=actual}
});
test('single-name fallback verifies known UUID and exact missing-profile response',async()=>{
 const actual=globalThis.fetch;let posts=0;const check=await lookup();try{
  globalThis.fetch=async (url,options)=>{if(options?.method==='POST'){posts++;return new Response('Forbidden',{status:403})}const name=url.split('/').at(-1);return name==='notch'?Response.json({name:'Notch',id:'069a79f444e94726a5befca90e38aaf5'}):Response.json({path:new URL(url).pathname,errorMessage:"Couldn't find any profile with name "+name},{status:404})};
  const data=await (await check(request(['notch','qzxv739']))).json();assert.equal(data.lookup_mode,'individual');assert.deepEqual(data.results.map(r=>r.name),['qzxv739']);assert.equal(posts,3);await check(request(['notch']));assert.equal(posts,3);
  const invalid=await lookup();globalThis.fetch=async (url,options)=>options?.method==='POST'?new Response('Forbidden',{status:403}):url.endsWith('/notch')?Response.json({name:'Notch',id:'069a79f444e94726a5befca90e38aaf5'}):Response.json({error:'generic not found'},{status:404});const response=await invalid(request(['qzxv739']));assert.equal(response.status,502);assert(!(await response.json()).results);
 }finally{globalThis.fetch=actual}
});
