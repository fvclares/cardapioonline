import test from 'node:test';
import assert from 'node:assert/strict';
import {priceOrder} from '../supabase/functions/_shared/pricing.js';

const catalog=()=>({
 store:{id:'shop',name:'Fixture',phone:'5500000000000',default_delivery_fee:5,min_order_value:0},settings:{},
 products:[
  {id:'a',name:'Pizza A',is_pizza:true,base_price:0,available:true,has_crusts:true,has_extras:true},
  {id:'b',name:'Pizza B',is_pizza:true,base_price:5,available:true},
  {id:'drink',name:'Drink',is_pizza:false,base_price:10,available:true}
 ],
 sizes:[{id:'g',name:'Grande',is_active:true,max_flavors:4},{id:'m',name:'Média',is_active:true,max_flavors:2},{id:'off',name:'Desabilitado',is_active:false,max_flavors:2}],
 prices:[{product_id:'a',size_id:'g',price:60},{product_id:'b',size_id:'g',price:80},{product_id:'b',size_id:'m',price:45},{product_id:'a',size_id:'off',price:20}],
 addons:[{id:'crust',name:'Borda',group_name:'Bordas',price_diff:8},{id:'extra',name:'Adicional',group_name:'Extras',price_diff:4}],
 offers:[{id:'combo',name:'Combo',active:true,price:70,max_per_order:2,groups:[{id:'group',name:'Pizza',quantity:1,offer_group_items:[{product_id:'a',extra_price:2}]}]}],
 neighborhoods:[]
});
const item=(productId='a')=>({productId,size:{id:'g'},quantity:1});
const order=(items=[item()])=>({items,orderType:'pickup',customer:{name:'Test fixture',phone:'5500000000000'},payment:{method:'pix'},total:60});

