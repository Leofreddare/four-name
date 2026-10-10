import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {createRemoteChecker} from './workers/client.js';
import {createChecker} from './lookup.js';
import {PLATFORMS} from './platforms.js';
const publicRoot=new URL('./public/',import.meta.url);
const assets=new Map([['/',['index.html','text/html; charset=utf-8']],['/index.html',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/styles.css',['styles.css','text/css; charset=utf-8']],['/platforms.js',[new URL('./platforms.js',import.meta.url),'text/javascript; charset=utf-8']],['/words.js',['words.js','text/javascript; charset=utf-8']],['/help-data.js',['help-data.js','text/javascript; charset=utf-8']],['/generator.js',['generator.js','text/javascript; charset=utf-8']],['/generator-worker.js',['generator-worker.js','text/javascript; charset=utf-8']],['/word-match.js',['word-match.js','text/javascript; charset=utf-8']],['/icon.svg',['icon.svg','image/svg+xml']],['/favicon.ico',['icon.svg','image/svg+xml']]]);
assets.set('/service-icons/minecraft.png',['service-icons/minecraft.png','image/png']);
for(const platform of Object.keys(PLATFORMS).filter(p=>p!=='minecraft'))assets.set('/service-icons/'+platform+'.svg',['service-icons/'+platform+'.svg','image/svg+xml']);
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};
function send(res,status,body,type='application/json'){if(res.destroyed)return;res.writeHead(status,{...headers,'Content-Type':type,'Cache-Control':'no-store'});res.end(body)}
export function validateJob(body){
 if(!body||!Array.isArray(body.names)||!body.names.length||body.names.length>10000||body.names.some(n=>typeof n!=='string'||!n.trim()||n.length>128))throw Error('Send 1–10,000 names, at most 128 characters each.');
 if(!Array.isArray(body.platforms)||!body.platforms.length||body.platforms.length!==1||new Set(body.platforms).size!==body.platforms.length||body.platforms.some(p=>!PLATFORMS[p]))throw Error('Choose exactly one supported service.');
 const names=[...new Set(body.names.map(n=>n.trim().toLowerCase()))],max=Math.min(...body.platforms.map(p=>PLATFORMS[p].limit));if(names.length>max)throw Error('Selected platforms support at most '+max+' names per search.');if(body.refresh!==undefined&&typeof body.refresh!=='boolean')throw Error('Invalid retry option.');return {names,platforms:body.platforms,...(body.refresh?{refresh:true}:{})};
}
export function createApp(engine=createChecker()){
 const staticCache=new Map();
 let active=0;const clients=new Set();const starts=new Map();const jobs=new Map();
 const server=http.createServer(async(req,res)=>{
  let controller;
  try{
   const url=new URL(req.url,'http://'+(req.headers.host||'localhost'));
   if(url.pathname==='/health')return send(res,200,JSON.stringify({status:'ok'}));
   if(url.pathname==='/api/control'){
    if(req.method!=='POST')return send(res,405,JSON.stringify({error:'Use POST.'}));
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,JSON.stringify({error:'Expected JSON.'}));
    const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)return send(res,403,JSON.stringify({error:'Use this site.'}));
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(res,413,JSON.stringify({error:'Request too large.'}))}
    let control;try{control=JSON.parse(raw)}catch{return send(res,400,JSON.stringify({error:'Invalid JSON.'}))}
    const job=jobs.get(control.jobId);if(!job)return send(res,404,JSON.stringify({error:'Search no longer active.'}));
    if(!['pause','resume'].includes(control.action))return send(res,400,JSON.stringify({error:'Invalid action.'}));
    job.paused=control.action==='pause';if(!job.paused){for(const resume of job.waiters)resume();job.waiters.clear()}
    return send(res,200,JSON.stringify({paused:job.paused}));
   }
   if(url.pathname==='/api/check'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,JSON.stringify({error:'Use POST.'}))}
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,JSON.stringify({error:'Expected JSON.'}));
    const origin=req.headers.origin;if(origin){let originHost;try{originHost=new URL(origin).host}catch{}if(originHost!==req.headers.host)return send(res,403,JSON.stringify({error:'Use this site to search.'}))}
    if(Number(req.headers['content-length'])>1500000)return send(res,413,JSON.stringify({error:'Request too large.'}));
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1500000)return send(res,413,JSON.stringify({error:'Request too large.'}));chunks.push(chunk)}
    let job;try{job=validateJob(JSON.parse(Buffer.concat(chunks).toString()))}catch(error){return send(res,400,JSON.stringify({error:error.message}))}
    const ip=req.socket.remoteAddress,now=Date.now();for(const [key,time] of starts)if(time<now-60000)starts.delete(key);
    if(active>=3||starts.size>=10000||(starts.get(ip)||0)>now-1000){res.setHeader('Retry-After','2');return send(res,429,JSON.stringify({error:'Checker busy. Retry shortly.',retryAfter:2}))}
    starts.set(ip,now);active++;controller=new AbortController();clients.add(controller);res.on('close',()=>controller.abort());
    res.writeHead(200,{...headers,'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();const jobId=randomUUID(),control={paused:false,waiters:new Set()};jobs.set(jobId,control);const waitForResume=async()=>{while(control.paused){await new Promise((resolve,reject)=>{const finish=()=>{control.waiters.delete(finish);controller.signal.removeEventListener('abort',abort);resolve()},abort=()=>{control.waiters.delete(finish);reject(controller.signal.reason)};control.waiters.add(finish);controller.signal.addEventListener('abort',abort,{once:true});if(controller.signal.aborted)abort()})}controller.signal.throwIfAborted()};
    const heartbeat=setInterval(()=>{if(!res.destroyed&&!res.writableNeedDrain)res.write('{"type":"heartbeat"}\n')},15000);heartbeat.unref();
    const emit=async event=>{if(event.type==='results'||event.type==='done')await waitForResume();if(event.type==='meta')event={...event,jobId};controller.signal.throwIfAborted();if(!res.write(JSON.stringify(event)+'\n'))await once(res,'drain',{signal:controller.signal})};
    try{await engine.run(job,controller.signal,emit,waitForResume);res.end()}catch(error){if(!controller.signal.aborted){res.end(JSON.stringify({type:'error',message:'Search interrupted. Retry unfinished names.'})+'\n')}}finally{clearInterval(heartbeat);jobs.delete(jobId);clients.delete(controller);active--}
    return;
   }
   if(!['GET','HEAD'].includes(req.method))return send(res,405,JSON.stringify({error:'Use GET.'}));
   const asset=assets.get(url.pathname);if(!asset)return send(res,404,JSON.stringify({error:'Not found.'}));
   let prepared=staticCache.get(url.pathname);if(!prepared){prepared=(async()=>{const content=await readFile(asset[0] instanceof URL?asset[0]:new URL(asset[0],publicRoot));const compress=/^(text\/|image\/svg)/.test(asset[1])&&content.length>512;return {content,etag:'W/"'+createHash('sha256').update(content).digest('hex').slice(0,24)+'"',gzip:compress?gzipSync(content):null,br:compress?brotliCompressSync(content,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}):null}})();staticCache.set(url.pathname,prepared);prepared.catch(()=>staticCache.delete(url.pathname))}
   const file=await prepared,encoding=req.headers['accept-encoding']||'',kind=file.br&&/\bbr\b/.test(encoding)?'br':file.gzip&&/\bgzip\b/.test(encoding)?'gzip':null,content=kind?file[kind]:file.content;
   const cacheHeaders={...headers,'Content-Type':asset[1],'Cache-Control':'public, max-age=0, must-revalidate',ETag:file.etag,Vary:'Accept-Encoding'};
   if(req.headers['if-none-match']===file.etag){res.writeHead(304,cacheHeaders);return res.end()}
   res.writeHead(200,{...cacheHeaders,...(kind?{'Content-Encoding':kind}:{}),'Content-Length':content.length});res.end(req.method==='HEAD'?undefined:content);
  }catch(error){if(!controller?.signal.aborted)send(res,500,JSON.stringify({error:'Server request failed. Retry.'}))}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;
 server.on('close',()=>{for(const c of clients)c.abort()});server.cancelSearches=()=>{for(const c of clients)c.abort()};
 return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 let restrictions=[];if(process.env.RESTRICTIONS_FILE){restrictions=JSON.parse(await readFile(process.env.RESTRICTIONS_FILE,'utf8'));if(!Array.isArray(restrictions))throw Error('Restrictions evidence must be an array')}
 const engine=process.env.CHECK_WORKER_URL?createRemoteChecker({url:process.env.CHECK_WORKER_URL,secret:process.env.CHECK_WORKER_SECRET}):createChecker({restrictions});
 const server=createApp(engine);server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Four Name listening on port '+server.address().port));
 const shutdown=()=>{server.cancelSearches();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref()};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
