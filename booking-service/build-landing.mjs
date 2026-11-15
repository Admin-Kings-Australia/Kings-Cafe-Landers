import {spawnSync} from 'node:child_process';
import {cpSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL("../King's Cafe Landing Pages/escape-the-usual-breakfast/source/",import.meta.url));
for(const args of [['ci','--no-audit','--no-fund'],['exec','--','vite','build']]) {
  const result=spawnSync('npm',args,{cwd:source,stdio:'inherit',env:{...process.env,VITE_RESERVATION_ENDPOINT:'/api/bookings'}});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
const destination=fileURLToPath(new URL('./landing/',import.meta.url));
mkdirSync(destination,{recursive:true});
cpSync(source+'/dist',destination,{recursive:true});
