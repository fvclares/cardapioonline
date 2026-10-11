import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
function setup(){
 const dom=new JSDOM('',{url:'http://localhost/',runScripts:'outside-only'});const w=dom.window;
 w.eval(fs.readFileSync('js/state/store.js','utf8'));
 return {dom,w};
}
test('refreshCartPrices atualiza itens com o catálogo novo (pós-409)',async()=>{
 const {dom,w}=setup();try{
  const P1=[{id:'p',name:'Pizza A',price:0,base_price:0,is_pizza:true,has_crusts:false,has_extras:false,available:true}];
  const SZ=[{id:'g',name:'G',is_active:true,max_flavors:1}];
  let prices=[{product_id:'p',size_id:'g',price:60}];
  w.storage={storeId:'s',useLocalFallback:false,
   init:async()=>{prices=[{product_id:'p',size_id:'g',price:70}];},
   getStore:()=>({id:'s',name:'L',default_delivery_fee:7,settings:{}}),
   getCategories:()=>[],getProducts:()=>P1,getAddonGroups:()=>({}),
   getPizzaSizes:()=>SZ,getProductSizePrices:()=>prices,getSettings:()=>({}),
   getCustomerProfile:()=>null,getNeighborhoods:()=>[],getActiveOffers:()=>[]};
  await w.appState.refreshData();
  w.appState.addItem({product:{...P1[0]},size:{id:'g',name:'G'},quantity:1,crust:null,extras:[],observation:''});
  assert.equal(w.appState.getSubtotal(),60);
  const n=await w.appState.refreshCartPrices();
  assert.equal(n,1);
  assert.equal(w.appState.cart.items.length,1);
  assert.equal(w.appState.cart.items[0].unitPrice,70);
  assert.equal(w.appState.getSubtotal(),70);
 }finally{dom.window.close();}
});
test('checkout trata 409 atualizando a sacola',()=>{
 const src=fs.readFileSync('js/components/checkoutModal.js','utf8');
 assert.ok(src.includes('refreshCartPrices'),'checkout deve chamar refreshCartPrices no 409');
 assert.ok(src.includes('Atualizei a sacola'),'checkout deve orientar o reenvio');
});
