/**
 * Dados Iniciais Realistas do Cardápio Online (Pizzaria Bella Massa)
 * Compatível com file:// (duplo clique no Windows) e http://
 */

const INITIAL_STORE_DATA = {
  id: 'store_bella_massa',
  name: 'Pizzaria Bella Massa',
  slug: 'bella-massa',
  phone: '5511999998888',
  phone_display: '(11) 99999-8888',
  description: 'Pizzas artesanais assadas em forno a lenha com fermentação natural e ingredientes premium.',
  logo: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=200&q=80',
  cover: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
  address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  opening_hours: 'Terça a Domingo: 18h30 às 23h30',
  status: 'open', // 'open' | 'closed'
  default_delivery_fee: 7.00,
  min_order_value: 35.00,
  neighborhoods: [
    { name: 'Bela Vista', fee: 6.00 },
    { name: 'Consolação', fee: 7.00 },
    { name: 'Jardins / Cerqueira César', fee: 8.00 },
    { name: 'Paraíso', fee: 8.00 },
    { name: 'Vila Mariana', fee: 9.00 },
    { name: 'Pinheiros', fee: 10.00 },
    { name: 'Perdizes', fee: 11.00 },
    { name: 'Moema', fee: 12.00 }
  ]
};

const INITIAL_CATEGORIES = [
  { id: 'cat_entradas', name: '🥖 Entradas & Aperitivos', order: 1 },
  { id: 'cat_pizzas_trad', name: '🍕 Pizzas Tradicionais', order: 2 },
  { id: 'cat_pizzas_esp', name: '⭐ Pizzas Especiais', order: 3 },
  { id: 'cat_pizzas_doces', name: '🍫 Pizzas Doces', order: 4 },
  { id: 'cat_calzones', name: '🥟 Calzones Artesanais', order: 5 },
  { id: 'cat_combos', name: '🔥 Combos & Promoções', order: 6 },
  { id: 'cat_bebidas', name: '🥤 Bebidas & Cervejas', order: 7 },
  { id: 'cat_sobremesas', name: '🍰 Sobremesas & Gelatos', order: 8 }
];

const INITIAL_ADDON_GROUPS = {
  sizes: {
    id: 'group_sizes',
    title: 'Escolha o Tamanho',
    type: 'single',
    options: [
      { id: 'size_media', name: 'Média (6 fatias • 30cm)', price_diff: -6.00, allows_half_half: false },
      { id: 'size_grande', name: 'Grande (8 fatias • 35cm) — Mais Pedida', price_diff: 0.00, allows_half_half: true, default: true },
      { id: 'size_gigante', name: 'Família / Gigante (12 fatias • 40cm)', price_diff: 14.00, allows_half_half: true }
    ]
  },
  crusts: {
    id: 'group_crusts',
    title: 'Escolha a Borda Recheada',
    type: 'single',
    required: false,
    options: [
      { id: 'borda_nenhuma', name: 'Massa Tradicional (Sem borda recheada)', price: 0 },
      { id: 'borda_catupiry', name: 'Borda Recheada de Catupiry Original', price: 8.00 },
      { id: 'borda_cheddar', name: 'Borda Recheada de Cheddar Cremoso', price: 8.00 },
      { id: 'borda_chocolate', name: 'Borda Recheada de Chocolate ao Leite', price: 10.00 },
      { id: 'borda_doce_leite', name: 'Borda Recheada de Doce de Leite Artesanal', price: 9.00 },
      { id: 'borda_vulcao', name: 'Borda Vulcão de Catupiry com Bacon Crocante', price: 14.00 }
    ]
  },
  extras: {
    id: 'group_extras',
    title: 'Adicionais Extras para a Pizza',
    type: 'multiple',
    required: false,
    options: [
      { id: 'extra_bacon', name: 'Bacon em Cubos Crocante', price: 6.00 },
      { id: 'extra_queijo', name: 'Mussarela Extra Especial', price: 7.00 },
      { id: 'extra_parmesao', name: 'Queijo Parmesão Ralado Gratinado', price: 5.00 },
      { id: 'extra_cebola', name: 'Cebola Roxa Fatiada', price: 3.00 },
      { id: 'extra_alho', name: 'Alho Frito Dourado', price: 3.50 },
      { id: 'extra_tomate_seco', name: 'Tomate Seco Artesanal', price: 6.00 },
      { id: 'extra_azeitona', name: 'Azeitonas Chilenas Extras', price: 4.00 }
    ]
  }
};

