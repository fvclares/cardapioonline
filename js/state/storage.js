/**
 * Camada de Persistência e Armazenamento (LocalStorage Adapter com In-Memory Fallback)
 * Compatível com file:// (duplo clique no Windows) e http://
 */

const STORAGE_KEYS = {
  STORE: 'cardapio_store_data',
  CATEGORIES: 'cardapio_categories',
  PRODUCTS: 'cardapio_products',
  ADDONS: 'cardapio_addon_groups',
  ORDERS: 'cardapio_orders',
  CUSTOMER_TOKEN: 'cardapio_customer_token',
  CUSTOMER_PROFILE: 'cardapio_customer_profile',
  ACTIVE_CART: 'cardapio_active_cart',
  CATALOG_VERSION: 'cardapio_catalog_version'
};

const CURRENT_CATALOG_VERSION = '2.1.0';

class StorageEngine {
  constructor() {
    this.memoryStore = {};
    this.init();
  }

  hasLocalStorage() {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  getItem(key) {
    if (this.hasLocalStorage()) {
      return window.localStorage.getItem(key);
    }
    return this.memoryStore[key] || null;
  }

  setItem(key, value) {
    if (this.hasLocalStorage()) {
      window.localStorage.setItem(key, value);
    } else {
      this.memoryStore[key] = value;
    }
  }

  init() {
    try {
      const initStore = window.INITIAL_STORE_DATA || {};
      const initCats = window.INITIAL_CATEGORIES || [];
      const initProds = window.INITIAL_PRODUCTS || [];
      const initAddons = window.INITIAL_ADDON_GROUPS || {};

      const savedVersion = this.getItem(STORAGE_KEYS.CATALOG_VERSION);
      const isOutdated = savedVersion !== CURRENT_CATALOG_VERSION;

      if (!this.getItem(STORAGE_KEYS.STORE) || isOutdated) {
        this.setItem(STORAGE_KEYS.STORE, JSON.stringify(initStore));
      }
      if (!this.getItem(STORAGE_KEYS.CATEGORIES) || isOutdated) {
        this.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(initCats));
      }
      if (!this.getItem(STORAGE_KEYS.PRODUCTS) || isOutdated) {
        this.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(initProds));
      }
      if (!this.getItem(STORAGE_KEYS.ADDONS) || isOutdated) {
        this.setItem(STORAGE_KEYS.ADDONS, JSON.stringify(initAddons));
      }
      if (!this.getItem(STORAGE_KEYS.ORDERS)) {
        this.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
      }

      this.setItem(STORAGE_KEYS.CATALOG_VERSION, CURRENT_CATALOG_VERSION);
    } catch (e) {
      console.warn('Erro ao inicializar storage:', e);
    }
  }

  // --- Store Data ---
  getStore() {
    try {
      const data = this.getItem(STORAGE_KEYS.STORE);
      return data ? JSON.parse(data) : (window.INITIAL_STORE_DATA || {});
    } catch {
      return window.INITIAL_STORE_DATA || {};
    }
  }

  saveStore(storeData) {
    this.setItem(STORAGE_KEYS.STORE, JSON.stringify(storeData));
    this.emitChange('store_updated', storeData);
    return storeData;
  }

  // --- Categories ---
  getCategories() {
    try {
      const data = this.getItem(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data) : (window.INITIAL_CATEGORIES || []);
    } catch {
      return window.INITIAL_CATEGORIES || [];
    }
  }

  saveCategories(categories) {
    this.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    this.emitChange('categories_updated', categories);
    return categories;
  }

  // --- Products ---
  getProducts() {
    try {
      const data = this.getItem(STORAGE_KEYS.PRODUCTS);
      return data ? JSON.parse(data) : (window.INITIAL_PRODUCTS || []);
    } catch {
      return window.INITIAL_PRODUCTS || [];
    }
  }

  saveProducts(products) {
    this.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    this.emitChange('products_updated', products);
    return products;
  }

  getProductById(id) {
    const products = this.getProducts();
    return products.find(p => p.id === id) || null;
  }

  // --- Addon Groups ---
  getAddonGroups() {
    try {
      const data = this.getItem(STORAGE_KEYS.ADDONS);
      return data ? JSON.parse(data) : (window.INITIAL_ADDON_GROUPS || {});
    } catch {
      return window.INITIAL_ADDON_GROUPS || {};
    }
  }

  // --- Customer Recognition & Token ---
  getCustomerToken() {
    let token = this.getItem(STORAGE_KEYS.CUSTOMER_TOKEN);
    if (!token) {
      token = 'cust_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      this.setItem(STORAGE_KEYS.CUSTOMER_TOKEN, token);
    }
    return token;
  }

  getCustomerProfile() {
    try {
      const data = this.getItem(STORAGE_KEYS.CUSTOMER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  saveCustomerProfile(profile) {
    const token = this.getCustomerToken();
    const customer = {
      token,
      ...profile,
      updated_at: new Date().toISOString()
    };
    this.setItem(STORAGE_KEYS.CUSTOMER_PROFILE, JSON.stringify(customer));
    return customer;
  }

  // --- Orders ---
  getOrders() {
    try {
      const data = this.getItem(STORAGE_KEYS.ORDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order);
    this.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    this.emitChange('order_created', order);
    return order;
  }

  getLastOrder() {
    const orders = this.getOrders();
    return orders.length > 0 ? orders[0] : null;
  }

  // --- Reset to Default ---
  resetDefaults() {
    this.setItem(STORAGE_KEYS.STORE, JSON.stringify(window.INITIAL_STORE_DATA || {}));
    this.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(window.INITIAL_CATEGORIES || []));
    this.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(window.INITIAL_PRODUCTS || []));
    this.setItem(STORAGE_KEYS.ADDONS, JSON.stringify(window.INITIAL_ADDON_GROUPS || {}));
    this.emitChange('reset_all', null);
  }

  // --- Event Dispatcher ---
  emitChange(type, payload) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('cardapio_data_change', {
        detail: { type, payload }
      }));
    }
  }
}

window.storage = new StorageEngine();
