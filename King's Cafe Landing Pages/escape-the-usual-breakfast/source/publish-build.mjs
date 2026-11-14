import {cp, readdir, rm} from 'node:fs/promises';
// Only replace this angle's generated bundle, never sibling campaigns.
await rm(new URL('../assets/',import.meta.url),{recursive:true,force:true});
for(const name of await readdir(new URL('./dist/',import.meta.url))) {
  await cp(new URL('./dist/'+name,import.meta.url),new URL('../'+name,import.meta.url),{recursive:true});
}