const INITIAL_PRODUCTS = [
  // --- ENTRADAS ---
  {
    id: 'prod_pao_calabresa',
    category_id: 'cat_entradas',
    name: 'Pão de Calabresa Artesanal Recheado',
    description: 'Pão caseiro assado na hora, recheado com calabresa moída temperada, mussarela derretida e ervas finas. Serve 2 a 3 pessoas.',
    price: 28.00,
    image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_crostini_alecrim',
    category_id: 'cat_entradas',
    name: 'Crostini de Parmesão, Azeite & Alecrim',
    description: 'Massa de pizza finíssima super crocante assada no forno a lenha, regada com azeite extravirgem, alecrim fresco e parmesão.',
    price: 22.00,
    image: 'https://images.unsplash.com/photo-1579684947550-22e945225d9a?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_mini_coxinhas',
    category_id: 'cat_entradas',
    name: 'Mini Coxinhas com Catupiry (Porção 8 un)',
    description: 'Mini coxinhas artesanais com massa de batata crocante, recheadas com peito de frango desfiado e Catupiry original cremoso.',
    price: 26.00,
    image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_focaccia_tomatinhos',
    category_id: 'cat_entradas',
    name: 'Focaccia Genovese com Tomatinhos & Manjericão',
    description: 'Massa macia e aerada com fermentação de 48h, azeite de oliva, tomatinhos sweet grape, flor de sal e folhas de manjericão.',
    price: 25.00,
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },

  // --- PIZZAS TRADICIONAIS ---
  {
    id: 'prod_calabresa',
    category_id: 'cat_pizzas_trad',
    name: 'Pizza Calabresa Especial',
    description: 'Molho de tomate pelado italiano, mussarela especial, calabresa artesanal fatiada, cebola roxa em rodelas e orégano.',
    price: 48.00,
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_frango_catupiry',
    category_id: 'cat_pizzas_trad',
    name: 'Pizza Frango com Catupiry Original',
    description: 'Molho caseiro, peito de frango desfiado suculento e temperado, coberto com o autêntico Catupiry original cremoso.',
    price: 54.00,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_portuguesa',
    category_id: 'cat_pizzas_trad',
    name: 'Pizza Portuguesa Imperial',
    description: 'Molho de tomate, mussarela, presunto cozido de primeira, ovos cozidos picados, ervilhas frescas, cebola e azeitonas pretas.',
    price: 52.00,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_marguerita',
    category_id: 'cat_pizzas_trad',
    name: 'Pizza Marguerita Gourmet',
    description: 'Molho de tomate artesanal, fatias de mussarela de búfala, rodelas de tomate caqui maduro, folhas frescas de manjericão e azeite.',
    price: 49.00,
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_mussarela_trad',
    category_id: 'cat_pizzas_trad',
    name: 'Pizza Mussarela Clássica',
    description: 'Generosa camada de mussarela derretida especial, molho de tomate italiano, fatias de tomate caqui e azeitonas chilenas.',
    price: 45.00,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_napolitana',
    category_id: 'cat_pizzas_trad',
    name: 'Pizza Napolitana com Alho Frito',
    description: 'Mussarela, rodelas de tomate, alho frito dourado crocante, queijo parmesão ralado gratinado e orégano.',
    price: 50.00,
    image: 'https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_baiana',
    category_id: 'cat_pizzas_trad',
    name: 'Pizza Baiana Picante',
    description: 'Calabresa moída artesanal, pimenta calabresa selecionada, cebola roxa, ovos cozidos e leve toque de mussarela.',
    price: 52.00,
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_milho_bacon',
    category_id: 'cat_pizzas_trad',
    name: 'Pizza Milho Verde com Bacon & Catupiry',
    description: 'Mussarela, milho verde selecionado no vapor, bacon em cubos crocante e cobertura generosa de Catupiry original.',
    price: 51.00,
    image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },

  // --- PIZZAS ESPECIAIS ---
  {
    id: 'prod_quatro_queijos',
    category_id: 'cat_pizzas_esp',
    name: 'Pizza 4 Queijos Nobres',
    description: 'Harmoniosa combinação de mussarela, provolone curado defumado, gorgonzola importado e requeijão Catupiry original.',
    price: 58.00,
    image: 'https://images.unsplash.com/photo-1573821663912-569905455b1c?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_parma',
    category_id: 'cat_pizzas_esp',
    name: 'Pizza Parma, Rúcula & Grana Padano',
    description: 'Mussarela de búfala, fatias finas de presunto cru tipo Parma, folhas de rúcula fresca e lascas de queijo Grana Padano.',
    price: 68.00,
    image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_pepperoni_cream_cheese',
    category_id: 'cat_pizzas_esp',
    name: 'Pizza Pepperoni com Cream Cheese',
    description: 'Mussarela especial, fatias crocantes de pepperoni artesanal, gotas de Cream Cheese Philadelphia e orégano.',
    price: 62.00,
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_carne_seca',
    category_id: 'cat_pizzas_esp',
    name: 'Pizza Carne Seca com Cream Cheese & Cebola',
    description: 'Carne seca artesanal desfiada e dessalgada, cebola roxa puxada na manteiga de garrafa e cobertura de cream cheese cremoso.',
    price: 64.00,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_brocolis_bacon',
    category_id: 'cat_pizzas_esp',
    name: 'Pizza Brócolis Especial com Bacon & Catupiry',
    description: 'Brócolis frescos refogados no azeite e alho, mussarela, cubinhos crocantes de bacon e cobertura em espiral de Catupiry.',
    price: 58.00,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },
  {
    id: 'prod_shimeji_brie',
    category_id: 'cat_pizzas_esp',
    name: 'Pizza Cogumelos Shimeji, Alho-Poró & Brie',
    description: 'Mix de cogumelos Shimeji salteados na manteiga com shoyu, rodelas finas de alho-poró e queijo Brie derretido.',
    price: 69.00,
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: true
  },

  // --- PIZZAS DOCES ---
  {
    id: 'prod_nutella_morango',
    category_id: 'cat_pizzas_doces',
    name: 'Pizza Nutella com Morangos Frescos',
    description: 'Massa fina crocante, generosa camada de Nutella original, morangos frescos fatiados e raspas de chocolate meio amargo.',
    price: 52.00,
    image: 'https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: false
  },
  {
    id: 'prod_romeu_julieta',
    category_id: 'cat_pizzas_doces',
    name: 'Pizza Romeu & Julieta Especial',
    description: 'Goiabada cascão cremosa derretida com queijo minas padrão especial e leve toque aromático de canela.',
    price: 46.00,
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: false
  },
  {
    id: 'prod_banana_canela',
    category_id: 'cat_pizzas_doces',
    name: 'Pizza Banana Caramelizada com Canela & Doce de Leite',
    description: 'Mussarela suave, fatias de banana nanica caramelizadas, doce de leite artesanal cremoso e canela em pó.',
    price: 48.00,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: false
  },
  {
    id: 'prod_ninho_nutella',
    category_id: 'cat_pizzas_doces',
    name: 'Pizza Leite Ninho Trufado com Nutella',
    description: 'Base cremosa de chocolate branco com Leite Ninho, coberta com fios fartos de Nutella pura e leite em pó polvilhado.',
    price: 55.00,
    image: 'https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: true,
    has_crusts: true,
    has_extras: false
  },

  // --- CALZONES ARTESANAIS ---
  {
    id: 'prod_calzone_trad',
    category_id: 'cat_calzones',
    name: 'Calzone Clássico Presunto, Queijo & Ricota',
    description: 'Pizza dobrada e selada no forno, recheada com presunto royale, mussarela, ricota cremosa temperada e molho de tomate.',
    price: 44.00,
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_calzone_frango',
    category_id: 'cat_calzones',
    name: 'Calzone Frango com Catupiry & Bacon',
    description: 'Massa crocante por fora e macia por dentro, recheio farto de frango desfiado, bacon e muito Catupiry original.',
    price: 46.00,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },

  // --- COMBOS & PROMOÇÕES ---
  {
    id: 'prod_combo_familia',
    category_id: 'cat_combos',
    name: 'Combo Família Perfeita (Grande + Refri 2L)',
    description: '1 Pizza Salgada Grande (Calabresa ou Frango Catupiry) + 1 Borda Catupiry Recheada + 1 Refrigerante Coca-Cola 2L Gelado.',
    price: 69.90,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_combo_casal',
    category_id: 'cat_combos',
    name: 'Combo Casal Pizza Salgada + Pizza Doce + Refri',
    description: '1 Pizza Salgada Grande + 1 Pizza Doce Média (Nutella ou Banana) + 2 Refrigerantes em Lata 350ml gelados.',
    price: 89.90,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_combo_galera',
    category_id: 'cat_combos',
    name: 'Combo Galera (2 Pizzas Grandes + Borda + 2L)',
    description: '2 Pizzas Salgadas Grandes de qualquer sabor tradicional + 1 Borda Recheada + 1 Refrigerante Guaraná Antarctica 2L.',
    price: 119.90,
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },

  // --- SOBREMESAS ---
  {
    id: 'prod_petit_gateau',
    category_id: 'cat_sobremesas',
    name: 'Petit Gâteau de Chocolate com Sorvete de Creme',
    description: 'Bolinho quente de chocolate belga com recheio cremoso escorrendo, acompanhado de bola de sorvete de baunilha.',
    price: 22.00,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_mousse_maracuja',
    category_id: 'cat_sobremesas',
    name: 'Mousse de Maracujá Artesanal na Taça',
    description: 'Mousse aerada super cremosa feita com polpa natural da fruta, coberta com calda de maracujá e sementinhas.',
    price: 16.00,
    image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_brownie_nutella',
    category_id: 'cat_sobremesas',
    name: 'Brownie Recheado com Nutella & Nozes',
    description: 'Fatia generosa de brownie chocolatudo e úmido com nozes crocantes e recheio generoso de Nutella.',
    price: 18.00,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },

  // --- BEBIDAS & CERVEJAS ---
  {
    id: 'prod_coca_2l',
    category_id: 'cat_bebidas',
    name: 'Coca-Cola Original 2 Litros',
    description: 'Garrafa PET 2 litros entregue super gelada para acompanhar sua refeição.',
    price: 14.00,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_coca_zero_2l',
    category_id: 'cat_bebidas',
    name: 'Coca-Cola Sem Açúcar 2 Litros',
    description: 'Garrafa PET 2 litros geladinha com zero calorias e o mesmo sabor marcante.',
    price: 14.00,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_guarana_2l',
    category_id: 'cat_bebidas',
    name: 'Guaraná Antarctica 2 Litros',
    description: 'Garrafa PET 2 litros gelada com o autêntico e inconfundível sabor da fruta.',
    price: 12.00,
    image: 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_coca_lata',
    category_id: 'cat_bebidas',
    name: 'Coca-Cola Lata 350ml Gelada',
    description: 'Lata 350ml estupidamente gelada.',
    price: 7.00,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_guarana_lata',
    category_id: 'cat_bebidas',
    name: 'Guaraná Antarctica Lata 350ml Gelada',
    description: 'Lata 350ml estupidamente gelada.',
    price: 6.50,
    image: 'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_suco_laranja_500',
    category_id: 'cat_bebidas',
    name: 'Suco Natural de Laranja 500ml (Feito na Hora)',
    description: 'Garrafinha de 500ml com suco de laranja 100% natural espremido na hora, sem conservantes.',
    price: 12.00,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_suco_uva_integral',
    category_id: 'cat_bebidas',
    name: 'Suco de Uva Integral 300ml Garrafa de Vidro',
    description: 'Suco de uva tinto integral 100% fruta, sem adição de açúcar ou água.',
    price: 10.00,
    image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_heineken',
    category_id: 'cat_bebidas',
    name: 'Cerveja Heineken Long Neck 330ml',
    description: 'Cerveja puro malte holandesa premium, entregue estupidamente gelada.',
    price: 11.00,
    image: 'https://images.unsplash.com/photo-1608270191773-455b3941b2c4?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_corona',
    category_id: 'cat_bebidas',
    name: 'Cerveja Corona Extra 330ml com Fatia de Limão',
    description: 'Cerveja mexicana refrescante com uma fatia de limão fresco para acompanhar.',
    price: 12.00,
    image: 'https://images.unsplash.com/photo-1584225065152-4a1454aa3d4e?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  },
  {
    id: 'prod_agua_mineral',
    category_id: 'cat_bebidas',
    name: 'Água Mineral Crystal 500ml (Sem Gás / Com Gás)',
    description: 'Garrafa de 500ml gelada. Escolha nas observações se prefere com gás ou sem gás.',
    price: 5.00,
    image: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=600&q=80',
    available: true,
    is_pizza: false
  }
];

// Exportação global universal
window.INITIAL_STORE_DATA = INITIAL_STORE_DATA;
window.INITIAL_CATEGORIES = INITIAL_CATEGORIES;
window.INITIAL_ADDON_GROUPS = INITIAL_ADDON_GROUPS;
window.INITIAL_PRODUCTS = INITIAL_PRODUCTS;

// Exportação ES Module opcional para testes
if (typeof exports !== 'undefined') {
  exports.INITIAL_STORE_DATA = INITIAL_STORE_DATA;
  exports.INITIAL_CATEGORIES = INITIAL_CATEGORIES;
  exports.INITIAL_ADDON_GROUPS = INITIAL_ADDON_GROUPS;
  exports.INITIAL_PRODUCTS = INITIAL_PRODUCTS;
}
