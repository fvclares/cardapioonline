/**
 * Storage Engine - Supabase Adapter
 * Substitui localStorage por Supabase com fallback local
 * Compatível com a API anterior (window.storage)
 */

import { supabase, auth, storeApi, categoriesApi, productsApi, addonGroupsApi, neighborhoodsApi, ordersApi, settingsApi, pizzaSizesApi, productSizePricesApi, offersApi, offerGroupsApi, offerGroupItemsApi, offerSchedulesApi, campaignsApi } from '../lib/supabase.js?v=17';

// Normaliza campos Supabase -> formato legado do frontend
function normalizeProduct(p) {
  if (!p) return p;
  return {
    ...p,
    price: p.price ?? p.base_price,
    base_price: p.base_price ?? p.price,
    image: p.image ?? p.image_url,
    image_url: p.image_url ?? p.image,
    order: p.order ?? p.display_order,
    display_order: p.display_order ?? p.order,
    is_featured: p.is_featured ?? p.isFeatured ?? false,
    featured_order: p.featured_order ?? p.featuredOrder ?? 0,
  };
}
function normalizeCategory(c) {
  if (!c) return c;
  return { ...c, order: c.order ?? c.display_order, display_order: c.display_order ?? c.order };
}

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
      settings: null,
      pizzaSizes: null,
      productSizePrices: null,
      offers: null,
      campaigns: null
    };
  }

  async init(storeId) {
    this.storeId = storeId;
    if (!storeId) {
      console.warn('⚠️ Sem storeId - usando localStorage fallback');
      this.useLocalFallback = true;
      return this.initLocalFallback();
    }
    
    try {
      const [storeResult, categoriesResult, productsResult, addonsResult, neighborhoodsResult, settingsResult, pizzaSizesResult, sizePricesResult, offersResult, campaignsResult] = await Promise.all([
        storeApi.getById(storeId),
        categoriesApi.list(storeId),
        productsApi.listAdmin(storeId),
        addonGroupsApi.list(storeId),
        neighborhoodsApi.list(storeId),
        settingsApi.get(storeId),
        pizzaSizesApi.listAll(storeId).catch(()=>({data:[]})),
        productSizePricesApi.listByStore(storeId).catch(()=>({data:[]})),
        this.fetchOffers(storeId).catch(()=>({data:[]})),
        this.fetchCampaigns(storeId).catch(()=>({data:[]})),
      ]);

      if (storeResult.error) throw storeResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (addonsResult.error) throw addonsResult.error;

      const rawStore = storeResult.data;
      if (rawStore) {
        rawStore.logo = rawStore.logo_url || rawStore.logo;
        rawStore.cover = rawStore.cover_url || rawStore.cover;
      }
      this._dataCache.store = rawStore;
      this._dataCache.categories = (categoriesResult.data || []).map(normalizeCategory);
      this._dataCache.products = (productsResult.data || []).map(normalizeProduct);

      // AddonGroups: só mostra opcionais se a loja cadastrou; vazio = sem bordas/extras
      if (!addonsResult.data || addonsResult.data.length === 0) {
        this._dataCache.addonGroups = {};
      } else {
        const mapped = {};
        for (const g of addonsResult.data) {
          const opts = (g.addon_options || []).map(o => ({
            id: o.id,
            name: o.name,
            price: Number(o.price_diff ?? o.price ?? 0),
            price_diff: Number(o.price_diff ?? o.price ?? 0),
            allows_half_half: o.allows_half_half,
            is_default: o.is_default,
            default: o.is_default
          }));
          const nameKey = (g.name + ' ' + (g.title||'')).toLowerCase();
          let key = g.id;
          if (nameKey.includes('tamanho')) key = 'sizes';
          else if (nameKey.includes('borda') || nameKey.includes('crust')) key = 'crusts';
          else if (nameKey.includes('extra') || nameKey.includes('adicional')) key = 'extras';
          const entry = { id: g.id, title: g.title || g.name, name: g.name, type: g.type, required: g.required, options: opts };
          mapped[key] = entry;
          mapped[g.id] = entry;
        }
        this._dataCache.addonGroups = mapped;
      }
      this._dataCache.neighborhoods = neighborhoodsResult.data || [];
      this._dataCache.settings = settingsResult.data || {};
      this._dataCache.pizzaSizes = pizzaSizesResult?.data || [];
      this._dataCache.productSizePrices = sizePricesResult?.data || [];
      this._dataCache.offers = offersResult?.data || [];
      this._dataCache.campaigns = campaignsResult?.data || [];
      if (this._dataCache.store) {
        this._dataCache.store.neighborhoods = this._dataCache.neighborhoods;
      }

      console.log('✅ SupabaseStorageEngine inicializado para store:', storeId);
      this.emitChange('data_ready', this._dataCache);
    } catch (err) {
      console.warn('⚠️ Falha ao conectar Supabase, usando fallback local:', err.message);
      this.useLocalFallback = true;
      return this.initLocalFallback();
    }
  }

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
      try { return localStorage.getItem(key); }
      catch { return this.localCache[key] || null; }
    };

    this.setItem = (key, value) => {
      try { localStorage.setItem(key, value); }
      catch { this.localCache[key] = value; }
    };

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

  getStore() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_store_data') || '{}');
    }
    if (this._dataCache.store) {
      // mantém store.neighborhoods sincronizado com cache de bairros (necessário para regra >1 bairro)
      if (this._dataCache.store.neighborhoods !== this._dataCache.neighborhoods) {
        this._dataCache.store.neighborhoods = this._dataCache.neighborhoods || [];
      }
      return this._dataCache.store;
    }
    return {};
  }

  async saveStore(storeData) {
    if (this.useLocalFallback) {
      this.setItem('cardapio_store_data', JSON.stringify(storeData));
      this.emitChange('store_updated', storeData);
      return storeData;
    }
    const { data, error } = await storeApi.update(this.storeId, storeData);
    if (error) throw error;
    if (data) { data.logo = data.logo_url || data.logo; data.cover = data.cover_url || data.cover; }
    this._dataCache.store = data;
    this.emitChange('store_updated', data);
    return data;
  }

  getCategories() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_categories') || '[]');
    }
    return this._dataCache.categories || [];
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

  getProducts() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_products') || '[]');
    }
    return this._dataCache.products || [];
  }

  getProductById(id) {
    if (this.useLocalFallback) {
      const products = JSON.parse(this.getItem('cardapio_products') || '[]');
      return products.find(p => p.id === id) || null;
    }
    if (this._dataCache.products) {
      return this._dataCache.products.find(p => p.id === id) || null;
    }
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

  getAddonGroups() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_addon_groups') || '{}');
    }
    return this._dataCache.addonGroups || {};
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

  getNeighborhoods() {
    if (this.useLocalFallback) {
      try {
        const s = JSON.parse(this.getItem('cardapio_store_data') || '{}');
        return s.neighborhoods || [];
      } catch { return []; }
    }
    return this._dataCache.neighborhoods || [];
  }

  getSettings() {
    if (this.useLocalFallback) return {};
    return this._dataCache.settings || {};
  }

  getPizzaSizes() {
    if (this.useLocalFallback) return [];
    return this._dataCache.pizzaSizes || [];
  }
  getProductSizePrices(productId) {
    if (this.useLocalFallback) return [];
    const all = this._dataCache.productSizePrices || [];
    if (productId) return all.filter(r => r.product_id === productId);
    return all;
  }

  async fetchOffers(storeId){
    const sid = storeId || this.storeId;
    if(!sid) return { data: [] };
    // busca offers ativas com grupos e itens
    const { data: offers, error } = await offersApi.list(sid);
    if(error) return { data: [] };
    // enriquece cada oferta com grupos + itens + schedules
    const enriched = [];
    for(const off of (offers||[])){
      const { data: groups } = await offerGroupsApi.list(off.id).catch(()=>({data:[]}));
      const { data: schedules } = await offerSchedulesApi.list(off.id).catch(()=>({data:[]}));
      // para cada grupo, busca items já veio em offerGroups? garante produtos
      enriched.push({ ...off, groups: groups||[], schedules: schedules||[] });
    }
    return { data: enriched };
  }
  getOffers(){
    if(this.useLocalFallback) return [];
    return this._dataCache.offers || [];
  }
  getActiveOffers(now=new Date()){
    const all = this.getOffers();
    return all.filter(o=>{
      if(!o.active) return false;
      if(!o.schedules || !o.schedules.length) return true;
      const wd = now.getDay();
      const cur = now.getHours()*60+now.getMinutes();
      return o.schedules.some(s=>{
        if(Number(s.weekday)!==wd) return false;
        const [sh,sm]=String(s.start_time).split(':').map(Number);
        const [eh,em]=String(s.end_time).split(':').map(Number);
        const start=sh*60+sm, end=eh*60+em;
        if(end<start) return cur>=start || cur<=end;
        return cur>=start && cur<=end;
      });
    });
  }
  async fetchCampaigns(storeId){
    const sid = storeId || this.storeId;
    if(!sid) return { data: [] };
    const { data: camps } = await campaignsApi.list(sid).catch(()=>({data:[]}));
    const enriched=[];
    for(const c of (camps||[])){
      const { data: withOffers } = await campaignsApi.getWithOffers(c.id).catch(()=>({data:{offers:[]}}));
      // getWithOffers returns camp with offers array; but we already have c, need offers list
      const offers = withOffers?.offers || [];
      enriched.push({ ...c, offers });
    }
    return { data: enriched };
  }
  getCampaigns(){
    if(this.useLocalFallback) return [];
    return this._dataCache.campaigns || [];
  }
  getActiveCampaigns(now=new Date()){
    const all=this.getCampaigns();
    const today=now.toISOString().slice(0,10);
    return all.filter(c=> c.active && c.start_date<=today && c.end_date>=today);
  }

  // --- Customer (sempre local, por dispositivo) ---
  getCustomerToken() {
    const k = 'cardapio_customer_token';
    let t = null;
    try { t = localStorage.getItem(k); } catch { t = this.localCache[k] || null; }
    if (!t) {
      t = 'cust_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      try { localStorage.setItem(k, t); } catch { this.localCache[k] = t; }
    }
    return t;
  }
  getCustomerProfile() {
    const k = 'cardapio_customer_profile';
    try {
      const d = localStorage.getItem(k);
      return d ? JSON.parse(d) : null;
    } catch { const d = this.localCache[k]; return d ? JSON.parse(d) : null; }
  }
  saveCustomerProfile(profile) {
    const token = this.getCustomerToken();
    const customer = { token, ...profile, updated_at: new Date().toISOString() };
    const k = 'cardapio_customer_profile';
    try { localStorage.setItem(k, JSON.stringify(customer)); } catch { this.localCache[k] = JSON.stringify(customer); }
    return customer;
  }

  async getOrders() {
    if (this.useLocalFallback) {
      return JSON.parse(this.getItem('cardapio_orders') || '[]');
    }
    try {
      const { data, error } = await ordersApi.list(this.storeId);
      if (error) throw error;
      return data || [];
    } catch (e) {
      // Guest não tem permissão para listar - retorna local
      try { return JSON.parse(this.getItem('cardapio_orders') || '[]'); } catch { return []; }
    }
  }

  async saveOrder(order) {
    if (this.useLocalFallback) {
      const orders = JSON.parse(this.getItem('cardapio_orders') || '[]');
      orders.unshift(order);
      this.setItem('cardapio_orders', JSON.stringify(orders));
      this.emitChange('order_created', order);
      return order;
    }
    // Mapeia snapshot do orderService para colunas da tabela orders
    try {
      const dbOrder = {
        customer_name: order.customer?.name || order.customer_name || 'Cliente',
        customer_phone: order.customer?.phone || order.customer_phone || '',
        customer_email: order.customer?.email || null,
        customer_address: order.deliveryAddress || order.customer_address || null,
        order_type: order.orderType || order.order_type || 'delivery',
        items: order.items || [],
        subtotal: Number(order.subtotal || 0),
        delivery_fee: Number(order.deliveryFee || order.delivery_fee || 0),
        total: Number(order.total || 0),
        payment_method: order.payment?.method || order.payment_method || 'pix',
        notes: order.notes || '',
        status: 'received'
      };
      const { data, error } = await ordersApi.create(this.storeId, dbOrder);
      if (error) throw error;
      this.emitChange('order_created', data);
      return data;
    } catch (e) {
      console.warn('ordersApi.create falhou, salvando local:', e.message);
      // Fallback local para não bloquear WhatsApp
      const orders = JSON.parse(this.getItem('cardapio_orders') || '[]');
      orders.unshift(order);
      this.setItem('cardapio_orders', JSON.stringify(orders));
      this.emitChange('order_created', order);
      return order;
    }
  }

  async getLastOrder() {
    const orders = await this.getOrders();
    return orders.length > 0 ? orders[0] : null;
  }

  async resetDefaults() {
    if (this.useLocalFallback) {
      this.setItem('cardapio_store_data', JSON.stringify(window.INITIAL_STORE_DATA || {}));
      this.setItem('cardapio_categories', JSON.stringify(window.INITIAL_CATEGORIES || []));
      this.setItem('cardapio_products', JSON.stringify(window.INITIAL_PRODUCTS || []));
      this.setItem('cardapio_addon_groups', JSON.stringify(window.INITIAL_ADDON_GROUPS || {}));
      this.emitChange('reset_all', null);
      return;
    }
    console.warn('Reset completo não disponível no Supabase.');
  }

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cardapio_data_change', {
        detail: { type, payload }
      }));
    }
  }

  async subscribeToOrders(callback) {
    if (this.useLocalFallback) return () => {};
    const subscription = ordersApi.subscribeToNewOrders(this.storeId, callback);
    return () => subscription.unsubscribe();
  }
}

// Cria instância global
const storageInstance = new SupabaseStorageEngine();
window.storage = storageInstance;

export { storageInstance as storage };
export default storageInstance;
