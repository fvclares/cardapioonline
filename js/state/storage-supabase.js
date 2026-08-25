/**
 * Storage Engine - Supabase Adapter
 * Substitui localStorage por Supabase com fallback local
 * Compatível com a API anterior (window.storage)
 */

class SupabaseStorageEngine {
  constructor() {
    this.storeId = null;
    this.listeners = new Map();
    this.localCache = {};
    this.useLocalFallback = false;
    this._dataCache = {
      store: null,
      categories: null,
      products: null,
      addonGroups: null,
      neighborhoods: null,
      settings: null
    };
  }

  // Inicializa com store_id (obtido via auth ou slug)
  async init(storeId) {
    this.storeId = storeId;
    if (!storeId) {
      console.warn('⚠️ Sem storeId - usando localStorage fallback');
      this.useLocalFallback = true;
      return this.initLocalFallback();
    }
    
    // Testa conexão e pré-carrega todos os dados
    try {
      const { supabase } = await import('../lib/supabase.js');
      const { storeApi, categoriesApi, productsApi, addonGroupsApi, neighborhoodsApi, settingsApi } = await import('../lib/supabase.js');
      
      const [storeResult, categoriesResult, productsResult, addonsResult, neighborhoodsResult, settingsResult] = await Promise.all([
        storeApi.getById(storeId),
        categoriesApi.list(storeId),
        productsApi.listAdmin(storeId),
        addonGroupsApi.list(storeId),
        neighborhoodsApi.list(storeId),
        settingsApi.get(storeId)
      ]);

      if (storeResult.error) throw storeResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (addonsResult.error) throw addonsResult.error;

      // Cache todos os dados localmente para acesso síncrono
      this._dataCache.store = storeResult.data;
      this._dataCache.categories = categoriesResult.data || [];
      this._dataCache.products = productsResult.data || [];
      this._dataCache.addonGroups = {};
      if (addonsResult.data) {
        for (const group of addonsResult.data) {
          this._dataCache.addonGroups[group.id] = group;
        }
      }
      this._dataCache.neighborhoods = neighborhoodsResult.data || [];
      this._dataCache.settings = settingsResult.data || {};

      console.log('✅ SupabaseStorageEngine inicializado com dados pré-carregados para store:', storeId);
      this.emitChange('data_ready', this._dataCache);
    } catch (err) {
      console.warn('⚠️ Falha ao conectar Supabase, usando fallback local:', err.message);
      this.useLocalFallback = true;
      return this.initLocalFallback();
    }
  }

