const http=require('http'),fs=require('fs'),path=require('path');
const file=path.join(__dirname,'dist','index.html');
const server=http.createServer((req,res)=>{if(req.url==='/'||req.url==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}else{res.writeHead(404);res.end('Not found');}});
server.listen(8766,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8766/'));
