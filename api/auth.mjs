// 帳號密碼（沒有 claude.ai 帳號時用）：名字 2～12 字、密碼 4～64 字；密碼用 scrypt 加鹽存，登入發一個 token 放瀏覽器
import crypto from 'node:crypto';
const key=name=>'_auth/users/'+name.toLowerCase();
export const okName=n=>typeof n==='string'&&/^[^\s/\\"'<>]{2,12}$/.test(n);
export const okPass=p=>typeof p==='string'&&p.length>=4&&p.length<=64;
const hash=(pass,salt)=>crypto.scryptSync(pass,salt,32).toString('hex');
export function register(store,name,pass){
 if(!okName(name))return {ok:false,msg:'名字要 2～12 個字，不能有空白和斜線。'};if(!okPass(pass))return {ok:false,msg:'密碼要 4～64 個字。'};
 if(store.get(key(name)).exists)return {ok:false,msg:'這個名字有人用了。'};
 const salt=crypto.randomBytes(16).toString('hex'),uid='u_'+crypto.randomBytes(8).toString('hex');
 store.set(key(name),{name,salt,hash:hash(pass,salt),uid,t:Date.now()});
 return {ok:true,...issue(store,uid,name)};
}
export function login(store,name,pass){
 const u=store.get(key(String(name||''))).data;if(!u||!okPass(pass)||hash(pass,u.salt)!==u.hash)return {ok:false,msg:'名字或密碼不對。'};
 return {ok:true,...issue(store,u.uid,u.name)};
}
function issue(store,uid,name){const token=crypto.randomBytes(24).toString('hex');store.set('_auth/tokens/'+token,{uid,name,t:Date.now()});return {uid,name,token};}
export function whoIs(store,token){if(!token||!/^[0-9a-f]{48}$/.test(token))return null;return store.get('_auth/tokens/'+token).data||null;}
export function logout(store,token){if(token)store.delete('_auth/tokens/'+token);}