  // Fallback para localStorage (compatibilidade)
  initLocalFallback() {
    this.useLocalFallback = true;
    const STORAGE_KEYS = {
      STORE: 'cardapio_store_data',
      CATEGORIES: 'cardapio_categories',
      PRODUCTS: 'cardapio_products',
      ADDONS: 'cardapio_addon_groups',
      ORDERS: 'cardapio_orders'
    };

    this.getItem = (key) => {
      try {
        return localStorage.getItem(key);
      } catch { return this.localCache[key] || null; }
    };

    this.setItem = (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch { this.localCache[key] = value; }
    };

    // Carrega dados iniciais se vazio
    if (!this.getItem(STORAGE_KEYS.STORE)) {
      this.setItem(STORAGE_KEYS.STORE, JSON.stringify(window.INITIAL_STORE_DATA || {}));
    }
    if (!this.getItem(STORAGE_KEYS.CATEGORIES)) {
      this.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(window.INITIAL_CATEGORIES || []));
    }
    if (!this.getItem(STORAGE_KEYS.PRODUCTS)) {
      this.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(window.INITIAL_PRODUCTS || []));
    }
    if (!this.getItem(STORAGE_KEYS.ADDONS)) {
      this.setItem(STORAGE_KEYS.ADDONS, JSON.stringify(window.INITIAL_ADDON_GROUPS || {}));
    }
    if (!this.getItem(STORAGE_KEYS.ORDERS)) {
      this.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    }

    console.log('📦 Usando localStorage fallback');
  }

  // --- Store Data ---
  getStore() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_store_data') || '{}');
    }
    // Retorna cache síncrono
    if (this._dataCache.store) return this._dataCache.store;
    // Fallback assíncrono se cache vazio
    console.warn('Cache de store vazio, buscando do Supabase...');
    this._fetchStoreAsync();
    return {};
  }

  _fetchStoreAsync() {
    import('../lib/supabase.js').then(({ storeApi }) => {
      storeApi.getById(this.storeId).then(({ data, error }) => {
        if (!error && data) {
          this._dataCache.store = data;
          this.emitChange('store_updated', data);
        }
      });
    });
  }

  async saveStore(storeData) {
    if (this.useLocalFallback) {
      this.setItem('cardapio_store_data', JSON.stringify(storeData));
      this.emitChange('store_updated', storeData);
      return storeData;
    }
    const { storeApi } = await import('../lib/supabase.js');
    const { data, error } = await storeApi.update(this.storeId, storeData);
    if (error) throw error;
    this._dataCache.store = data;
    this.emitChange('store_updated', data);
    return data;
  }

  // --- Categories ---
  getCategories() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_categories') || '[]');
    }
    if (this._dataCache.categories) return this._dataCache.categories;
    console.warn('Cache de categories vazio, buscando do Supabase...');
    this._fetchCategoriesAsync();
    return [];
  }

  _fetchCategoriesAsync() {
    import('../lib/supabase.js').then(({ categoriesApi }) => {
      categoriesApi.list(this.storeId).then(({ data, error }) => {
        if (!error && data) {
          this._dataCache.categories = data;
          this.emitChange('categories_updated', data);
        }
      });
    });
  }

  async saveCategories(categories) {
    if (this.useLocalFallback) {
      this.setItem('cardapio_categories', JSON.stringify(categories));
      this.emitChange('categories_updated', categories);
      return categories;
    }
    this._dataCache.categories = categories;
    this.emitChange('categories_updated', categories);
    return categories;
  }

  // --- Products ---
  getProducts() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_products') || '[]');
    }
    if (this._dataCache.products) return this._dataCache.products;
    console.warn('Cache de products vazio, buscando do Supabase...');
    this._fetchProductsAsync();
    return [];
  }

  _fetchProductsAsync() {
    import('../lib/supabase.js').then(({ productsApi }) => {
      productsApi.listAdmin(this.storeId).then(({ data, error }) => {
        if (!error && data) {
          this._dataCache.products = data;
          this.emitChange('products_updated', data);
        }
      });
    });
  }

