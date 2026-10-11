import test from 'node:test';import assert from 'node:assert/strict';
import {createKeyedFetch, explainSupabaseError} from '../js/lib/supabase-fetch.js';
const URL='https://example.supabase.co', KEY='anon-key-123';
function capture(){
 let seen=null;
 const fake=async(url,options)=>{seen={url:String((url&&url.url)||url),options};return {ok:true};};
 return {fake,seen:()=>seen};
}
test('adiciona apikey e Authorization em chamadas ao projeto',async()=>{
 const c=capture();const f=createKeyedFetch(c.fake,URL,KEY);
 await f(URL+'/rest/v1/products',{headers:{'Content-Type':'application/json'}});
 assert.equal(c.seen().options.headers.apikey,KEY);
 assert.equal(c.seen().options.headers.Authorization,'Bearer '+KEY);
 assert.equal(c.seen().options.headers['Content-Type'],'application/json');
});
test('não toca em outros hosts nem sobrescreve chave existente',async()=>{
 const c=capture();const f=createKeyedFetch(c.fake,URL,KEY);
 await f('https://other.example/x',{headers:{}});
 assert.ok(!('apikey' in c.seen().options.headers));
 await f(URL+'/rest/v1/y',{headers:{apikey:'existing'}});
 assert.equal(c.seen().options.headers.apikey,'existing');
});
test('funciona com Headers nativo',async()=>{
 const c=capture();const f=createKeyedFetch(c.fake,URL,KEY);
 await f(URL+'/rest/v1/z',{headers:new Headers({'X-Custom':'1'})});
 const h=c.seen().options.headers;
 assert.ok(h instanceof Headers);
 assert.equal(h.get('apikey'),KEY);
 assert.equal(h.get('authorization'),'Bearer '+KEY);
 assert.equal(h.get('x-custom'),'1');
});
test('explica falta de apikey, loja não autorizada e repassa o resto',()=>{
 assert.match(explainSupabaseError('{"message":"No API key found in request"}'),/AdBlock/);
 assert.match(explainSupabaseError('Loja não autorizada'),/Saia e entre/);
 assert.equal(explainSupabaseError('Preço inválido'),'Preço inválido');
 assert.equal(explainSupabaseError(null),'');
});
