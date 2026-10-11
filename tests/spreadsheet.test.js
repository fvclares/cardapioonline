import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
import {validateProductPrices} from '../js/lib/product-prices.js';
async function harness({prices, onRpc}={}){
 const dom=new JSDOM(fs.readFileSync('admin.html','utf8'),{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
 for(const f of ['js/vendor/purify.min.js','js/lib/safe-html.js'])w.eval(fs.readFileSync(f,'utf8'));
 const calls=[],messages=[],opened=[];
 const cats=[{id:'c1',name:'Entradas'},{id:'c2',name:'Pizzas'}];
 const sizes=[{id:'g',name:'G (8 fatias)',slices:8,max_flavors:2,is_active:true},{id:'m',name:'M (6 fatias)',slices:6,max_flavors:2,is_active:true}];
 const prods=[
  {id:'p1',codigo:101,name:'Charque',category_id:'c2',base_price:65,description:'d',image_url:'',is_pizza:true,has_crusts:true,has_extras:true,available:true,is_featured:false,featured_order:1,fraction_pricing_mode:'fixed',categories:{name:'Pizzas'}},
  {id:'p2',codigo:102,name:'Mussarela',category_id:'c2',base_price:60,description:'',image_url:'',is_pizza:true,has_crusts:true,has_extras:true,available:true,is_featured:false,featured_order:1,fraction_pricing_mode:'max',categories:{name:'Pizzas'}},
  {id:'d1',codigo:1,name:'Suco',category_id:'c1',base_price:10,description:'',image_url:'',is_pizza:false,has_crusts:false,has_extras:false,available:true,is_featured:false,featured_order:1,categories:{name:'Entradas'}},
 ];
 const priceRows=prices||[
  {product_id:'p1',size_id:'g',price:65,fraction_fixed_price:50},
  {product_id:'p1',size_id:'m',price:70,fraction_fixed_price:55},
  {product_id:'p2',size_id:'g',price:60,fraction_fixed_price:null},
 ];
 Object.assign(w,{validateProductPrices,currentStoreId:'shop',
  showLoading:()=>{},showToast:(m,t)=>messages.push({m,t}),renderProducts:async()=>{},
  openProductModal:(id)=>opened.push(id),
  formatCurrencyInput:v=>Number(v).toFixed(2).replace('.',','),formatCurrency:v=>'R$'+Number(v).toFixed(2),
  parseCurrency:v=>Number(String(v).replace(',','.')),
  categoriesApi:{list:async()=>({data:cats})},
  productsApi:{listAdmin:async()=>({data:prods}),update:async()=>({error:null})},
  pizzaSizesApi:{listAll:async()=>({data:sizes})},
  productSizePricesApi:{listByStore:async()=>({data:priceRows})},
  supabase:{rpc:async(n,p)=>{calls.push({n,p});if(onRpc)onRpc(p);return {data:{id:p.p_product_id,base_price:60},error:null};},
   from:()=>({upsert:async()=>({error:null})})}});
 const src=fs.readFileSync('js/admin-supabase.js','utf8');
 const start=src.indexOf('// PLANILHA (edição rápida em tabela)');
 const end=src.indexOf('// ============================================\n// PEDIDOS');
 w.eval(src.slice(start,end));
 return {dom,w,calls,messages,opened,prods};
}
test('planilha lista todos com colunas por tamanho e fixo visível só no fixed',async()=>{
 const h=await harness();try{
  await h.w.renderSpreadsheet();
  const rows=h.w.document.querySelectorAll('#spreadsheetContainer tbody tr');
  assert.equal(rows.length,3);
  const p1=h.w.document.querySelector('tr[data-prod-id="p1"]');
  assert.equal(p1.querySelector('[data-f="name"]').value,'Charque');
  assert.equal(p1.querySelector('[data-fixed-for="g"]').value,'50,00');
  assert.notEqual(p1.querySelector('[data-fixed-wrap="g"]').style.display,'none');
  const p2=h.w.document.querySelector('tr[data-prod-id="p2"]');
  assert.equal(p2.querySelector('[data-fixed-wrap="g"]').style.display,'none');
  const d1=h.w.document.querySelector('tr[data-prod-id="d1"]');
  assert.equal(d1.querySelector('[data-f="base_price"]').value,'10,00');
 }finally{h.dom.window.close();}
});
test('editar marca suja e habilita salvar tudo; salvar chama RPC',async()=>{
 const h=await harness();try{
  await h.w.renderSpreadsheet();
  const btn=h.w.document.getElementById('btnSaveAllSheet');
  assert.equal(btn.disabled,true);
  const name=h.w.document.querySelector('tr[data-prod-id="d1"] [data-f="name"]');
  name.value='Suco de Maracujá';name.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  assert.ok(h.w.document.querySelector('tr[data-prod-id="d1"]').classList.contains('sheet-dirty'));
  assert.equal(btn.disabled,false);
  assert.equal(h.w.document.getElementById('sheetDirtyCount').textContent,'1');
  const ok=await h.w.saveSpreadsheetRow('d1');
  assert.equal(ok,true);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].p.p_product.name,'Suco de Maracujá');
  assert.equal(h.w.document.querySelector('tr[data-prod-id="d1"]').classList.contains('sheet-dirty'),false);
 }finally{h.dom.window.close();}
});
test('modo fixed sem fixo bloqueia salvamento',async()=>{
 const h=await harness();try{
  await h.w.renderSpreadsheet();
  h.w.document.querySelector('tr[data-prod-id="p1"] [data-fixed-for="g"]').value='';
  const ok=await h.w.saveSpreadsheetRow('p1');
  assert.equal(ok,false);
  assert.equal(h.calls.length,0);
  const err=h.w.document.querySelector('tr[data-prod-id="p1"] input[data-fixed-for="g"] + .sheet-row-error');
  assert.match(err.textContent,/fixo/);
 }finally{h.dom.window.close();}
});
test('modo fixed envia fixo por tamanho e max no nível do produto',async()=>{
 const h=await harness();try{
  await h.w.renderSpreadsheet();
  const ok=await h.w.saveSpreadsheetRow('p1');
  assert.equal(ok,true);
  assert.equal(h.calls[0].p.p_product.fraction_pricing_mode,'fixed');
  assert.equal(h.calls[0].p.p_product.fraction_fixed_price,55);
  assert.deepEqual(h.calls[0].p.p_prices,[
   {size_id:'g',price:65,fraction_fixed_price:50},
   {size_id:'m',price:70,fraction_fixed_price:55},
  ]);
 }finally{h.dom.window.close();}
});
test('filtro por categoria reduz as linhas',async()=>{
 const h=await harness();try{
  await h.w.renderSpreadsheet();
  h.w.document.getElementById('sheetFilterCategory').value='c1';
  await h.w.renderSpreadsheet();
  assert.equal(h.w.document.querySelectorAll('#spreadsheetContainer tbody tr').length,1);
 }finally{h.dom.window.close();}
});
