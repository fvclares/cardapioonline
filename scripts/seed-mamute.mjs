/**
 * Seed cardápio Pizzaria Mamute (mamute@pizzaria.com)
 * Loja: a5f88e35-f150-4c37-a7bd-2220e02ad2c8 (pizzaria-mamute)
 * Uso: MAMUTE_EMAIL=... MAMUTE_PASSWORD=... node scripts/seed-mamute.mjs
 * Requer: dono da loja. Apaga catálogo atual da loja e recria.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const URL = 'https://lgeeaolymwtauasppkla.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZWVhb2x5bXd0YXVhc3Bwa2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzQwMzcsImV4cCI6MjEwMzI1MDAzN30.RvHH6DELKFeDmM0GTemGX49u-xaBPejePm2QhXxtb6Y';
const STORE_ID = 'a5f88e35-f150-4c37-a7bd-2220e02ad2c8';

const email = process.env.MAMUTE_EMAIL;
const password = process.env.MAMUTE_PASSWORD;
if (!email || !password) {
  console.error('Defina MAMUTE_EMAIL e MAMUTE_PASSWORD no ambiente.');
  process.exit(1);
}

const db = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: sess, error: loginErr } = await db.auth.signInWithPassword({ email, password });
if (loginErr) { console.error('Login falhou:', loginErr.message); process.exit(1); }
console.log('Logado como', sess.user.email, sess.user.id);

// Confere vínculo com a loja
const { data: store } = await db.from('stores').select('id,slug,name,owner_id').eq('id', STORE_ID).single();
console.log('Loja:', store?.name, store?.slug);
if (!store) { console.error('Loja não encontrada'); process.exit(1); }

// Limpa catálogo atual (preços -> produtos -> categorias -> tamanhos -> adicionais)
console.log('Limpando catálogo atual...');
const { data: existingProducts } = await db.from('products').select('id').eq('store_id', STORE_ID);
if (existingProducts?.length) {
  const ids = existingProducts.map(p => p.id);
  // apaga preços primeiro (embora CASCADE, garante)
  await db.from('product_size_prices').delete().in('product_id', ids);
  const { error } = await db.from('products').delete().eq('store_id', STORE_ID);
  if (error) { console.error('Falha ao apagar produtos:', error.message); process.exit(1); }
}
await db.from('categories').delete().eq('store_id', STORE_ID);
await db.from('pizza_sizes').delete().eq('store_id', STORE_ID);
await db.from('addon_groups').delete().eq('store_id', STORE_ID);

const CATS = [
  { name: 'Entradas', order: 1, label: 'Porções' },
  { name: 'Pizzas Tradicionais', order: 2, label: 'G (8 fatias) R$ 35,00 / GG (12 fatias) R$ 40,00' },
  { name: 'Pizzas Especiais', order: 3, label: 'G inteira R$ 45,00 / GG inteira R$ 50,00 (meia: G R$ 40,00 / GG R$ 45,00)' },
  { name: 'Pizzas Primes', order: 4, label: 'G 8 fatias / GG 12 fatias — ver descrição' },
  { name: 'Pizzas Doces', order: 5, label: 'G (8 fatias) R$ 35,00 / GG (12 fatias) R$ 40,00' },
  { name: 'Pizzas Nutella', order: 6, label: 'G inteira R$ 55,00 / GG inteira R$ 60,00 (meia: G R$ 45,00 / GG R$ 50,00)' },
  { name: 'Lanches Tradicionais', order: 7, label: null },
  { name: 'Lanches Artesanais', order: 8, label: 'Carne 160g' },
  { name: 'Lasanha', order: 9, label: 'Porção individual — Novidade!' },
  { name: 'Combos', order: 10, label: null },
  { name: 'Bebidas', order: 11, label: null },
];

const catIds = {};
for (const c of CATS) {
  const { data, error } = await db.from('categories').insert([{
    store_id: STORE_ID, name: c.name, display_order: c.order,
    is_active: true, color: null, price_label: c.label,
  }]).select().single();
  if (error) { console.error('Falha categoria', c.name, error.message); process.exit(1); }
  catIds[c.name] = data.id;
}
console.log('Categorias criadas:', Object.keys(catIds).length);

// Tamanhos
const { data: sizeG, error: eG } = await db.from('pizza_sizes').insert([{
  store_id: STORE_ID, name: 'G (8 fatias)', slices: 8, max_flavors: 2, display_order: 1, is_active: true,
}]).select().single();
const { data: sizeGG, error: eGG } = await db.from('pizza_sizes').insert([{
  store_id: STORE_ID, name: 'GG (12 fatias)', slices: 12, max_flavors: 2, display_order: 2, is_active: true,
}]).select().single();
if (eG || eGG) { console.error('Falha tamanhos', eG?.message, eGG?.message); process.exit(1); }
console.log('Tamanhos:', sizeG.id, sizeGG.id);

// Adicional: molhos das Entradas (nome precisa conter "Adicional"/"Extra" p/ o app e o pricing aceitarem)
const { data: molhoGroup, error: molhoErr } = await db.from('addon_groups').insert([{
  store_id: STORE_ID,
  name: 'Adicional Molho (Entradas)',
  title: 'Escolha o molho',
  type: 'single',
  required: false,
  applies_to: ['Entradas'],
  max_free: 1,
  display_order: 1,
}]).select().single();
if (molhoErr) { console.error('Falha grupo molhos', molhoErr.message); process.exit(1); }
const MOLHOS = ['Molho da Casa', 'Molho Cheddar', 'Cream Cheese'];
for (let i = 0; i < MOLHOS.length; i++) {
  const { error } = await db.from('addon_options').insert([{
    group_id: molhoGroup.id,
    name: MOLHOS[i],
    price_diff: 0,
    allows_half_half: false,
    is_default: i === 0,
    cumulative: false,
    display_order: i + 1,
  }]);
  if (error) { console.error('Falha molho', MOLHOS[i], error.message); process.exit(1); }
}
console.log('Grupo de molhos criado:', molhoGroup.id);
// Vincula grupo de molhos à categoria Entradas
const { error: linkErr } = await db.from('addon_group_categories').insert([{
  group_id: molhoGroup.id, category_id: catIds['Entradas'],
}]);
if (linkErr) { console.error('Falha vínculo molhos->Entradas:', linkErr.message); process.exit(1); }

// Produtos: [categoria, nome, descrição, base_price, is_pizza, available, preço G, preço GG, has_extras]
// fixG/fixGG (opcionais): valor fixo da dividida por tamanho (modo 'fixed')
const P = [];
const pizza = (cat, name, desc, base, g, gg, fixG = null, fixGG = null) => P.push({ cat, name, desc, base, is_pizza: true, avail: true, g, gg, has_extras: true,
  fracMode: fixG != null || fixGG != null ? 'fixed' : 'max', fixG, fixGG });
const item = (cat, name, desc, price, avail = true, has_extras = false) => P.push({ cat, name, desc, base: price, is_pizza: false, avail, g: null, gg: null, has_extras });
// Entradas — molhos como adicional (grupo "Adicionais Molhos"), não na descrição
const entrada = (name, desc, price) => P.push({ cat: 'Entradas', name, desc: desc + ' Escolha 1 molho no adicional.', base: price, is_pizza: false, avail: true, g: null, gg: null, has_extras: true });

// Entradas
entrada('Batata Frita', 'Porção de batata frita.', 15);
entrada('Batata Frita com Bacon e Molho', 'Porção de batata frita com bacon.', 20);
entrada('Batata Frita com Bacon e Calabresa e Molho', 'Porção de batata frita com bacon e calabresa.', 24);
entrada('Batata com Costela Desfiada e Molho', 'Porção de batata com costela desfiada.', 28);
entrada('Onion Rings 10 unidades', 'Porção de onion rings (10 unidades). Acompanha molho — escolha 1 no adicional.', 15);
entrada('Cebola Crispy com Calabresa e Bacon e Molho', 'Porção de cebola crispy com calabresa e bacon.', 24);
entrada('Cebola Crispy com Costela Desfiada e Molho', 'Porção de cebola crispy com costela desfiada.', 28);

// Tradicionais G35 GG40
pizza('Pizzas Tradicionais', 'Mista', 'Molho, mussarela, frango, calabresa, milho, ervilha e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Calabresa', 'Molho, mussarela, calabresa, cebola e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Calabresa c/ Catupiry', 'Molho, mussarela, calabresa, catupiry, cebola e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Bacon', 'Molho, mussarela, bacon, cebola e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Frango', 'Molho, mussarela, frango, milho, ervilha e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Frango c/ Catupiry', 'Molho, mussarela, frango, catupiry, milho, ervilha e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Frango Crocante', 'Molho, mussarela, frango e batata palha.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Portuguesa', 'Molho, mussarela, presunto, ovo, milho, ervilha, palmito e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Presunto', 'Molho, mussarela, presunto, milho, ervilha e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Moda do Chefe', 'Molho, mussarela, presunto, catupiry, milho, ervilha e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Moda da Casa', 'Molho, mussarela, presunto, frango, calabresa, milho, ervilha, palmito e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Mussarela', 'Molho, mussarela, tomate e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Mussarela Crocante', 'Molho, mussarela e batata palha.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Catupiry Crocante', 'Molho, mussarela, catupiry e batata palha.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Quatro Queijos', 'Molho, mussarela, catupiry, cheddar, parmesão e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Palmito', 'Molho, mussarela, palmito, cebola e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Margarita', 'Molho, mussarela, manjericão, tomate e orégano.', 35, 35, 40);
pizza('Pizzas Tradicionais', 'Vegetariana', 'Molho, mussarela, manjericão, tomate, pimentão, palmito, milho, ervilha e orégano.', 35, 35, 40);

// Especiais G45 GG50 (inteira)
pizza('Pizzas Especiais', 'Calabacon', 'Molho, mussarela, calabresa, bacon, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Calapalmito', 'Molho, mussarela, calabresa, palmito, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Calabresa c/ Creme Cheese', 'Molho, mussarela, calabresa, creme cheese, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Bacon c/ Palmito', 'Molho, mussarela, bacon, palmito, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Bacon c/ Presunto', 'Molho, mussarela, bacon, presunto, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Bacon c/ Creme Cheese', 'Molho, mussarela, bacon, creme cheese, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Franbacon', 'Molho, mussarela, frango, bacon, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Bacon c/ Ovos', 'Molho, mussarela, bacon, ovos, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Bacon c/ Catupiry', 'Molho, mussarela, bacon, catupiry, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Lombinho', 'Molho, mussarela, lombinho, milho, ervilha e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Lombinho c/ Catupiry', 'Molho, mussarela, lombinho, catupiry, milho, ervilha e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Frango c/ Creme Cheese', 'Molho, mussarela, frango, creme cheese, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Moda do Pizzaiolo', 'Molho, mussarela, lombinho, bacon, catupiry, cebola e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Moda do Gordo', 'Molho, mussarela, lombinho, calabresa, bacon, cheddar e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Quatro Queijos c/ Bacon', 'Molho, mussarela, catupiry, parmesão, cheddar, bacon e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Cinco Queijos c/ Creme Cheese', 'Molho, mussarela, catupiry, parmesão, cheddar e creme cheese.', 45, 45, 50);
pizza('Pizzas Especiais', 'Maravilhosa', 'Molho, mussarela, peito de peru, manjericão e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Peito de Peru', 'Molho, mussarela, peito de peru, milho, ervilha e orégano.', 45, 45, 50);
pizza('Pizzas Especiais', 'Mexicana', 'Molho, mussarela, calabresa, pimenta calabresa, cebola e orégano.', 45, 45, 50);

// Primes — grupo 1: G65 GG70 (meia fixa G50 / GG55)
pizza('Pizzas Primes', 'Charque', 'Molho, mussarela, charque, cebola e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Charque c/ Creme Cheese', 'Molho, mussarela, charque, cebola, orégano e creme cheese.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Camarão Regional', 'Molho, mussarela, camarão regional, milho, ervilha e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Camarão c/ Catupiry', 'Molho, mussarela, camarão, catupiry, cebola e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Camarão c/ Creme Cheese', 'Molho, mussarela, camarão, creme cheese, milho, ervilha e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Filé', 'Molho, mussarela, carne e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Filé com Bacon', 'Molho, mussarela, carne, bacon, cebola e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Filé com Creme Cheese', 'Molho, mussarela, carne, creme cheese e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Carne de Sol', 'Molho, mussarela, carne de sol, cebola e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Atum', 'Molho, mussarela, atum, milho, ervilha e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Peruana', 'Molho, mussarela, atum, palmito, cebola e orégano.', 65, 65, 70, 50, 55);
pizza('Pizzas Primes', 'Costela Desfiada', 'Molho, mussarela, costela desfiada, cebola crispy e orégano.', 65, 65, 70);
pizza('Pizzas Primes', 'Costela Desfiada com Creme Cheese', 'Molho, mussarela, costela desfiada, creme cheese e orégano.', 65, 65, 70);
pizza('Pizzas Primes', 'Strogonoff de Carne', 'Molho, mussarela, strogonoff de carne e batata palha.', 65, 65, 70);
pizza('Pizzas Primes', 'Strogonoff de Frango', 'Molho, mussarela, strogonoff de frango e batata palha.', 65, 65, 70);
pizza('Pizzas Primes', 'Strogonoff de Camarão Regional', 'Molho, mussarela, strogonoff de camarão regional e batata palha.', 65, 65, 70);
// grupo 2: G80 GG100
pizza('Pizzas Primes', 'Camarão Rosa', 'Molho, mussarela, camarão rosa e orégano.', 80, 80, 100);
pizza('Pizzas Primes', 'Camarão Rosa c/ Catupiry', 'Molho branco, mussarela, camarão rosa e orégano.', 80, 80, 100);
// grupo 3: G70 GG75
pizza('Pizzas Primes', 'Filé com Frita', 'Molho, mussarela, filé e batata frita.', 70, 70, 75);
pizza('Pizzas Primes', 'Carne de Sol c/ Fritas', 'Molho, mussarela, carne de sol com fritas e orégano.', 70, 70, 75);

// Doces G35 GG40
pizza('Pizzas Doces', 'Brigadeiro', 'Brigadeiro com granulado.', 35, 35, 40);
pizza('Pizzas Doces', 'Chocolate', 'Chocolate com granulado.', 35, 35, 40);
pizza('Pizzas Doces', 'Chocolate Branco', 'Chocolate branco com granulado.', 35, 35, 40);
pizza('Pizzas Doces', 'Mix (Chocolate e Chocolate Branco)', 'Chocolate e chocolate branco.', 35, 35, 40);
pizza('Pizzas Doces', 'Doce de Leite', 'Doce de leite e MM.', 35, 35, 40);
pizza('Pizzas Doces', 'Banana', 'Molho, mussarela, banana, leite condensado e canela.', 35, 35, 40);
pizza('Pizzas Doces', 'Banana Nevada', 'Banana, chocolate branco e canela.', 35, 35, 40);
pizza('Pizzas Doces', 'Romeu e Julieta', 'Molho, mussarela, goiabada e creme de leite.', 35, 35, 40);
pizza('Pizzas Doces', 'Banoffee', 'Banana, doce de leite e canela.', 35, 35, 40);
// Nutella G55 GG60
pizza('Pizzas Nutella', 'Nutella', 'Chocolate Nutella.', 55, 55, 60);
pizza('Pizzas Nutella', 'Banana com Nutella', 'Banana e Nutella.', 55, 55, 60);
pizza('Pizzas Nutella', 'Nutella com Morango', 'Nutella e morango.', 55, 55, 60);
pizza('Pizzas Nutella', 'Nutella com Uva', 'Nutella e uva.', 55, 55, 60);

// Lanches Tradicionais
item('Lanches Tradicionais', '1 Burg Kid - R$ 13,00', 'Pão, carne e queijo.', 13);
item('Lanches Tradicionais', '2 Burg Simples - R$ 15,00', 'Pão, carne, queijo, ovo, molho e salada.', 15);
item('Lanches Tradicionais', '3 Burg Especial - R$ 18,00', 'Pão, carne, queijo, presunto, calabresa, ovo, molho e salada.', 18);
item('Lanches Tradicionais', '4 Burg Hot - R$ 18,00', 'Pão, carne, queijo, presunto, salsicha hot, ovo, molho e salada.', 18);
item('Lanches Tradicionais', '5 Burg Hot Cala - R$ 20,00', 'Pão, carne, queijo, presunto, calabresa, salsicha hot, ovo, molho e salada.', 20);
item('Lanches Tradicionais', '6 Burg Calabresa - R$ 20,00', 'Pão, carne, queijo, presunto, calabresa, molho e salada.', 20);
item('Lanches Tradicionais', '7 Burg Bacon - R$ 20,00', 'Pão, carne, queijo, presunto, bacon, molho e salada.', 20);
item('Lanches Tradicionais', '8 Burg Calabacon - R$ 22,00', 'Pão, carne, queijo, presunto, calabresa, bacon, molho e salada.', 22);
item('Lanches Tradicionais', '9 Burg Duplo - R$ 26,00', 'Pão, 2 carnes, 2 queijos, 2 presuntos, 2 ovos, molho e salada.', 26);
item('Lanches Tradicionais', '10 Burg Tudo - R$ 28,00', 'Pão, carne, queijo, presunto, calabresa, bacon, salsicha hot, ovo, molho e salada.', 28);
item('Lanches Tradicionais', '11 Queijo Quente', 'Pão de forma e queijo mussarela. (Preço a confirmar no balcão)', 0, false);
item('Lanches Tradicionais', '12 Misto Quente', 'Pão de forma, queijo e presunto. (Preço a confirmar no balcão)', 0, false);
item('Lanches Tradicionais', '13 Misto Duplo', 'Pão de forma, 2 queijos e 2 presuntos. (Preço a confirmar no balcão)', 0, false);
item('Lanches Tradicionais', '14 Misto com Ovo', 'Pão de forma, queijo, presunto e ovo. (Preço a confirmar no balcão)', 0, false);
item('Lanches Tradicionais', '15 Misto com Costela Desfiada', 'Pão de forma, queijo, costela desfiada e creme cheese. (Preço a confirmar no balcão)', 0, false);

// Artesanais
item('Lanches Artesanais', '16 Burg - R$ 16,00', 'Pão, carne 160g e queijo.', 16);
item('Lanches Artesanais', '17 Burg - R$ 22,00', 'Pão, carne 160g, queijo, calabresa, molho da casa, salada e cebola crispy.', 22);
item('Lanches Artesanais', '18 Burg - R$ 24,00', 'Pão, carne 160g, queijo, bacon, molho da casa, salada e cebola crispy.', 24);
item('Lanches Artesanais', '19 Burg - R$ 24,00', 'Pão, carne 160g, queijo, catupiry empanado e molho da casa.', 24);
item('Lanches Artesanais', '20 Burg - R$ 26,00', 'Pão, carne 160g, queijo, catupiry empanado, bacon e onion ring.', 26);
item('Lanches Artesanais', '21 Burg - R$ 28,00', 'Pão, carne 160g, queijo, catupiry empanado, costela bovina desfiada, creme cheese e cebola crispy.', 28);
item('Lanches Artesanais', '22 Burg - R$ 30,00', 'Pão, carne 160g, queijo, bacon, abacaxi chapeado, creme cheese e costela desfiada.', 30);
item('Lanches Artesanais', '23 Burg - R$ 32,00', 'Pão, carne 160g, queijo, bacon, costela desfiada, mussarela empanada e molho.', 32);
item('Lanches Artesanais', '24 Burg - R$ 32,00', 'Pão, 2 carnes 160g, queijo, bacon e calabresa.', 32);
item('Lanches Artesanais', '25 Burg - R$ 36,00', 'Pão, carne 160g, queijo, bacon, calabresa, costela desfiada, onion ring e catupiry empanado.', 36);

// Lasanha
item('Lasanha', 'Lasanha de Camarão', 'Lasanha porção individual de camarão. Novidade!', 30);
item('Lasanha', 'Lasanha de Carne', 'Lasanha porção individual de carne. Novidade!', 25);
item('Lasanha', 'Lasanha de Frango', 'Lasanha porção individual de frango. Novidade!', 25);
item('Lasanha', 'Lasanha Queijo e Presunto', 'Lasanha porção individual de queijo e presunto. Novidade!', 25);

// Combos
item('Combos', 'Combo Individual - R$ 26,00', '1 burg especial + 1 batata frita + 1 refrigerante lata.', 26);
item('Combos', 'Combo Dobro - R$ 40,00', '2 burg especial + 1 batata frita + 1 refrigerante de 600ml.', 40);
item('Combos', 'Combo Triplo - R$ 60,00', '3 burg especial + 1 batata frita + 1 refrigerante de 1 litro.', 60);
item('Combos', 'Combo Quarto - R$ 75,00', '4 burg especial + 1 batata frita + 1 refrigerante de 1 litro.', 75);
item('Combos', 'Combo Quinto - R$ 90,00', '5 burg especial + 1 batata frita com calabresa e molho + 1 refrigerante de 2 litros.', 90);
item('Combos', 'Combo Sexto - R$ 110,00', '6 burg especial + 1 batata frita com calabresa e molho + 1 refrigerante de 2 litros.', 110);

// Bebidas — sem preço no cardápio: R$0 indisponível
item('Bebidas', 'Refrigerante 1 Litro', 'Refrigerante 1 litro. (Preço a confirmar)', 0, false);
item('Bebidas', 'Refrigerante 1,5 Litro', 'Refrigerante 1,5 litro. (Preço a confirmar)', 0, false);
item('Bebidas', 'Refrigerante 2 Litros', 'Refrigerante 2 litros. (Preço a confirmar)', 0, false);
item('Bebidas', 'Refrigerante Lata 350ml', 'Refrigerante lata 350ml. (Preço a confirmar)', 0, false);
item('Bebidas', 'Suco 1 Litro', 'Suco 1 litro. (Preço a confirmar)', 0, false);
item('Bebidas', 'Suco 400ml', 'Suco 400ml. (Preço a confirmar)', 0, false);
item('Bebidas', 'Água Mineral 500ml', 'Água mineral 500ml. (Preço a confirmar)', 0, false);

console.log('Total produtos a inserir:', P.length);

let order = 1;
let codigo = 1;
let ok = 0;
for (const p of P) {
  const baseRow = {
    store_id: STORE_ID,
    category_id: catIds[p.cat],
    name: p.name,
    description: p.desc,
    base_price: p.base,
    is_pizza: p.is_pizza,
    has_crusts: p.is_pizza,
    has_extras: p.has_extras ?? p.is_pizza,
    available: p.avail,
    display_order: order++,
    codigo: codigo <= 999 ? codigo++ : null,
    image_url: null,
  };
  // Regra da dividida (exige migrations de fracionamento; cai para o básico se ausentes)
  let withFrac = null;
  if (p.is_pizza) withFrac = { ...baseRow, fraction_pricing_mode: p.fracMode || 'max', fraction_fixed_price: null };
  let data = null, error = null;
  if (withFrac) ({ data, error } = await db.from('products').insert([withFrac]).select().single());
  else ({ data, error } = await db.from('products').insert([baseRow]).select().single());
  if (error && withFrac && /fraction_pricing_mode/i.test(error.message)) {
    console.warn('Sem coluna de regra da dividida — rode as migrations; regra ignorada p/', p.name);
    ({ data, error } = await db.from('products').insert([baseRow]).select().single());
  }
  if (error) { console.error('Falha produto', p.name, error.message); continue; }
  ok++;
  if (p.is_pizza && p.g != null) {
    const rowG = { product_id: data.id, size_id: sizeG.id, price: p.g };
    const rowGG = { product_id: data.id, size_id: sizeGG.id, price: p.gg };
    if (p.fixG != null) rowG.fraction_fixed_price = p.fixG;
    if (p.fixGG != null) rowGG.fraction_fixed_price = p.fixGG;
    let r1 = await db.from('product_size_prices').upsert(rowG, { onConflict: 'product_id,size_id' });
    if (r1.error && /fraction_fixed/i.test(r1.error.message)) {
      delete rowG.fraction_fixed_price;
      r1 = await db.from('product_size_prices').upsert(rowG, { onConflict: 'product_id,size_id' });
      if (!r1.error) console.warn('Sem coluna de fixo por tamanho — rode a migration; fixo ignorado p/', p.name);
    }
    let r2 = await db.from('product_size_prices').upsert(rowGG, { onConflict: 'product_id,size_id' });
    if (r2.error && /fraction_fixed/i.test(r2.error.message)) {
      delete rowGG.fraction_fixed_price;
      r2 = await db.from('product_size_prices').upsert(rowGG, { onConflict: 'product_id,size_id' });
    }
    if (r1.error || r2.error) console.error('Falha preço', p.name, r1.error?.message, r2.error?.message);
  }
}
console.log(`Produtos criados: ${ok}/${P.length}`);

// Verificação
const vCats = await db.from('categories').select('id').eq('store_id', STORE_ID);
const vProds = await db.from('products').select('id').eq('store_id', STORE_ID);
const vGroups = await db.from('addon_groups').select('id,addon_options(*)').eq('store_id', STORE_ID);
console.log('Verificação final — categorias:', vCats.data?.length, 'produtos:', vProds.data?.length, 'grupos:', JSON.stringify(vGroups.data?.map(g => ({ id: g.id, opts: g.addon_options?.length }))));
await db.auth.signOut();
