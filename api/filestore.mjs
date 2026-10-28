// Node 版的落地：整份 Map 延遲 300ms 寫成 DATA_DIR/db.json（tmp＋rename），啟動時讀回來
import fs from 'node:fs';
import path from 'node:path';
import {Store} from './store.mjs';
export function fileStore(file){
 const store=new Store();let timer=null;
 const flush=()=>{clearTimeout(timer);timer=null;try{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(Object.fromEntries(store.docs)));fs.renameSync(tmp,file);}catch(e){console.error('db save failed',e.message);}};
 const later=()=>{if(!timer)timer=setTimeout(flush,300);};
 store.persist={put:later,del:later,flush};
 try{const j=JSON.parse(fs.readFileSync(file,'utf8'));for(const [k,v] of Object.entries(j))store.docs.set(k,v);}catch{}
 return store;
}
