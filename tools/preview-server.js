/* Optional milestone-1 static preview ONLY. Does not implement authentication or APIs.
 * Team integration: use Member 2's existing Node HTTP server instead.
 */
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const PORT=Number(process.env.PORT)||4173;
http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Method not allowed');}
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({error:'This is a static preview. API/authentication must be supplied by Member 2.'}));}
  let decoded;try{decoded=decodeURIComponent(pathname);}catch{res.writeHead(400);return res.end('Bad request');}
  const file=path.resolve(ROOT,'.'+decoded);
  if(file!==ROOT&&!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);return res.end('File not found');}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT,()=>console.log(`Static preview: http://localhost:${PORT}/provider/dashboard.html`));
