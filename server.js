import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {checkRequest} from './lookup.js';
const publicRoot=new URL('./public/',import.meta.url);
const assets=new Map([['/',['index.html','text/html; charset=utf-8']],['/index.html',['index.html','text/html; charset=utf-8']],['/generator.js',['generator.js','text/javascript; charset=utf-8']],['/client-compute.js',['client-compute.js','text/javascript; charset=utf-8']],['/generator-worker.js',['generator-worker.js','text/javascript; charset=utf-8']],['/icon.svg',['icon.svg','image/svg+xml']],['/favicon.ico',['icon.svg','image/svg+xml']]]);
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};
function send(res,status,body,type='application/json'){if(res.destroyed)return;res.writeHead(status,{...headers,'Content-Type':type,'Cache-Control':'no-store'});res.end(body)}
export function createApp(check=checkRequest){
 return http.createServer(async(req,res)=>{
  try{
   const host=req.headers.host||'localhost',protocol=req.headers['x-forwarded-proto']==='https'?'https':'http';
   const url=new URL(req.url,protocol+'://'+host),path=url.pathname;
   if(path==='/health'&&(req.method==='GET'||req.method==='HEAD'))return send(res,200,JSON.stringify({status:'ok'}));
   if(path==='/api/check'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,JSON.stringify({error:'Use POST.'}))}
    if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,JSON.stringify({error:'Expected JSON.'}));
    if(Number(req.headers['content-length'])>1024)return send(res,413,JSON.stringify({error:'Batch too large.'}));
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>1024)return send(res,413,JSON.stringify({error:'Batch too large.'}));chunks.push(chunk)}
    const response=await check(new Request(url,{method:'POST',headers:{'Content-Type':req.headers['content-type'],...(req.headers.origin?{Origin:req.headers.origin}:{})},body:Buffer.concat(chunks)}));
    return send(res,response.status,Buffer.from(await response.arrayBuffer()),response.headers.get('Content-Type')||'application/json');
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,JSON.stringify({error:'Use GET.'}));
   const asset=assets.get(path);if(!asset)return send(res,404,JSON.stringify({error:'Not found.'}));
   const content=await readFile(new URL(asset[0],publicRoot));send(res,200,req.method==='HEAD'?'':content,asset[1]);
  }catch(error){console.error('Request failed:',error.message);send(res,500,JSON.stringify({error:'Server request failed. Retry.'}))}
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.PORT||3000);const server=createApp();server.listen(port,'0.0.0.0',()=>console.log('Four Name listening on port '+server.address().port));
 const shutdown=()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref()};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