getProductById(id) {
    if (this.useLocalFallback) {
      const products = JSON.parse(this.getItem('cardapio_products') || '[]');
      return products.find(p => p.id === id) || null;
    }
    if (this._dataCache.products) {
      return this._dataCache.products.find(p => p.id === id) || null;
    }
    // Fallback: busca assíncrona
    import('../lib/supabase.js').then(({ productsApi }) => {
      productsApi.getById(id).then(({ data }) => {
        if (data) this.emitChange('products_updated', this._dataCache.products);
      });
    });
    return null;
  }

  async saveProducts(products) {
    if (this.useLocalFallback) {
      this.setItem('cardapio_products', JSON.stringify(products));
      this.emitChange('products_updated', products);
      return products;
    }
    this._dataCache.products = products;
    this.emitChange('products_updated', products);
    return products;
  }

  // --- Addon Groups ---
  getAddonGroups() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_addon_groups') || '{}');
    }
    if (this._dataCache.addonGroups) return this._dataCache.addonGroups;
    console.warn('Cache de addonGroups vazio');
    return {};
  }

  async saveAddonGroups(addonGroups) {
    if (this.useLocalFallback) {
      this.setItem('cardapio_addon_groups', JSON.stringify(addonGroups));
      this.emitChange('addons_updated', addonGroups);
      return addonGroups;
    }
    this._dataCache.addonGroups = addonGroups;
    this.emitChange('addons_updated', addonGroups);
    return addonGroups;
  }

  // --- Neighborhoods ---
  getNeighborhoods() {
    if (this.useLocalFallback) {
      return [];
    }
    if (this._dataCache.neighborhoods) return this._dataCache.neighborhoods;
    return [];
  }

  // --- Settings ---
  getSettings() {
    if (this.useLocalFallback) {
      return {};
    }
    if (this._dataCache.settings) return this._dataCache.settings;
    return {};
  }

  // --- Orders ---
  async getOrders() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_orders') || '[]');
    }
    const { ordersApi } = await import('../lib/supabase.js');
    const { data, error } = await ordersApi.list(this.storeId);
    if (error) throw error;
    return data;
  }

  async saveOrder(order) {
    if (this.useLocalFallback) {
      const orders = JSON.parse(this.getItem('cardapio_orders') || '[]');
      orders.unshift(order);
      this.setItem('cardapio_orders', JSON.stringify(orders));
      this.emitChange('order_created', order);
      return order;
    }
    const { ordersApi } = await import('../lib/supabase.js');
    const { data, error } = await ordersApi.create(this.storeId, order);
    if (error) throw error;
    this.emitChange('order_created', data);
    return data;
  }

  async getLastOrder() {
    const orders = await this.getOrders();
    return orders.length > 0 ? orders[0] : null;
  }

  // --- Reset ---
  async resetDefaults() {
    if (this.useLocalFallback) {
      this.setItem('cardapio_store_data', JSON.stringify(window.INITIAL_STORE_DATA || {}));
      this.setItem('cardapio_categories', JSON.stringify(window.INITIAL_CATEGORIES || []));
      this.setItem('cardapio_products', JSON.stringify(window.INITIAL_PRODUCTS || []));
      this.setItem('cardapio_addon_groups', JSON.stringify(window.INITIAL_ADDON_GROUPS || {}));
      this.emitChange('reset_all', null);
      return;
    }
    // No Supabase, reset não é trivial - avisa para usar dashboard
    console.warn('Reset completo não disponível no Supabase. Use o Dashboard ou recrie a loja.');
  }

  // --- Event System ---
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const idx = callbacks.indexOf(callback);
    if (idx >= 0) callbacks.splice(idx, 1);
  }

  emitChange(type, payload) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(cb => cb(payload));
    }
    // Também dispara evento global para compatibilidade
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cardapio_data_change', {
        detail: { type, payload }
      }));
    }
  }

  // Subscribe a pedidos em tempo real
  async subscribeToOrders(callback) {
    if (this.useLocalFallback) return () => {};
    const { ordersApi } = await import('../lib/supabase.js');
    const subscription = ordersApi.subscribeToNewOrders(this.storeId, callback);
    return () => subscription.unsubscribe();
  }
}

// Instância global
window.storage = new SupabaseStorageEngine();

// Auto-inicialização: tenta pegar store_id da URL ou auth
(async () => {
  // 1. Tenta via URL param (?store=bella-massa)
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('store') || urlParams.get('slug');
  
  if (slug) {
    const { storeApi } = await import('../lib/supabase.js');
    const { data: store } = await storeApi.getBySlug(slug);
    if (store) {
      await window.storage.init(store.id);
      return;
    }
  }

  // 2. Tenta via auth (admin logado)
  const { auth } = await import('../lib/supabase.js');
  const session = await auth.getSession();
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_id')
      .eq('id', session.user.id)
      .single();
    if (profile?.store_id) {
      await window.storage.init(profile.store_id);
      return;
    }
  }

  // 3. Fallback: localStorage
  console.log('🔄 Inicializando storage com fallback local...');
  window.storage.initLocalFallback();
})();

export default window.storage;