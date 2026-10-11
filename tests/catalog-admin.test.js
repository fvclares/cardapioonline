import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
import {validateProductPrices} from '../js/lib/product-prices.js';
import {explainSupabaseError} from '../js/lib/supabase-fetch.js';
const field=(value,active=true,id='g')=>({id,value,active});
for(const [label,available,fields,valid] of [
 ['available missing',true,[field('')],false],['one size',true,[field('60,00')],true],
 ['two sizes',true,[field('60'),field('80',true,'m')],true],['empty not offered',true,[field(''),field('80',true,'m')],true],
 ['inactive only',true,[field('60',false)],false],['unavailable no price',false,[field('')],true],
 ...[0,-1,NaN,Infinity,'0,00','-10','NaN','Infinity','abc','12abc','1,234'].map(v=>['invalid '+v,true,[field(v)],false])
])test('admin '+label,()=>{const r=validateProductPrices(true,available,fields);assert.equal(Object.keys(r.errors).length===0,valid);if(label==='empty not offered')assert.equal(r.prices.length,1);});
test('ordinary product requires no size',()=>assert.deepEqual(validateProductPrices(false,true,[]),{errors:{},prices:[]}));
function setup(){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost/',runScripts:'outside-only'});const w=dom.window;
 const pizza={id:'p',name:'Pizza',price:1,base_price:1,is_pizza:true,category_id:'c',available:true};
 const drink={id:'d',name:'Drink',price:10,is_pizza:false,category_id:'c',available:true};
 w.appState={products:[pizza,drink],categories:[{id:'c',name:'Menu'}],addonGroups:{},pizzaSizes:[{id:'g',name:'Grande',is_active:true,max_flavors:2},{id:'m',name:'Media',is_active:true,max_flavors:2},{id:'off',name:'Off',is_active:false,max_flavors:2}],productSizePrices:[{product_id:'p',size_id:'g',price:60},{product_id:'p',size_id:'off',price:2}],cart:{items:[]},addItem(item){this.cart.items.push(item);}};
 for(const f of ['js/vendor/purify.min.js','js/lib/safe-html.js','js/components/productCard.js','js/components/productModal.js','js/components/carousel.js'])w.eval(fs.readFileSync(f,'utf8'));
 return {dom,w,pizza,drink};
}
test('catalog only offers associated active size; correct price, no base fallback',()=>{
 const {dom,w,pizza}=setup();try{w.setupProductModal().openModal(pizza);assert.equal(w.document.querySelectorAll('.size-option').length,1);assert.equal(w.document.querySelector('.size-option').dataset.sizeId,'g');assert.equal(w.document.querySelector('#btnModalPriceTotal').textContent,'R$ 60');w.document.querySelector('#btnConfirmAddToCart').click();assert.equal(w.appState.cart.items.length,1);}finally{dom.window.close();}
});
test('two valid sizes and compatible flavors only',()=>{
 const {dom,w,pizza}=setup();try{
  w.appState.productSizePrices.push({product_id:'p',size_id:'m',price:45});
  w.appState.products.push({...pizza,id:'f',name:'Missing flavor price'});
  w.setupProductModal().openModal(pizza);assert.equal(w.document.querySelectorAll('.size-option').length,2);
  assert.equal(w.document.querySelectorAll('option[value="f"]').length,0);
 }finally{dom.window.close();}
});
test('legacy pizza stays visible as unavailable; no purchase; ordinary product works',()=>{
 const {dom,w,pizza,drink}=setup();try{
 w.appState.productSizePrices=[];let clicks=0;w.renderProductSections(w.document.getElementById('menuContainer'),'',()=>clicks++);
 assert.match(w.document.querySelector('[data-product-id="p"]').textContent,/Indisponível/);
 w.document.querySelector('[data-product-id="p"]').click();assert.equal(clicks,0);
 w.setupProductModal().openModal(pizza);assert.equal(w.document.querySelector('#btnConfirmAddToCart'),null);
 w.setupProductModal().openModal(drink);assert.equal(w.document.querySelector('#btnModalPriceTotal').textContent,'R$ 10');
 }finally{dom.window.close();}
});
test('carousel does not use legacy base price',()=>{const {dom,w,pizza}=setup();try{w.appState.productSizePrices=[];assert.equal(w.getCarouselDisplayPrice(pizza),null);}finally{dom.window.close();}});

