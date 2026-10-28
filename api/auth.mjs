// 帳號密碼（沒有 claude.ai 帳號時用）：名字 2～12 字、密碼 4～64 字；密碼用 PBKDF2 加鹽存（WebCrypto，Node 和 Cloudflare Workers 都有），登入發一個 token 放瀏覽器
const key=name=>'_auth/users/'+name.toLowerCase();
export const okName=n=>typeof n==='string'&&/^[^\s/\\"'<>]{2,12}$/.test(n);
export const okPass=p=>typeof p==='string'&&p.length>=4&&p.length<=64;
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
const rand=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const ITER=60000;
async function hash(pass,salt){
 const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:ITER},k,256));
}
export async function register(store,name,pass){
 if(!okName(name))return {ok:false,msg:'名字要 2～12 個字，不能有空白和斜線。'};if(!okPass(pass))return {ok:false,msg:'密碼要 4～64 個字。'};
 if(store.get(key(name)).exists)return {ok:false,msg:'這個名字有人用了。'};
 const salt=rand(16),uid='u_'+rand(8);
 store.set(key(name),{name,salt,hash:await hash(pass,salt),uid,t:Date.now()});
 return {ok:true,...issue(store,uid,name)};
}
export async function login(store,name,pass){
 const u=store.get(key(String(name||''))).data;if(!u||!okPass(pass)||await hash(pass,u.salt)!==u.hash)return {ok:false,msg:'名字或密碼不對。'};
 return {ok:true,...issue(store,u.uid,u.name)};
}
function issue(store,uid,name){const token=rand(24);store.set('_auth/tokens/'+token,{uid,name,t:Date.now()});return {uid,name,token};}
export function whoIs(store,token){if(!token||!/^[0-9a-f]{48}$/.test(token))return null;return store.get('_auth/tokens/'+token).data||null;}
export function logout(store,token){if(token)store.delete('_auth/tokens/'+token);}
