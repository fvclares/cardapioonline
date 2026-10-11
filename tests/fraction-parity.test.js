import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
import {priceOrder} from '../supabase/functions/_shared/pricing.js';
// Paridade: subtotal do carrinho (store.js) deve igualar o do servidor (pricing.js)
// a menos de meio centavo, para pizzas fracionadas completas.
const SIZES=[
 {id:'g',name:'G (8 fatias)',slices:8,max_flavors:2,is_active:true,display_order:1},
 {id:'f',name:'F (12 fatias)',slices:12,max_flavors:4,is_active:true,display_order:2},
 {id:'t',name:'T (10 fatias)',slices:10,max_flavors:3,is_active:true,display_order:3},
];
const PRODS=[
 {id:'a',name:'Pizza A',price:0,base_price:0,codigo:1,is_pizza:true,has_crusts:true,has_extras:true,available:true,fraction_pricing_mode:'fixed'},
 {id:'b',name:'Pizza B',price:0,base_price:0,codigo:2,is_pizza:true,has_crusts:true,has_extras:true,available:true,fraction_pricing_mode:'max'},
 {id:'c',name:'Pizza C',price:0,base_price:0,codigo:3,is_pizza:true,has_crusts:true,has_extras:true,available:true,fraction_pricing_mode:'average'},
 {id:'d',name:'Pizza D',price:0,base_price:0,codigo:4,is_pizza:true,has_crusts:true,has_extras:true,available:true},
];
const PRICES=[
 {product_id:'a',size_id:'g',price:65,fraction_fixed_price:50},
 {product_id:'a',size_id:'f',price:80,fraction_fixed_price:62.5},
 {product_id:'a',size_id:'t',price:72,fraction_fixed_price:55},
 {product_id:'b',size_id:'g',price:68,fraction_fixed_price:null},
 {product_id:'b',size_id:'f',price:90,fraction_fixed_price:null},
 {product_id:'b',size_id:'t',price:75,fraction_fixed_price:null},
 {product_id:'c',size_id:'g',price:60,fraction_fixed_price:null},
 {product_id:'c',size_id:'f',price:70,fraction_fixed_price:null},
 {product_id:'c',size_id:'t',price:66,fraction_fixed_price:null},
 {product_id:'d',size_id:'g',price:55,fraction_fixed_price:null},
 {product_id:'d',size_id:'f',price:77.33,fraction_fixed_price:null},
 {product_id:'d',size_id:'t',price:61,fraction_fixed_price:null},
];
const ADDONS=[
 {id:'crust',name:'Borda',group_id:'gb',group_name:'Bordas',price_diff:8,cumulative:true,group_max_free:null,group_category_ids:[]},
 {id:'extra',name:'Queijo',group_id:'ge',group_name:'Extras',price_diff:4,cumulative:true,group_max_free:null,group_category_ids:[]},
];
const CRUST={id:'crust',name:'Borda',price:8};
const EXTRA={id:'extra',name:'Queijo',price:4,quantity:1,groupId:'ge'};
function setup(){
 const dom=new JSDOM('',{url:'http://localhost/',runScripts:'outside-only'});const w=dom.window;
 w.eval(fs.readFileSync('js/state/store.js','utf8'));
 w.appState.products=PRODS.map(p=>({...p}));
 w.appState.pizzaSizes=SIZES.map(s=>({...s}));
 w.appState.productSizePrices=PRICES.map(p=>({...p}));
 w.appState.cart={items:[],orderType:'pickup',neighborhood:null,paymentMethod:'pix',cashChange:'',notes:''};
 return {dom,w};
}
const FV={2:0.5,3:1/3,4:0.25};
const FL={2:'Meia',3:'1/3',4:'1/4'};
// parts: [{pid, den, crust?, extras?}] — soma das frações deve fechar pizzas inteiras por tamanho
function check(parts,sizeId){
 const {dom,w}=setup();try{
  const size=SIZES.find(s=>s.id===sizeId);
  for(const pt of parts){
   const prod=PRODS.find(p=>p.id===pt.pid);
   w.appState.addItem({product:{...prod},size:{...size},quantity:pt.qty||1,
    crust:pt.crust?{...CRUST}:null,extras:pt.extras?[{...EXTRA}]:[],
    observation:'',fraction:{value:FV[pt.den],numerator:1,denominator:pt.den,label:FL[pt.den]}});
  }
  const client=w.appState.getSubtotal();
  const inItems=[];
  for(const pt of parts){
   for(let i=0;i<(pt.qty||1);i++) inItems.push({productId:pt.pid,size:{id:sizeId},fractionValue:FV[pt.den],quantity:1,
    ...(pt.crust?{crust:{id:'crust'}}:{}),...(pt.extras?{extras:[{id:'extra',quantity:1}]}:{})});
  }
  const server=priceOrder({items:inItems,orderType:'pickup',
   customer:{name:'Teste',phone:'85999999999'},payment:{method:'pix'},total:0},
   {store:{id:'s',name:'L',phone:'1',default_delivery_fee:0,min_order_value:0},settings:{},
    products:PRODS,sizes:SIZES,prices:PRICES,addons:ADDONS,offers:[],neighborhoods:[]});
  const diff=Math.abs(client-server.subtotal);
  assert.ok(diff<=0.001,'diff '+diff.toFixed(4)+' client='+client+' server='+server.subtotal+' '+JSON.stringify(parts));
 }finally{dom.window.close();}
}
test('fixa + max (50 + 34)',()=>check([{pid:'a',den:2},{pid:'b',den:2}],'g'));
test('duas fixas (50 + 50)',()=>check([{pid:'a',den:2},{pid:'a',den:2}],'g'));
test('max + max (68)',()=>check([{pid:'b',den:2},{pid:'d',den:2}],'g'));
test('average + average',()=>check([{pid:'c',den:2},{pid:'d',den:2}],'g'));
test('quartos fixos (4 x 25)',()=>check([{pid:'a',den:4},{pid:'a',den:4},{pid:'a',den:4},{pid:'a',den:4}],'f'));
test('terços mistos',()=>check([{pid:'a',den:3},{pid:'b',den:3},{pid:'c',den:3}],'t'));
test('quarto fixo + quarto max + meia average',()=>check([{pid:'a',den:4},{pid:'b',den:4},{pid:'c',den:2}],'f'));
test('quantidades > 1',()=>check([{pid:'a',den:2,qty:2},{pid:'b',den:2,qty:2}],'g'));
test('borda em uma metade',()=>check([{pid:'a',den:2,crust:true},{pid:'b',den:2}],'g'));
test('extra em uma metade',()=>check([{pid:'b',den:2,extras:true},{pid:'d',den:2}],'g'));
test('duas pizzas completas (4 meias)',()=>check([{pid:'a',den:2},{pid:'b',den:2},{pid:'c',den:2},{pid:'d',den:2}],'g'));
test('preço quebrado 77.33',()=>check([{pid:'d',den:2},{pid:'b',den:2}],'f'));
test('fixo quebrado 62.5',()=>check([{pid:'a',den:2},{pid:'d',den:2}],'f'));
// fluxo combinado legado (pizza inteira multi-sabor, fractionValue 1)
function checkCombined(pids,sizeId){
 const {dom,w}=setup();try{
  const size=SIZES.find(s=>s.id===sizeId);
  const [first,...rest]=pids;
  w.appState.addItem({product:{...PRODS.find(p=>p.id===first)},size:{...size},quantity:1,
   crust:null,extras:[],observation:'',_allFlavors:rest.map(id=>({...PRODS.find(p=>p.id===id)}))});
  const client=w.appState.getSubtotal();
  const server=priceOrder({items:[{productId:first,size:{id:sizeId},flavorIds:rest,quantity:1}],orderType:'pickup',
   customer:{name:'Teste',phone:'85999999999'},payment:{method:'pix'},total:0},
   {store:{id:'s',name:'L',phone:'1',default_delivery_fee:0,min_order_value:0},settings:{},
    products:PRODS,sizes:SIZES,prices:PRICES,addons:ADDONS,offers:[],neighborhoods:[]});
  const diff=Math.abs(client-server.subtotal);
  assert.ok(diff<=0.001,'diff '+diff.toFixed(4)+' client='+client+' server='+server.subtotal);
 }finally{dom.window.close();}
}
test('combinada max (68)',()=>checkCombined(['b','a'],'g'));
test('combinada average quebrada (83.67)',()=>checkCombined(['d','b'],'f'));
test('combinada fixa (50 + 34 = 84)',()=>checkCombined(['a','b'],'g'));
test('combinada fixa terços',()=>checkCombined(['a','b','c'],'t'));
test('combo preserva preço do catálogo',()=>{
 const {dom,w}=setup();try{
  const offer={id:'combo',name:'Combo',price:70};
  const groups=[{groupId:'group',groupName:'Pizza',quantity:1,items:[{product_id:'a',name:'Pizza A',extra_price:2}]}];
  w.appState.addOffer({offer,groups,total:72});
  const client=w.appState.getSubtotal();
  const server=priceOrder({items:[{isOffer:true,offerId:'combo',quantity:1,offerGroups:[{groupId:'group',items:[{product_id:'a'}]}]}],
   orderType:'pickup',customer:{name:'Teste',phone:'85999999999'},payment:{method:'pix'},total:0},
   {store:{id:'s',name:'L',phone:'1',default_delivery_fee:0,min_order_value:0},settings:{},
    products:PRODS,sizes:SIZES,prices:PRICES,addons:ADDONS,
    offers:[{id:'combo',name:'Combo',active:true,price:70,max_per_order:2,groups:[{id:'group',name:'Pizza',quantity:1,offer_group_items:[{product_id:'a',extra_price:2}]}]}],
    neighborhoods:[]});
  assert.ok(Math.abs(client-server.subtotal)<=0.001,'client='+client+' server='+server.subtotal);
 }finally{dom.window.close();}
});
// varredura pseudo-aleatória com seed fixa
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
test('sweep aleatório (200 casos)',()=>{
 const rnd=mulberry32(42);
 const dens={g:[2],f:[2,4],t:[2,3]};
 const pids=['a','b','c','d'];
 for(let k=0;k<200;k++){
  const sizeId=['g','f','t'][Math.floor(rnd()*3)];
  const den=dens[sizeId][Math.floor(rnd()*dens[sizeId].length)];
  const perPizza=den; // nº de partes por pizza
  const pizzas=1+Math.floor(rnd()*2);
  const parts=[];
  for(let q=0;q<pizzas*perPizza;q++){
   const pt={pid:pids[Math.floor(rnd()*4)],den};
   if(rnd()<0.25)pt.crust=true;
   if(rnd()<0.25)pt.extras=true;
   parts.push(pt);
  }
  check(parts,sizeId);
 }
});
