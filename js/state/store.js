/**
 * Gerenciamento de Estado Global do Cardápio & Carrinho - Supabase Version
 * Compatível com storage síncrono (localStorage) e assíncrono (Supabase)
 */

class StoreState {
  constructor() {
    this.store = null;
    this.categories = [];
    this.products = [];
    this.addonGroups = {};
    this.pizzaSizes = [];
    this.productSizePrices = [];
    this.customer = null;
    this.listeners = [];
    this._refreshing = false;
    this._ready = false;
    this._readyPromise = null;

    this.cart = {
      items: [],
      orderType: 'delivery',
      neighborhood: null,
      paymentMethod: 'pix',
      cashChange: '',
      notes: ''
    };

    // Inicialização assíncrona
    this._initAsync();

    // Ouve alterações no storage (eventos síncronos)
    if (typeof window !== 'undefined') {
      window.addEventListener('cardapio_data_change', () => {
        this.refreshDataSync();
      });
    }
  }

  async _initAsync() {
    try {
      await this.refreshData();
      this._ready = true;
      this.notify();
    } catch (err) {
      console.error('Erro ao inicializar StoreState:', err);
      // Fallback para dados síncronos
      this.refreshDataSync();
      this._ready = true;
      this.notify();
    }
  }

  // Promise que resolve quando estado está pronto
  ready() {
    if (this._ready) return Promise.resolve();
    return new Promise(resolve => {
      const check = () => {
        if (this._ready) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  // Refresh síncrono (para eventos de mudança)
  refreshDataSync() {
    if (this._refreshing) return;
    const storageEngine = window.storage;
    if (!storageEngine) return;
    
    // Tenta pegar dados do cache local primeiro
    try {
      if (storageEngine.localCache || storageEngine.useLocalFallback) {
        this.store = storageEngine.getStore();
        this.categories = storageEngine.getCategories();
        this.products = storageEngine.getProducts();
        this.addonGroups = storageEngine.getAddonGroups();
        this.pizzaSizes = [];
        this.productSizePrices = [];
        this.customer = storageEngine.getCustomerProfile();
      } else {
        // Supabase: usa cache local se disponível, senão busca
        this._refreshFromStorage();
      }
      this._ready = true;
      this.notify();
    } catch (err) {
      console.warn('refreshDataSync fallback:', err);
    }
  }

  // Refresh assíncrono (busca do Supabase)
  async refreshData() {
    if (this._refreshing) return;
    this._refreshing = true;
    
    const storageEngine = window.storage;
    if (!storageEngine) {
      this._refreshing = false;
      return;
    }

    try {
      // Se for Supabase, busca dados
      if (!storageEngine.useLocalFallback && storageEngine.storeId) {
        const [store, categories, products, addonGroups, pizzaSizes, sizePrices] = await Promise.all([
          storageEngine.getStore(),
          storageEngine.getCategories(),
          storageEngine.getProducts(),
          storageEngine.getAddonGroups(),
          storageEngine.getPizzaSizes ? storageEngine.getPizzaSizes() : [],
          storageEngine.getProductSizePrices ? storageEngine.getProductSizePrices() : []
        ]);
        this.store = store || this.store;
        this.categories = categories || this.categories;
        this.products = products || this.products;
        this.addonGroups = addonGroups || this.addonGroups;
        this.pizzaSizes = pizzaSizes || this.pizzaSizes;
        this.productSizePrices = sizePrices || this.productSizePrices;
      } else {
        // Fallback local
        this.store = storageEngine.getStore();
        this.categories = storageEngine.getCategories();
        this.products = storageEngine.getProducts();
        this.addonGroups = storageEngine.getAddonGroups();
        this.pizzaSizes = [];
        this.productSizePrices = [];
      }
      this.customer = storageEngine.getCustomerProfile();
      
      // Default neighborhood (apenas se loja cadastrou bairros; sem Padrão)
      if (!this.cart.neighborhood && this.store && this.store.neighborhoods?.[0]) {
        this.cart.neighborhood = this.store.neighborhoods[0];
      }
      
      this._ready = true;
      this.notify();
    } catch (err) {
      console.error('refreshData error:', err);
      // Fallback silencioso
      this.refreshDataSync();
    } finally {
      this._refreshing = false;
    }
  }

  async _refreshFromStorage() {
    const storageEngine = window.storage;
    if (!storageEngine) return;
    
    try {
      const [store, categories, products, addonGroups, pizzaSizes, sizePrices] = await Promise.all([
        storageEngine.getStore(),
        storageEngine.getCategories(),
        storageEngine.getProducts(),
        storageEngine.getAddonGroups(),
        storageEngine.getPizzaSizes ? storageEngine.getPizzaSizes() : [],
        storageEngine.getProductSizePrices ? storageEngine.getProductSizePrices() : []
      ]);
      this.store = store || this.store;
      this.categories = categories || this.categories;
      this.products = products || this.products;
      this.addonGroups = addonGroups || this.addonGroups;
      this.pizzaSizes = pizzaSizes || this.pizzaSizes;
      this.productSizePrices = sizePrices || this.productSizePrices;
    } catch (err) {
      console.warn('_refreshFromStorage failed:', err);
    }
  }

  // --- Subscriptions ---
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    if (!this.listeners) return;
    this.listeners.forEach(fn => {
      try { fn(this); } catch (e) { console.error('Erro no listener:', e); }
    });
  }

  // --- Helpers Fração ---
  _getFractionOptions(size){
    if(!size || !size.max_flavors || size.max_flavors<=1) return [{ label:'Inteira', value:1, numerator:1, denominator:1 }];
    const max=size.max_flavors;
    if(max===2) return [
      { label:'Inteira', value:1, numerator:1, denominator:1 },
      { label:'Meia (½)', value:0.5, numerator:1, denominator:2 }
    ];
    if(max===3) return [
      { label:'Inteira', value:1, numerator:1, denominator:1 },
      { label:'Meia (½)', value:0.5, numerator:1, denominator:2 },
      { label:'1/3', value:1/3, numerator:1, denominator:3 }
    ];
    // 4 sabores
    return [
      { label:'Inteira', value:1, numerator:1, denominator:1 },
      { label:'Meia (½)', value:0.5, numerator:1, denominator:2 },
      { label:'1/4 (¼)', value:0.25, numerator:1, denominator:4 }
    ];
  }
  validateFractionalCart(){
    // Agrupa frações por tamanho e verifica se somam para pizzas inteiras
    const groups={};
    for(const item of this.cart.items){
      const fv = (item.fractionValue!=null) ? Number(item.fractionValue) : 1;
      if(fv===1) continue; // inteiras não entram
      // pizza fracionada deve ter size
      const key = item.size?.id || item.size?.name || 'sem-tamanho';
      const keyLabel = item.size?.name ? item.size.name.split('(')[0].trim() : key;
      if(!groups[key]) groups[key]={ key, label:keyLabel, sum:0, items:[] };
      const qty = Number(item.quantity||1);
      groups[key].sum += fv * qty;
      groups[key].items.push(item);
    }
    const errors=[];
    for(const k in groups){
      const g=groups[k];
      const sum=g.sum;
      // verifica se sum é inteiro (tolerância 0.001)
      const frac = sum - Math.floor(sum);
      if(Math.abs(frac) > 0.001 && Math.abs(frac-1) > 0.001){
        // falta para completar
        const falta = (1 - (frac>0.001?frac:0));
        // arredonda para fração legível
        let faltaLabel = '';
        if(Math.abs(falta-0.5)<0.01) faltaLabel='½';
        else if(Math.abs(falta-0.25)<0.01) faltaLabel='¼';
        else if(Math.abs(falta-0.75)<0.01) faltaLabel='¾';
        else if(Math.abs(falta-0.333)<0.01) faltaLabel='1/3';
        else faltaLabel = falta.toFixed(2);
        errors.push(`Falta ${faltaLabel} pizza(s) tamanho ${g.label} para completar. Você tem ${sum.toFixed(2).replace('.',',')} pizza(s) fracionadas. Adicione outra ${faltaLabel} do mesmo tamanho.`);
      }
      // verifica tamanhos inconsistentes: se tem pizza inteira + meia do mesmo tamanho? inteiras não estão no grupo, mas se misturar inteira e meia, o grupo de meias ainda deve ser inteiro; inteiras contam separado, mas total geral por tamanho deveria considerar inteiras também?
      // Para evitar 1 inteira + ½, validamos total geral por tamanho incluindo inteiras
    }
    // Também verifica mistura: se tem meias e inteiras do mesmo tamanho, o total fracionário ainda precisa ser inteiro, mas inteiras são inteiras então não afeta; porém 1 inteira + ½ = 1.5 total fracionário 0.5 -> já pega erro acima. Se o usuário tem só inteiras, OK.
    // Verifica tamanhos diferentes não se misturam: já agrupado por tamanho, então erro já é por tamanho.
    return { valid: errors.length===0, errors, groups };
  }
  _computeFractionalSubtotal(){
    // Calcula subtotal considerando frações: cada pizza completa (1.0) custa o max entre seus pedaços
    const fractionalBySize={};
    let wholeSubtotal=0;
    for(const item of this.cart.items){
      const fv = (item.fractionValue!=null) ? Number(item.fractionValue) : 1;
      const qty = Number(item.quantity||1);
      const base = Number(item.basePrice!=null ? item.basePrice : item.unitPrice);
      // custo de borda/extra já incluso em unitPrice? Para fracionadas, extras são por pedaço, mas vamos incluir como parte do base para max
      const effectivePrice = base + (item.crust?Number(item.crust.price||0):0) + (item.extras?item.extras.reduce((s,e)=>s+Number(e.price||0),0):0);
      if(fv===1){
        wholeSubtotal += effectivePrice * qty;
      } else {
        const key = item.size?.id || item.size?.name || 'sem-tamanho';
        if(!fractionalBySize[key]) fractionalBySize[key]=[];
        for(let i=0;i<qty;i++) fractionalBySize[key].push({ price: effectivePrice, item });
      }
    }
    let fracSubtotal=0;
    for(const key in fractionalBySize){
      const list = fractionalBySize[key].slice().sort((a,b)=> b.price - a.price);
      // Empacota frações em pizzas de 1.0
      let idx=0;
      while(idx < list.length){
        let sum=0;
        let maxPrice=0;
        let pieces=[];
        while(idx < list.length && sum < 0.999){
          const need = 1 - sum;
          // tenta pegar próximo que caiba sem estourar muito (tolerância)
          // como valores são 0.5,0.25,0.333, pegamos sequencialmente
          const entry = list[idx];
          const fv = (entry.item.fractionValue!=null) ? Number(entry.item.fractionValue) : 1;
          if(fv <= need + 0.001){
            sum += fv;
            if(entry.price > maxPrice) maxPrice = entry.price;
            pieces.push(entry);
            idx++;
          } else {
            // se não cabe, tenta próximo menor que caiba (para misturas 0.5+0.25+0.25)
            let found=false;
            for(let j=idx+1;j<list.length;j++){
              const e2=list[j];
              const fv2=(e2.item.fractionValue!=null)?Number(e2.item.fractionValue):1;
              if(fv2 <= need + 0.001){
                // swap
                sum+=fv2;
                if(e2.price>maxPrice) maxPrice=e2.price;
                pieces.push(e2);
                list.splice(j,1);
                found=true;
                break;
              }
            }
            if(!found) break; // não achou que caiba, fecha pizza incompleta (será erro de validação)
          }
        }
        if(Math.abs(sum-1) < 0.01){
          fracSubtotal += maxPrice;
        } else if(sum>0.001){
          // pizza incompleta: cobra proporcional? Não, deixa como max mas validação vai barrar checkout
          // Para exibição de subtotal, cobra max parcial (evita subtotal zero)
          fracSubtotal += maxPrice * sum; // proporcional para não assustar
        }
      }
    }
    return wholeSubtotal + fracSubtotal;
  }

  // --- Carrinho: Ações ---
  addItem(itemPayload) {
    const {
      product,
      size = null,
      secondFlavor = null,
      quantity = 1,
      crust = null,
      extras = [],
      observation = '',
      _allFlavors = null,
      fraction = null // novo: {value, numerator, denominator, label}
    } = itemPayload;

    // ----- FLUXO FRACIONADO NOVO -----
    if(fraction && fraction.value != null && fraction.value < 1){
      const fv = Number(fraction.value);
      const label = fraction.label || (fv===0.5?'½': fv===0.25?'¼': String(fv));
      let basePrice = Number(product.price);
      if (size && product.id) {
        const allPrices = this.productSizePrices || [];
        const found = allPrices.find(p=> p.product_id===product.id && p.size_id===size.id);
        if (found) basePrice = Number(found.price);
      }
      let unitPrice = basePrice;
      if (size && typeof size.price_diff === 'number' && (!this.pizzaSizes || !this.pizzaSizes.length)) unitPrice += size.price_diff;
      if (crust && crust.price) unitPrice += Number(crust.price);
      if (extras && extras.length) extras.forEach(e=> unitPrice += Number(e.price||0));

      const sizeShort = size && size.name ? size.name.split('(')[0].trim() : '';
      const displayName = `${label} ${product.name.replace('Pizza ','')}` + (sizeShort ? ` [${sizeShort}]` : '');

      const cartItem = {
        id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        productId: product.id,
        productName: displayName,
        originalProduct: { id: product.id, name: product.name, price: Number(product.price), codigo: product.codigo || null },
        secondFlavor: null,
        size: size ? { id: size.id || null, name: size.name, price_diff: Number(size.price_diff || 0) } : null,
        basePrice,
        unitPrice,
        quantity,
        fraction: { label, numerator: fraction.numerator||1, denominator: fraction.denominator||2 },
        fractionValue: fv,
        fractionLabel: label,
        crust: crust ? { name: crust.name, price: Number(crust.price || 0) } : null,
        extras: extras.map(e => ({ name: e.name, price: Number(e.price || 0) })),
        observation: observation.trim(),
        itemTotal: unitPrice * quantity * fv // temporário proporcional para exibição; subtotal real é recalc via _computeFractionalSubtotal
      };
      // itemTotal proporcional para listagem, mas getSubtotal recalcula agrupado
      this.cart.items.push(cartItem);
      this.notify();
      return cartItem;
    }

    // ----- FLUXO ANTIGO COMBINADO (mantido para retrocompatibilidade) -----
    // Determina preço base considerando tamanho (product_size_prices)
    let basePrice = Number(product.price);
    if (size && product.id) {
      const allPrices = this.productSizePrices || [];
      const found = allPrices.find(p=> p.product_id===product.id && p.size_id===size.id);
      if (found) basePrice = Number(found.price);
    }
    let displayName = product.name;

    // Suporte a 2-4 sabores: usa _allFlavors se fornecido, senão secondFlavor
    const allFlavors = _allFlavors && _allFlavors.length ? _allFlavors : (secondFlavor ? [secondFlavor] : []);
    if (allFlavors.length) {
      const prices = [basePrice, ...allFlavors.map(f=>{
        const allPrices = this.productSizePrices || [];
        const fp = size ? allPrices.find(p=> p.product_id===f.id && p.size_id===size.id) : null;
        return fp ? Number(fp.price) : Number(f.price);
      })];
      basePrice = Math.max(...prices);
      const names = [product.name, ...allFlavors.map(f=> f.name)];
      // Monta nome com frações
      if (allFlavors.length===1) displayName = `Pizza ½ ${names[0].replace('Pizza ','')} + ½ ${names[1].replace('Pizza ','')}`;
      else if (allFlavors.length===2) displayName = `Pizza 1/3 ${names.map(n=>n.replace('Pizza ','')).join(' + ')}`;
      else if (allFlavors.length===3) displayName = `Pizza 1/4 ${names.map(n=>n.replace('Pizza ','')).join(' + ')}`;
      else displayName = `Pizza ${names.map(n=>n.replace('Pizza ','')).join(' + ')}`;
    }

    let unitPrice = basePrice;
    if (size && typeof size.price_diff === 'number' && (!this.pizzaSizes || !this.pizzaSizes.length)) {
      unitPrice += size.price_diff;
    }
    if (size && size.name) {
      const sizeShort = size.name.split('(')[0].trim();
      displayName += ` [${sizeShort}]`;
    }

    if (crust && crust.price) {
      unitPrice += Number(crust.price);
    }
    if (extras && extras.length > 0) {
      extras.forEach(extra => {
        unitPrice += Number(extra.price || 0);
      });
    }

    const itemTotal = unitPrice * quantity;

    const cartItem = {
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      productId: product.id,
      productName: displayName,
      originalProduct: { id: product.id, name: product.name, price: Number(product.price), codigo: product.codigo || null },
      secondFlavor: secondFlavor ? { id: secondFlavor.id, name: secondFlavor.name, price: Number(secondFlavor.price) } : null,
      size: size ? { name: size.name, price_diff: Number(size.price_diff || 0) } : null,
      basePrice,
      unitPrice,
      quantity,
      fractionValue: 1,
      fractionLabel: 'Inteira',
      crust: crust ? { name: crust.name, price: Number(crust.price || 0) } : null,
      extras: extras.map(e => ({ name: e.name, price: Number(e.price || 0) })),
      observation: observation.trim(),
      itemTotal
    };

    this.cart.items.push(cartItem);
    this.notify();
    return cartItem;
  }

  updateQuantity(itemId, delta) {
    const itemIndex = this.cart.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    const item = this.cart.items[itemIndex];
    item.quantity += delta;

    if (item.quantity <= 0) {
      this.cart.items.splice(itemIndex, 1);
    } else {
      item.itemTotal = item.unitPrice * item.quantity;
    }

    this.notify();
  }

  removeItem(itemId) {
    this.cart.items = this.cart.items.filter(item => item.id !== itemId);
    this.notify();
  }

  clearCart() {
    this.cart.items = [];
    this.cart.cashChange = '';
    this.notify();
  }

  reorder(previousItems) {
    if (!previousItems || !Array.isArray(previousItems)) return;
    this.cart.items = previousItems.map(item => ({
      ...item,
      id: 'cart_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
    }));
    this.notify();
  }

  // --- Opções de Entrega e Pagamento ---
  setOrderType(type) {
    this.cart.orderType = type;
    this.notify();
  }

  setNeighborhood(neighborhood) {
    this.cart.neighborhood = neighborhood;
    this.notify();
  }

  setPaymentMethod(method, cashChange = '') {
    this.cart.paymentMethod = method;
    this.cart.cashChange = cashChange;
    this.notify();
  }

  // --- Cálculos Financeiros ---
  getSubtotal() {
    // Se tem frações, usa cálculo agrupado (max por pizza completa)
    const hasFraction = this.cart.items.some(i=> (i.fractionValue!=null && i.fractionValue<1));
    if(hasFraction) return this._computeFractionalSubtotal();
    return this.cart.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }

  getDeliveryFee() {
    if (this.cart.orderType === 'pickup') return 0;
    if (this.cart.neighborhood && typeof this.cart.neighborhood.fee === 'number') {
      return this.cart.neighborhood.fee;
    }
    return Number(this.store?.default_delivery_fee || 0);
  }

  getTotal() {
    return this.getSubtotal() + this.getDeliveryFee();
  }

  getItemCount() {
    return this.cart.items.reduce((count, item) => count + item.quantity, 0);
  }
}

window.appState = new StoreState();