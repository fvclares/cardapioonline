import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
function setup(){
 const dom=new JSDOM(`<div id="floatingCartBar" class="floating-cart-bar"></div><div id="cartDrawerBackdrop"></div><div id="cartDrawerContent"></div>`,{url:'http://localhost/',runScripts:'outside-only'});const w=dom.window;
 for(const f of ['js/vendor/purify.min.js','js/lib/safe-html.js','js/components/cartDrawer.js'])w.eval(fs.readFileSync(f,'utf8'));
 const state={count:0,total:0};
 w.appState={cart:{items:[],orderType:'delivery',paymentMethod:'pix',cashChange:''},store:{min_order_value:0},
  getItemCount:()=>state.count,getTotal:()=>state.total,subscribe(fn){state.notify=fn;}};
 w.setupCartDrawer(()=>{});
 return {dom,w,state};
}
test('floating bar hidden when cart empty',()=>{
 const {dom,w}=setup();try{
  assert.equal(w.document.getElementById('floatingCartBar').classList.contains('visible'),false);
  assert.equal(w.document.querySelector('#btnOpenCart'),null);
 }finally{dom.window.close();}
});
test('floating bar shows quantity badge and total, pops on change',()=>{
 const {dom,w,state}=setup();try{
  state.count=2;state.total=100;state.notify();
  const bar=w.document.getElementById('floatingCartBar');
  assert.equal(bar.classList.contains('visible'),true);
  assert.equal(bar.querySelector('.cart-badge-count').textContent,'2');
  assert.match(bar.querySelector('#btnOpenCart').textContent,/100/);
  assert.ok(bar.querySelector('#btnOpenCart').classList.contains('pop'));
  state.count=3;state.total=150;state.notify();
  assert.equal(bar.querySelector('.cart-badge-count').textContent,'3');
  // drawer não abre sozinho ao atualizar a barra
  assert.equal(w.document.getElementById('cartDrawerBackdrop').classList.contains('active'),false);
  state.count=0;state.total=0;state.notify();
  assert.equal(bar.classList.contains('visible'),false);
 }finally{dom.window.close();}
});
test('adding product or combo never auto-opens the drawer',()=>{
 for(const f of ['js/components/productModal.js','js/components/offers.js']){
  assert.ok(!fs.readFileSync(f,'utf8').includes("dispatchEvent(new CustomEvent('open_cart'))"),f);
 }
});
