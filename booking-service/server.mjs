import http from 'node:http';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {openStore,today} from './store.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export function makeHandler({store,password,origins=[],secure=true,trustProxy=false}) {
  if(!password || password.length<16) throw Error('Set STAFF_PASSWORD to a unique password of at least 16 characters.');
  const salt=randomBytes(16), passwordHash=scryptSync(password,salt,32), rates=new Map();
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const allowed=new Set(origins);
  function limited(req,kind,limit) {
    const ip=trustProxy?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;
    const key=kind+ip, now=Date.now();
    for(const [k,v] of rates) if(v.until<now) rates.delete(k);
    const entry=rates.get(key)||{count:0,until:now+900000};entry.count++;rates.set(key,entry);
    return entry.count>limit;
  }
  return async function handler(req,res) {
    const url=new URL(req.url,'http://localhost'), origin=req.headers.origin;
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
    function send(status,value,extra={}) {res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(value));}
    try {
      if(origin && !allowed.has(origin)) return send(403,{error:'Origin not allowed.'});
      if(origin) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type, Idempotency-Key','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS'});
      if(req.method==='OPTIONS') return send(204,{});
      const session=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('kings_session='))?.slice(14)||'';
      const authenticated=!!store.db.prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?').get(hash(session),Date.now());
      const readBody=async()=>{
        if(!req.headers['content-type']?.startsWith('application/json')) throw Error('JSON required.');
        let data='';for await(const chunk of req) {data+=chunk;if(Buffer.byteLength(data)>16384) throw Error('Request too large.');}
        return JSON.parse(data);
      };
      if(req.method==='POST'&&url.pathname==='/api/session') {
        if(limited(req,'login',10)) return send(429,{error:'Too many attempts. Try again in 15 minutes.'});
        const body=await readBody();
        if(typeof body.password!=='string'||body.password.length>256||!timingSafeEqual(scryptSync(body.password,salt,32),passwordHash)) return send(401,{error:'Incorrect staff password.'});
        const token=randomBytes(32).toString('hex');
        store.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
        store.db.prepare('INSERT INTO sessions VALUES(?,?)').run(hash(token),Date.now()+12*3600000);
        return send(200,{ok:true},{'Set-Cookie':`kings_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure?'; Secure':''}`});
      }
      if(req.method==='POST'&&url.pathname==='/api/logout') {
        store.db.prepare('DELETE FROM sessions WHERE token=?').run(hash(session));
        return send(200,{ok:true},{'Set-Cookie':`kings_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`});
      }
      if(req.method==='POST'&&url.pathname==='/api/bookings') {
        if(limited(req,'book',30)) return send(429,{error:'Too many requests. Please call the café.'});
        const saved=store.create(await readBody(),req.headers['idempotency-key']);
        return send(saved.replayed?200:201,saved);
      }
      if(url.pathname.startsWith('/api/')) {
        if(!authenticated) return send(401,{error:'Please sign in.'});
        if(req.method==='GET'&&url.pathname==='/api/bookings') return send(200,{today:today(),bookings:store.list(url.searchParams.get('date')||today())});
        if(req.method==='GET'&&/^\/api\/customers\/[\w-]+$/.test(url.pathname)) return send(200,{bookings:store.history(url.pathname.split('/').pop())});
        if(req.method==='PATCH'&&/^\/api\/bookings\/[\w-]+$/.test(url.pathname)) {
          const saved=store.update(url.pathname.split('/').pop(),await readBody());
          return send(saved?200:409,saved?{ok:true}:{error:'This booking changed on another device. Refresh and try again.'});
        }
        return send(404,{error:'Not found.'});
      }
      if(req.method==='GET'&&url.pathname==='/') {res.writeHead(302,{...headers,Location:'/escape-the-usual-breakfast/'});return res.end();}
      if(req.method==='GET'&&url.pathname.startsWith('/escape-the-usual-breakfast/')) {
        const root=resolve(here,'landing');
        const relative=decodeURIComponent(url.pathname.slice('/escape-the-usual-breakfast/'.length))||'index.html';
        const file=resolve(root,relative);
        const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',woff2:'font/woff2'};
        const type=types[file.split('.').pop()];
        if(!file.startsWith(root+'/')||!type||!existsSync(file))return send(404,{error:'Not found.'});
        const data=readFileSync(file);
        // The existing landing page loads its own fonts and images; keep its CSP separate from the staff app.
        const publicHeaders={...headers,'Content-Type':type};delete publicHeaders['Content-Security-Policy'];
        res.writeHead(200,publicHeaders);return res.end(data);
      }
      const files={'/bookings':'index.html','/bookings/':'index.html','/bookings/app.js':'app.js','/bookings/style.css':'style.css','/bookings/logo.png':'logo.png'};
      if(req.method==='GET'&&files[url.pathname]) {
        const file=files[url.pathname];const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png'};
        const data=readFileSync(resolve(here,'public',file));res.writeHead(200,{...headers,'Content-Type':types[file.split('.').pop()]});return res.end(data);
      }
      send(404,{error:'Not found.'});
    } catch(error) {
      const internal=error.code?.startsWith('ERR_SQLITE')||error.code==='SQLITE_ERROR';
      send(internal?500:400,{error:internal?'Could not save. Please retry or call the café.':error.message});
    }
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const path=resolve(process.env.DATABASE_PATH||'./data/bookings.sqlite');mkdirSync(dirname(path),{recursive:true});
  const origins=[...(process.env.ALLOWED_ORIGINS||'http://localhost:4174').split(','),process.env.RENDER_EXTERNAL_URL||''].map(x=>x.trim()).filter(Boolean);
  http.createServer(makeHandler({store:openStore(path),password:process.env.STAFF_PASSWORD,origins,secure:process.env.NODE_ENV==='production',trustProxy:process.env.TRUST_PROXY==='true'})).listen(Number(process.env.PORT||4174),process.env.HOST||'127.0.0.1',()=>console.log('KINGS bookings server ready on port '+(process.env.PORT||4174)));
}