test('original exploit: same pizza costs 60 with size and is rejected without size, never base zero',()=>{
 const c=catalog();assert.equal(priceOrder(order(),c).total,60);
 assert.throws(()=>priceOrder(order([{productId:'a',quantity:1}]),c),/tamanho/);
});
for(const size of [null,{},'',{id:''},{id:'unknown'},{id:'off'},{id:'m'},'g',0]){
 test('rejects missing/invalid/unassociated size '+JSON.stringify(size),()=>{
  assert.throws(()=>priceOrder(order([{...item(),size}]),catalog()),/tamanho/i);
 });
}
test('disabled size remains unavailable even when persisted price exists',()=>{
 const c=catalog();c.sizes[0].is_active=false;assert.throws(()=>priceOrder(order(),c),/tamanho/);
});
for(const base of [0,1,59,999]){
 test('configured size price wins over base '+base,()=>{
  const c=catalog();c.products[0].base_price=base;assert.equal(priceOrder(order(),c).total,60);
 });
}
test('base-priced ordinary product needs no size',()=>{
 assert.equal(priceOrder(order([{productId:'drink',quantity:2}]),catalog()).total,20);
});
test('ordinary product cannot receive invented size',()=>{
 assert.throws(()=>priceOrder(order([{productId:'drink',size:{id:'g'},quantity:1}]),catalog()),/Tamanho/);
});
test('missing price record cannot fall back to positive base',()=>{
 const c=catalog();c.products[0].base_price=50;c.prices=[];
 assert.throws(()=>priceOrder(order(),c),/indisponível/);
});
for(const value of [null,undefined,-1,0,NaN,Infinity,-Infinity,'60','',true,Number.MAX_VALUE]){
 test('invalid size price rejected '+String(value),()=>{
  const c=catalog();c.prices[0].price=value;assert.throws(()=>priceOrder(order(),c),/Preço/);
 });
}
for(const value of [0,-1,51,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER,'1',null,true]){
 test('invalid quantity rejected '+String(value),()=>{
  assert.throws(()=>priceOrder(order([{...item(),quantity:value}]),catalog()),/Quantidade/);
 });
}
for(const value of [0,-0.5,0.5000001,NaN,Infinity,'0.5',null]){
 test('invalid or approximate fraction rejected '+String(value),()=>{
  assert.throws(()=>priceOrder(order([{...item(),fractionValue:value}]),catalog()),/Fração/);
 });
}
test('client economic fields never set chargeable amounts',()=>{
 const o=order([{...item(),unitPrice:0,price:-10,itemTotal:0,size:{id:'g',price:0},discount:999}]);
 o.subtotal=0;o.total=0;o.discount=999;
 const r=priceOrder(o,catalog());assert.equal(r.total,60);assert.equal(r.subtotal,60);assert.equal(r.items[0].unitPrice,60);
});
test('legitimate crust and extra use persisted prices',()=>{
 const r=priceOrder(order([{...item(),crust:{id:'crust',price:-999},extras:[{id:'extra',price:0}]}]),catalog());
 assert.equal(r.total,72);
});
for(const bad of [null,-1,NaN,Infinity,'8']){
 test('invalid persisted addon price cannot lower total '+String(bad),()=>{
  const c=catalog();c.addons[0].price_diff=bad;
  assert.throws(()=>priceOrder(order([{...item(),crust:{id:'crust'}}]),c),/Preço/);
 });
}
test('combined flavors preserve highest price',()=>{
 assert.equal(priceOrder(order([{...item(),flavorIds:['b']}]),catalog()).total,80);
});
for(const mode of ['max','proportional']){
 test('separate halves preserve '+mode+' rule',()=>{
  const c=catalog();c.settings.fraction_pricing_mode=mode;
  const r=priceOrder(order([{...item(),fractionValue:0.5},{...item('b'),fractionValue:0.5}]),c);
  assert.equal(r.total,mode==='max'?80:70);
 });
}
test('fixed half is summed with the other half (50 + 40 = 90)',()=>{
 const c=catalog();
 c.products[0].fraction_pricing_mode='fixed';
 c.prices[0].fraction_fixed_price=50;
 const r=priceOrder(order([{...item(),fractionValue:0.5},{...item('b'),fractionValue:0.5}]),c);
 assert.equal(r.total,90);
});
test('two fixed halves are summed (50 + 55 = 105)',()=>{
 const c=catalog();
 c.products[0].fraction_pricing_mode='fixed';
 c.products[1].fraction_pricing_mode='fixed';
 c.prices[0].fraction_fixed_price=50;
 c.prices[1].fraction_fixed_price=55;
 const r=priceOrder(order([{...item(),fractionValue:0.5},{...item('b'),fractionValue:0.5}]),c);
 assert.equal(r.total,105);
});
test('fixed quarter contributes half the fixed value (4 x 25 = 100)',()=>{
 const c=catalog();
 c.products[0].fraction_pricing_mode='fixed';
 c.prices[0].fraction_fixed_price=50;
 const halves=Array.from({length:4},()=>({...item(),fractionValue:0.25}));
 const r=priceOrder(order(halves),c);
 assert.equal(r.total,100);
});
test('incompatible half sizes cannot complete one another',()=>{
 assert.throws(()=>priceOrder(order([{...item(),fractionValue:0.5},{...item('b'),size:{id:'m'},fractionValue:0.5}]),catalog()),/Complete/);
});
test('every combined flavor requires its own price for the chosen size',()=>{
 const c=catalog();c.prices=c.prices.filter(p=>p.product_id!=='b');
 assert.throws(()=>priceOrder(order([{...item(),flavorIds:['b']}]),c),/indisponível/);
});
for(const flavor of ['missing','drink']){
 test('invalid flavor rejected '+flavor,()=>{
  assert.throws(()=>priceOrder(order([{...item(),flavorIds:[flavor]}]),catalog()));
 });
}
test('disabled flavor cannot be ordered',()=>{
 const c=catalog();c.products[1].available=false;assert.throws(()=>priceOrder(order([{...item(),flavorIds:['b']}]),c),/indisponível/);
});
test('missing half and missing size on a half are rejected',()=>{
 assert.throws(()=>priceOrder(order([{...item(),fractionValue:0.5}]),catalog()),/Complete/);
 assert.throws(()=>priceOrder(order([{productId:'a',quantity:1,fractionValue:0.5}]),catalog()),/tamanho/);
});
test('explicit combo price is preserved independently of individual pizza pricing',()=>{
 const o=order([{isOffer:true,offerId:'combo',quantity:1,price:0,offerGroups:[{groupId:'group',items:[{product_id:'a',extra_price:0}]}]}]);
 assert.equal(priceOrder(o,catalog()).total,72);
});
test('order minimum still rejects a valid but insufficient basket',()=>{
 const c=catalog();c.settings.min_order_pickup=61;assert.throws(()=>priceOrder(order(),c),/mínimo/);
});
test('normal delivery adds server fee',()=>{
 const o=order();o.orderType='delivery';o.deliveryFee=0;o.deliveryAddress={street:'Rua',number:'1',neighborhood:'Centro'};
 assert.equal(priceOrder(o,catalog()).total,65);
});
test('monetary arithmetic uses cents for valid two-decimal prices',()=>{
 const c=catalog();c.products[2].base_price=0.29;
 assert.equal(priceOrder(order([{productId:'drink',quantity:3}]),c).total,0.87);
});
test('fractional thirds round to exact highest price in max mode',()=>{
 const c=catalog();c.prices[0].price=60.01;
 const r=priceOrder(order(Array.from({length:3},()=>({...item(),fractionValue:1/3}))),c);
 assert.equal(r.total,60.01);
});
const freeCatalog=(max,freeCount=2,paidCount=0)=>{
 const c=catalog();
 c.products.push({id:'fries',name:'Fries',is_pizza:false,base_price:15,available:true,has_extras:true});
 c.addons=[
  ...Array.from({length:freeCount},(_,i)=>({id:'free'+i,name:'Free '+i,group_id:'molho',group_name:'Adicional Molho',group_max_free:max,price_diff:0})),
  ...Array.from({length:paidCount},(_,i)=>({id:'paid'+i,name:'Paid '+i,group_id:'molho',group_name:'Adicional Molho',group_max_free:max,price_diff:5})),
 ];
 return c;
};
const friesOrder=(extras,total)=>({items:[{productId:'fries',quantity:1,extras}],orderType:'pickup',customer:{name:'Test fixture',phone:'5500000000000'},payment:{method:'pix'},total});
test('free limit of 1 rejects two free extras',()=>{
 assert.throws(()=>priceOrder(friesOrder([{id:'free0'},{id:'free1'}],15),freeCatalog(1)),/gratuitos/);
});
test('free limit of 1 accepts a single free extra',()=>{
 assert.equal(priceOrder(friesOrder([{id:'free0'}],15),freeCatalog(1)).total,15);
});
test('paid extras do not count toward the free limit',()=>{
 assert.equal(priceOrder(friesOrder([{id:'free0'},{id:'paid0'},{id:'paid1'}],25),freeCatalog(1,2,2)).total,25);
});
test('free limit of 2 accepts two free extras',()=>{
 assert.equal(priceOrder(friesOrder([{id:'free0'},{id:'free1'}],15),freeCatalog(2)).total,15);
});
test('free limit of 0 rejects any free extra',()=>{
 assert.throws(()=>priceOrder(friesOrder([{id:'free0'}],15),freeCatalog(0,1)),/gratuitos/);
});
test('groups without a free limit keep unlimited free extras',()=>{
 assert.equal(priceOrder(friesOrder([{id:'free0'},{id:'free1'}],15),freeCatalog(null)).total,15);
});
const linkedCatalog=()=>{
 const c=freeCatalog(5,2,1);
 c.products.push({id:'pizzaX',name:'Pizza X',is_pizza:false,base_price:20,available:true,has_extras:true,category_id:'cat-pizza'});
 const fries=c.products.find(p=>p.id==='fries');
 fries.category_id='cat-entradas';
 for(const a of c.addons) a.group_category_ids=['cat-entradas'];
 return c;
};
const catOrder=(productId,extras,total)=>({items:[{productId,quantity:1,extras}],orderType:'pickup',customer:{name:'Test fixture',phone:'5500000000000'},payment:{method:'pix'},total});
test('group linked to another category is rejected',()=>{
 assert.throws(()=>priceOrder(catOrder('pizzaX',[{id:'free0'}],20),linkedCatalog()),/produto/);
});
test('group linked to the product category is accepted',()=>{
 assert.equal(priceOrder(catOrder('fries',[{id:'free0'}],15),linkedCatalog()).total,15);
});
test('cumulative paid option multiplies price by quantity',()=>{
 assert.equal(priceOrder(catOrder('fries',[{id:'paid0',quantity:3}],30),linkedCatalog()).total,30);
});
for(const qty of [0,11,1.5,NaN,'2']){
 test('invalid extra quantity rejected '+String(qty),()=>{
  assert.throws(()=>priceOrder(catOrder('fries',[{id:'paid0',quantity:qty}],15),linkedCatalog()),/uanti/);
 });
}
test('free units count toward the limit',()=>{
 const c=linkedCatalog();
 assert.equal(priceOrder(catOrder('fries',[{id:'free0',quantity:2}],15),c).total,15);
 assert.throws(()=>priceOrder(catOrder('fries',[{id:'free0',quantity:6}],15),c),/gratuitos/);
});
test('exclusive option cannot combine with another from the group',()=>{
 const c=linkedCatalog();
 c.addons.find(a=>a.id==='free0').cumulative=false;
 assert.equal(priceOrder(catOrder('fries',[{id:'free0'}],15),c).total,15);
 assert.throws(()=>priceOrder(catOrder('fries',[{id:'free0'},{id:'free1'}],15),c),/exclusivo/);
 assert.throws(()=>priceOrder(catOrder('fries',[{id:'free1'},{id:'free0'}],15),c),/exclusivo/);
});
test('exclusive option rejects quantity above one',()=>{
 const c=linkedCatalog();
 c.addons.find(a=>a.id==='free0').cumulative=false;
 assert.throws(()=>priceOrder(catOrder('fries',[{id:'free0',quantity:2}],15),c),/uanti/);
});