async function adminHarness({failSave=false,failRead=false}={}){
 const dom=new JSDOM(fs.readFileSync('admin.html','utf8'),{url:'http://localhost/',runScripts:'outside-only'}),w=dom.window;
 for(const f of ['js/vendor/purify.min.js','js/lib/safe-html.js'])w.eval(fs.readFileSync(f,'utf8'));
 let handler;const calls=[],messages=[];
 w.document.getElementById('productForm').addEventListener=(name,fn)=>{if(name==='submit')handler=fn;};
 Object.assign(w,{validateProductPrices,explainSupabaseError,currentStoreId:'shop',showLoading:()=>{},showToast:(message,type)=>messages.push({message,type}),closeProductModal:()=>{},renderProducts:async()=>{},formatCurrencyInput:v=>Number(v).toFixed(2).replace('.',','),parseCurrency:v=>Number(String(v).replace(',','.')),
 productsApi:{listAdmin:async()=>({data:[]})},pizzaSizesApi:{listAll:async()=>({data:[{id:'g',name:'Grande',is_active:true,slices:8,max_flavors:2},{id:'off',name:'Inativo',is_active:false,slices:6,max_flavors:1}],error:failRead?{message:'offline'}:null})},productSizePricesApi:{listByProduct:async()=>({data:[]})},supabase:{rpc:async(name,payload)=>{calls.push({name,payload});return {error:failSave?{message:'Simulated transaction failure'}:null};}}});
 const src=fs.readFileSync('js/admin-supabase.js','utf8');
 const start=src.indexOf("document.getElementById('productForm').addEventListener('submit'");const end=src.indexOf('\nasync function deleteProduct',start);
 w.eval(src.slice(start,end));
 const renderStart=src.indexOf('async function renderProdSizePrices(');const renderEnd=src.indexOf('// ============================================',renderStart);
 w.eval(src.slice(renderStart,renderEnd));await w.renderProdSizePrices(null);
 const d=w.document;d.getElementById('prodIsPizzaInput').checked=true;d.getElementById('prodAvailableInput').checked=true;d.getElementById('prodCodigoInput').value='101';d.getElementById('prodNameInput').value='Pizza';d.getElementById('prodCategorySelect').innerHTML='<option value="category">Category</option>';
 return {dom,w,calls,messages,submit:()=>handler({preventDefault(){}})};
}
test('actual admin form keeps missing prices empty and marks inactive sizes',async()=>{
 const h=await adminHarness();try{const d=h.w.document;assert.equal(d.querySelector('[data-size-id="g"]').value,'');assert.match(d.getElementById('prodSizePricesFields').textContent,/Inativo/);await h.submit();assert.equal(h.calls.length,0);assert.match(d.getElementById('prodSizePricesError').textContent,/tamanho ativo/);}finally{h.dom.window.close();}
});
test('actual admin form places error by invalid field and never deletes it',async()=>{
 const h=await adminHarness();try{const d=h.w.document;d.querySelector('[data-size-id="g"]').value='abc';await h.submit();assert.equal(h.calls.length,0);assert.match(d.getElementById('price-error-g').textContent,/maior que zero/);assert.equal(d.querySelector('[data-size-id="g"]').value,'abc');}finally{h.dom.window.close();}
});
test('actual admin form sends one atomic RPC, excludes empty sizes, waits for success',async()=>{
 const h=await adminHarness();try{h.w.document.querySelector('[data-size-id="g"]').value='60,00';await h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'save_product_with_prices');assert.deepEqual(h.calls[0].payload.p_prices,[{size_id:'g',price:60}]);assert.equal(h.messages.filter(x=>x.type==='success').length,1);}finally{h.dom.window.close();}
});
test('actual admin form never announces success after failed transaction',async()=>{
 const h=await adminHarness({failSave:true});try{h.w.document.querySelector('[data-size-id="g"]').value='60,00';await h.submit();assert.equal(h.messages.filter(x=>x.type==='success').length,0);assert.match(h.w.document.getElementById('prodSizePricesError').textContent,/Simulated transaction failure/);}finally{h.dom.window.close();}
});
test('actual admin form cannot overwrite catalog after loading failure',async()=>{
 const h=await adminHarness({failRead:true});try{await h.submit();assert.equal(h.calls.length,0);assert.match(h.w.document.getElementById('prodSizePricesError').textContent,/carregar/);}finally{h.dom.window.close();}
});

test('real cart method: ordinary, sized pizza, halves, crusts and extras retain prices',()=>{
 const src=fs.readFileSync('js/state/store.js','utf8');const method=src.slice(src.indexOf('  addItem(itemPayload) {'),src.indexOf('  updateQuantity(itemId, delta) {'));
 const add=new Function('return ({'+method+'}).addItem')();
 const state={pizzaSizes:[{id:'g',is_active:true}],productSizePrices:[{product_id:'p',size_id:'g',price:60},{product_id:'f',size_id:'g',price:80}],cart:{items:[]},notify(){}};
 const pizza={id:'p',name:'Pizza A',price:0,is_pizza:true},flavor={id:'f',name:'Pizza B',price:0,is_pizza:true};
 assert.equal(add.call(state,{product:{id:'d',name:'Drink',price:10},quantity:2}).itemTotal,20);
 assert.equal(add.call(state,{product:pizza,size:{id:'g',name:'Grande'},crust:{id:'c',name:'Borda',price:8},extras:[{id:'e',name:'Extra',price:4}]}).unitPrice,72);
 assert.equal(add.call(state,{product:pizza,size:{id:'g',name:'Grande'},_allFlavors:[flavor]}).unitPrice,80);
 assert.equal(add.call(state,{product:pizza,size:{id:'g',name:'Grande'},fraction:{value:0.5,numerator:1,denominator:2,label:'Meia'}}).itemTotal,30);
 const length=state.cart.items.length;assert.throws(()=>add.call(state,{product:pizza}),/preço válido/);assert.equal(state.cart.items.length,length);
});
test('fixed half displays the fixed value, not the proportional half',()=>{
 const src=fs.readFileSync('js/state/store.js','utf8');const method=src.slice(src.indexOf('  addItem(itemPayload) {'),src.indexOf('  updateQuantity(itemId, delta) {'));
 const add=new Function('return ({'+method+'}).addItem')();
 const state={pizzaSizes:[{id:'g',is_active:true}],productSizePrices:[{product_id:'p',size_id:'g',price:65}],cart:{items:[]},notify(){},
  getProductFractionConfig:()=>({mode:'fixed',fixed:50})};
 const pizza={id:'p',name:'Pizza A',price:0,is_pizza:true};
 const half=add.call(state,{product:pizza,size:{id:'g',name:'Grande'},fraction:{value:0.5,numerator:1,denominator:2,label:'Meia'}});
 assert.equal(half.itemTotal,50);
 assert.equal(half.fractionMode,'fixed');
 const quarter=add.call(state,{product:pizza,size:{id:'g',name:'Grande'},fraction:{value:0.25,numerator:1,denominator:4,label:'1/4'}});
 assert.equal(quarter.itemTotal,25);
});
