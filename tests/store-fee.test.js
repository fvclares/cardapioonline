import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
function setup(){
 const dom=new JSDOM('',{url:'http://localhost/',runScripts:'outside-only'});const w=dom.window;
 w.eval(fs.readFileSync('js/state/store.js','utf8'));
 return {dom,w};
}
function cartState(w,{byStore,orderType='delivery',neighborhood=null}){
 w.appState.store={id:'s',name:'Loja',default_delivery_fee:7,settings:byStore?{delivery_fee_by_store:true}:{}};
 w.appState.cart={items:[{unitPrice:10,quantity:2,fractionValue:1}],orderType,neighborhood,paymentMethod:'pix',cashChange:'',notes:''};
}
test('taxa pela loja: fee null, total parcial com aviso',()=>{
 const {dom,w}=setup();try{
  cartState(w,{byStore:true});
  assert.equal(w.appState.isDeliveryFeeByStore(),true);
  assert.equal(w.appState.getDeliveryFee(),null);
  assert.equal(w.appState.getSubtotal(),20);
  assert.equal(w.appState.getTotal(),20);
  assert.match(w.appState.getTotalNote(),/combinar/);
 }finally{dom.window.close();}
});
test('modo normal: taxa padrão e total cheio, sem aviso',()=>{
 const {dom,w}=setup();try{
  cartState(w,{byStore:false});
  assert.equal(w.appState.isDeliveryFeeByStore(),false);
  assert.equal(w.appState.getDeliveryFee(),7);
  assert.equal(w.appState.getTotal(),27);
  assert.equal(w.appState.getTotalNote(),'');
 }finally{dom.window.close();}
});
test('retirada ignora o modo taxa-pela-loja',()=>{
 const {dom,w}=setup();try{
  cartState(w,{byStore:true,orderType:'pickup'});
  assert.equal(w.appState.getDeliveryFee(),0);
  assert.equal(w.appState.getTotal(),20);
  assert.equal(w.appState.getTotalNote(),'');
 }finally{dom.window.close();}
});
