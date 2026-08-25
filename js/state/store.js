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
        const [store, categories, products, addonGroups] = await Promise.all([
          storageEngine.getStore(),
          storageEngine.getCategories(),
          storageEngine.getProducts(),
          storageEngine.getAddonGroups()
        ]);
        this.store = store || this.store;
        this.categories = categories || this.categories;
        this.products = products || this.products;
        this.addonGroups = addonGroups || this.addonGroups;
      } else {
        // Fallback local
        this.store = storageEngine.getStore();
        this.categories = storageEngine.getCategories();
        this.products = storageEngine.getProducts();
        this.addonGroups = storageEngine.getAddonGroups();
      }
      this.customer = storageEngine.getCustomerProfile();
      
      // Default neighborhood
      if (!this.cart.neighborhood && this.store) {
        this.cart.neighborhood = this.store.neighborhoods?.[0] || { 
          name: 'Padrão', 
          fee: this.store.default_delivery_fee || 7.00 
        };
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
      const [store, categories, products, addonGroups] = await Promise.all([
        storageEngine.getStore(),
        storageEngine.getCategories(),
        storageEngine.getProducts(),
        storageEngine.getAddonGroups()
      ]);
      this.store = store || this.store;
      this.categories = categories || this.categories;
      this.products = products || this.products;
      this.addonGroups = addonGroups || this.addonGroups;
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

  // --- Carrinho: Ações ---
  addItem(itemPayload) {
    const {
      product,
      size = null,
      secondFlavor = null,
      quantity = 1,
      crust = null,
      extras = [],
      observation = ''
    } = itemPayload;

    let basePrice = Number(product.price);
    let displayName = product.name;

    if (secondFlavor && secondFlavor.name) {
      basePrice = Math.max(Number(product.price), Number(secondFlavor.price));
      displayName = `Pizza ½ ${product.name.replace('Pizza ', '')} + ½ ${secondFlavor.name.replace('Pizza ', '')}`;
    }

    let unitPrice = basePrice;
    if (size && typeof size.price_diff === 'number') {
      unitPrice += size.price_diff;
      if (size.name) {
        const sizeShort = size.name.split('(')[0].trim();
        displayName += ` [${sizeShort}]`;
      }
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
      originalProduct: { id: product.id, name: product.name, price: Number(product.price) },
      secondFlavor: secondFlavor ? { id: secondFlavor.id, name: secondFlavor.name, price: Number(secondFlavor.price) } : null,
      size: size ? { name: size.name, price_diff: Number(size.price_diff || 0) } : null,
      basePrice,
      unitPrice,
      quantity,
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