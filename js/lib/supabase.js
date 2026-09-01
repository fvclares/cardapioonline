/**
 * Supabase Client para Browser (ES Module)
 * Compatível com index.html e admin.html via <script type="module">
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://lgeeaolymwtauasppkla.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnZWVhb2x5bXd0YXVhc3Bwa2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzQwMzcsImV4cCI6MjEwMzI1MDAzN30.RvHH6DELKFeDmM0GTemGX49u-xaBPejePm2QhXxtb6Y';

// Singleton para evitar Multiple GoTrueClient no mesmo contexto (admin + storage imports com ?v diferente)
let _supabaseInstance = null;
if (typeof window !== 'undefined' && window._supabaseClient) {
  _supabaseInstance = window._supabaseClient;
} else {
  _supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  if (typeof window !== 'undefined') window._supabaseClient = _supabaseInstance;
}
export const supabase = _supabaseInstance;

// Helper para preservar subpath do GitHub Pages (/cardapioonline)
function getBaseUrlLib() {
  return window.location.origin + window.location.pathname.replace(/\/admin\.html.*$/, '').replace(/\/index\.html.*$/, '').replace(/\/$/, '');
}

// Helpers de autenticação
export const auth = {
  // Login com email/senha
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  // Login com Magic Link (sem senha)
  async signInWithMagicLink(email, redirectTo) {
    const { data, error } = await supabase.auth.signInWithOtp({ 
      email, 
      options: { emailRedirectTo: redirectTo || getBaseUrlLib() + '/admin.html' }
    });
    return { data, error };
  },

  // Signup com convite (email + senha + token)
  async signUpWithInvite(email, password, inviteToken, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
          invite_token: inviteToken
        },
        emailRedirectTo: getBaseUrlLib() + '/admin.html'
      }
    });
    return { data, error };
  },

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Sessão atual
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  // Usuário logado
  async getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Observer de mudanças de auth
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Helpers de dados por loja (multi-tenant)
export const storeApi = {
  // Busca loja por slug (público - para cardápio)
  async getBySlug(slug) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'open')
      .single();
    return { data, error };
  },

  // Busca loja por ID (autenticado - para admin)
  async getById(id) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  // Cria loja (owner)
  async create(storeData) {
    const { data, error } = await supabase
      .from('stores')
      .insert([storeData])
      .select()
      .single();
    return { data, error };
  },

  // Atualiza loja
  async update(id, updates) {
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // Lista lojas do usuário logado
  async listMyStores() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  }
};

// Categorias
export const categoriesApi = {
  async list(storeId) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('display_order');
    return { data, error };
  },

  async create(storeId, category) {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ ...category, store_id: storeId }])
      .select()
      .single();
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    return { error };
  },

  async reorder(storeId, orderedIds) {
    const updates = orderedIds.map((id, index) => 
      supabase.from('categories').update({ display_order: index + 1 }).eq('id', id)
    );
    await Promise.all(updates);
  }
};

// Produtos
export const productsApi = {
  async list(storeId, categoryId = null) {
    let query = supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('available', true)
      .order('display_order');
    
    if (categoryId) query = query.eq('category_id', categoryId);
    
    const { data, error } = await query;
    return { data, error };
  },

  async listAdmin(storeId) {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('store_id', storeId)
      .order('display_order');
    return { data, error };
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  async create(storeId, product) {
    const { data, error } = await supabase
      .from('products')
      .insert([{ ...product, store_id: storeId }])
      .select()
      .single();
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    return { error };
  }
};

// Addon Groups
export const addonGroupsApi = {
  async list(storeId) {
    const { data, error } = await supabase
      .from('addon_groups')
      .select(`
        *,
        addon_options (*)
      `)
      .eq('store_id', storeId)
      .order('display_order');
    return { data, error };
  },

  async create(storeId, group) {
    const { data, error } = await supabase
      .from('addon_groups')
      .insert([{ ...group, store_id: storeId }])
      .select()
      .single();
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('addon_groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id) {
    const { error } = await supabase
      .from('addon_groups')
      .delete()
      .eq('id', id);
    return { error };
  }
};

// Addon Options
export const addonOptionsApi = {
  async create(groupId, option) {
    const { data, error } = await supabase
      .from('addon_options')
      .insert([{ ...option, group_id: groupId }])
      .select()
      .single();
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('addon_options')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id) {
    const { error } = await supabase
      .from('addon_options')
      .delete()
      .eq('id', id);
    return { error };
  }
};

// Bairros
export const neighborhoodsApi = {
  async list(storeId) {
    const { data, error } = await supabase
      .from('neighborhoods')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('display_order');
    return { data, error };
  },

  async create(storeId, neighborhood) {
    const { data, error } = await supabase
      .from('neighborhoods')
      .insert([{ ...neighborhood, store_id: storeId }])
      .select()
      .single();
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('neighborhoods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async delete(id) {
    const { error } = await supabase
      .from('neighborhoods')
      .delete()
      .eq('id', id);
    return { error };
  }
};

// Pedidos
export const ordersApi = {
  async create(storeId, order) {
    const orderNumber = await this.generateOrderNumber(storeId);
    const { data, error } = await supabase
      .from('orders')
      .insert([{ ...order, store_id: storeId, order_number: orderNumber }])
      .select()
      .single();
    return { data, error };
  },

  async list(storeId, filters = {}) {
    let query = supabase
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.startDate) query = query.gte('created_at', filters.startDate);
    if (filters.endDate) query = query.lte('created_at', filters.endDate);

    const { data, error } = await query;
    return { data, error };
  },

  async updateStatus(id, status) {
    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'delivered') updates.completed_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async generateOrderNumber(storeId) {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .gte('created_at', today + 'T00:00:00Z');
    
    return `PDV-${today}${(count + 1).toString().padStart(3, '0')}`;
  },

  // Realtime subscription para novos pedidos
  subscribeToNewOrders(storeId, callback) {
    return supabase
      .channel(`orders-${storeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `store_id=eq.${storeId}`
      }, (payload) => callback(payload.new))
      .subscribe();
  }
};

// Configurações da loja
export const settingsApi = {
  async get(storeId) {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    return { data, error };
  },

  async upsert(storeId, settings) {
    const { data, error } = await supabase
      .from('store_settings')
      .upsert({ store_id: storeId, ...settings })
      .select()
      .single();
    return { data, error };
  }
};

// Pizza Sizes (tamanhos por loja)
export const pizzaSizesApi = {
  async list(storeId) {
    const { data, error } = await supabase.from('pizza_sizes').select('*').eq('store_id', storeId).eq('is_active', true).order('display_order');
    return { data, error };
  },
  async listAll(storeId) {
    const { data, error } = await supabase.from('pizza_sizes').select('*').eq('store_id', storeId).order('display_order');
    return { data, error };
  },
  async create(storeId, payload) {
    const { data, error } = await supabase.from('pizza_sizes').insert([{ ...payload, store_id: storeId }]).select().single();
    return { data, error };
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('pizza_sizes').update(updates).eq('id', id).select().single();
    return { data, error };
  },
  async delete(id) {
    const { error } = await supabase.from('pizza_sizes').delete().eq('id', id);
    return { error };
  }
};

export const productSizePricesApi = {
  async listByProduct(productId) {
    const { data, error } = await supabase.from('product_size_prices').select('*').eq('product_id', productId);
    return { data, error };
  },
  async listByStore(storeId) {
    const { data, error } = await supabase.from('product_size_prices').select('*, pizza_sizes!inner(store_id)').eq('pizza_sizes.store_id', storeId);
    // fallback sem join se não funcionar
    if (error) {
      const { data: sizes } = await supabase.from('pizza_sizes').select('id').eq('store_id', storeId);
      const ids = (sizes||[]).map(s=>s.id);
      if (!ids.length) return { data: [], error: null };
      return await supabase.from('product_size_prices').select('*').in('size_id', ids);
    }
    return { data, error };
  },
  async upsert(productId, sizeId, price) {
    const { data, error } = await supabase.from('product_size_prices').upsert({ product_id: productId, size_id: sizeId, price }, { onConflict: 'product_id,size_id' }).select().single();
    return { data, error };
  },
  async deleteByProduct(productId) {
    const { error } = await supabase.from('product_size_prices').delete().eq('product_id', productId);
    return { error };
  }
};

// Storage (imagens)
export const storageApi = {
  async uploadProductImage(storeId, file, fileName) {
    const path = `${storeId}/${Date.now()}-${fileName}`;
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: false });
    return { data, error };
  },

  async deleteProductImage(path) {
    const { error } = await supabase.storage
      .from('product-images')
      .remove([path]);
    return { error };
  },

  getPublicUrl(path) {
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(path);
    return data.publicUrl;
  }
};

// View agregada: Cardápio completo (1 query)
export const menuApi = {
  async getFullMenu(storeId) {
    const { data, error } = await supabase
      .rpc('get_store_menu', { p_store_id: storeId });
    return { data, error };
  },

  // Fallback manual se RPC não existir
  async getFullMenuManual(storeId) {
    const { data: store, error: storeError } = await storeApi.getById(storeId);
    if (storeError) return { data: null, error: storeError };

    const { data: categories, error: catError } = await categoriesApi.list(storeId);
    if (catError) return { data: null, error: catError };

    const { data: products, error: prodError } = await productsApi.list(storeId);
    if (prodError) return { data: null, error: prodError };

    const { data: addons, error: addonError } = await addonGroupsApi.list(storeId);
    if (addonError) return { data: null, error: addonError };

    const { data: neighborhoods, error: nbError } = await neighborhoodsApi.list(storeId);
    if (nbError) return { data: null, error: nbError };

    const { data: settings, error: setError } = await settingsApi.get(storeId);
    if (setError) return { data: null, error: setError };

    // Agrupa produtos por categoria
    const categoriesWithProducts = categories.map(cat => ({
      ...cat,
      products: products.filter(p => p.category_id === cat.id)
    }));

    return {
      data: {
        ...store,
        categories: categoriesWithProducts,
        addon_groups: addons,
        neighborhoods,
        settings: settings || {}
      },
      error: null
    };
  }
};

// ============================================
// INVITES API (Sistema de Convites)
// ============================================
export const invitesApi = {
  // Criar convite (superadmin)
  async create(email, storeName, storeSlug) {
    const { data, error } = await supabase
      .from('invites')
      .insert([{
        email: email.toLowerCase().trim(),
        store_name: storeName || null,
        store_slug: storeSlug || null,
        created_by: (await supabase.auth.getUser()).data.user?.id
      }])
      .select()
      .single();
    return { data, error };
  },

  // Listar convites (superadmin)
  async list() {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // Validar token de convite
  async validate(token) {
    const { data, error } = await supabase
      .rpc('validate_invite', { p_token: token });
    return { data, error };
  },

  // Revogar convite
  async revoke(id) {
    const { data, error } = await supabase
      .from('invites')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // Reenviar convite (atualiza expiração)
  async resend(id) {
    const { data, error } = await supabase
      .from('invites')
      .update({
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // Deletar convite
  async delete(id) {
    const { error } = await supabase
      .from('invites')
      .delete()
      .eq('id', id);
    return { error };
  }
};

// ============================================
// PROFILES API
// ============================================
export const profilesApi = {
  async get(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async update(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  async isSuperadmin() {
    const { data, error } = await supabase
      .rpc('is_superadmin');
    return { data, error };
  }
};

// ============================================
// SUBSCRIPTIONS API - PIX R$29 dia 01, carência 06, trial até próximo 01
// ============================================
function nextDueDateStr(from = new Date()){
  const d = new Date(from); d.setDate(1); d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
}
export const subscriptionsApi = {
  async get(storeId){
    const { data, error } = await supabase.from('subscriptions').select('*').eq('store_id', storeId).maybeSingle();
    return { data, error };
  },
  async ensure(storeId){
    const { data: rpcData, error: rpcErr } = await supabase.rpc('ensure_subscription', { p_store_id: storeId });
    if(!rpcErr) return this.get(storeId);
    // fallback sem RPC: cria trial manual até próximo dia 01
    const { data: existing } = await this.get(storeId);
    if(existing) return { data: existing, error: null };
    const due = nextDueDateStr(new Date());
    const { data: insData, error: insErr } = await supabase.from('subscriptions').insert([{ store_id: storeId, plan_amount: 29.00, status: 'trial', current_period_start: new Date().toISOString().slice(0,10), current_period_end: due, trial_ends_at: due }]).select().single();
    return { data: insData, error: insErr };
  },
  async listPayments(storeId, limit=12){
    const { data, error } = await supabase.from('payments').select('*').eq('store_id', storeId).order('due_date', {ascending:false}).limit(limit);
    return { data, error };
  }
};

export const paymentsApi = {
  async latest(storeId){
    const { data, error } = await supabase.from('payments').select('*').eq('store_id', storeId).order('due_date', {ascending:false}).limit(1).maybeSingle();
    return { data, error };
  }
};

// ============================================
// OFFERS API - Motor de ofertas por regras
// ============================================
export const offersApi = {
  async list(storeId){
    const { data, error } = await supabase.from('offers').select('*').eq('store_id', storeId).eq('active', true).order('display_order');
    return { data, error };
  },
  async listAll(storeId){
    const { data, error } = await supabase.from('offers').select('*').eq('store_id', storeId).order('display_order');
    return { data, error };
  },
  async getWithGroups(offerId){
    const { data: offer, error: oErr } = await supabase.from('offers').select('*').eq('id', offerId).single();
    if(oErr) return { data: null, error: oErr };
    const { data: groups } = await supabase.from('offer_groups').select('*, offer_group_items(*, products(name, base_price))').eq('offer_id', offerId).order('display_order');
    const { data: schedules } = await supabase.from('offer_schedules').select('*').eq('offer_id', offerId);
    return { data: { ...offer, groups: groups||[], schedules: schedules||[] }, error: null };
  },
  async create(storeId, payload){
    // payload: {name, description, price, active, max_per_order, display_order, groups:[{name, quantity, items:[{product_id, extra_price}]} ], schedules:[{weekday, start_time, end_time}]}
    const { groups, schedules, ...offerData } = payload;
    const { data: offer, error: oErr } = await supabase.from('offers').insert([{ ...offerData, store_id: storeId }]).select().single();
    if(oErr) return { data:null, error:oErr };
    if(groups?.length){
      for(const g of groups){
        const { items, ...gData } = g;
        const { data: grp, error: gErr } = await supabase.from('offer_groups').insert([{ ...gData, offer_id: offer.id }]).select().single();
        if(gErr) return { data:null, error:gErr };
        if(items?.length){
          const rows = items.map(it=>({ group_id: grp.id, product_id: it.product_id, extra_price: it.extra_price||0 }));
          const { error: iErr } = await supabase.from('offer_group_items').insert(rows);
          if(iErr) return { data:null, error:iErr };
        }
      }
    }
    if(schedules?.length){
      const rows = schedules.map(s=>({ offer_id: offer.id, weekday: s.weekday, start_time: s.start_time, end_time: s.end_time }));
      const { error: sErr } = await supabase.from('offer_schedules').insert(rows);
      if(sErr) return { data:null, error:sErr };
    }
    return { data: offer, error: null };
  },
  async update(id, updates){
    const { groups, schedules, ...offerData } = updates;
    const { data, error } = await supabase.from('offers').update(offerData).eq('id', id).select().single();
    return { data, error };
  },
  async delete(id){
    const { error } = await supabase.from('offers').delete().eq('id', id);
    return { error };
  },
  async isActiveNow(offer, now=new Date()){
    if(!offer.active) return false;
    if(!offer.schedules || !offer.schedules.length) return true;
    const wd = now.getDay();
    const cur = now.getHours()*60+now.getMinutes();
    return offer.schedules.some(s=>{
      if(s.weekday !== wd) return false;
      const [sh,sm]=s.start_time.split(':').map(Number);
      const [eh,em]=s.end_time.split(':').map(Number);
      const start=sh*60+sm, end=eh*60+em;
      if(end<start) return cur>=start || cur<=end;
      return cur>=start && cur<=end;
    });
  }
};

export const offerGroupsApi = {
  async list(offerId){ const { data, error } = await supabase.from('offer_groups').select('*, offer_group_items(*)').eq('offer_id', offerId).order('display_order'); return { data, error }; },
  async create(offerId, payload){ const { data, error } = await supabase.from('offer_groups').insert([{ ...payload, offer_id: offerId }]).select().single(); return { data, error }; },
  async update(id, updates){ const { data, error } = await supabase.from('offer_groups').update(updates).eq('id', id).select().single(); return { data, error }; },
  async delete(id){ const { error } = await supabase.from('offer_groups').delete().eq('id', id); return { error }; }
};

export const offerGroupItemsApi = {
  async list(groupId){ const { data, error } = await supabase.from('offer_group_items').select('*').eq('group_id', groupId); return { data, error }; },
  async upsert(groupId, productId, extra_price=0){ const { data, error } = await supabase.from('offer_group_items').upsert({ group_id: groupId, product_id: productId, extra_price }, { onConflict: 'group_id,product_id' }).select().single(); return { data, error }; },
  async delete(id){ const { error } = await supabase.from('offer_group_items').delete().eq('id', id); return { error }; }
};

export const offerSchedulesApi = {
  async list(offerId){ const { data, error } = await supabase.from('offer_schedules').select('*').eq('offer_id', offerId).order('weekday'); return { data, error }; },
  async create(offerId, payload){ const { data, error } = await supabase.from('offer_schedules').insert([{ ...payload, offer_id: offerId }]).select().single(); return { data, error }; },
  async delete(id){ const { error } = await supabase.from('offer_schedules').delete().eq('id', id); return { error }; }
};

// ============================================
// CAMPAIGNS API - Agrupa ofertas em período
// ============================================
export const campaignsApi = {
  async list(storeId){
    const { data, error } = await supabase.from('campaigns').select('*').eq('store_id', storeId).order('display_order');
    return { data, error };
  },
  async listActive(storeId, now=new Date()){
    const today = now.toISOString().slice(0,10);
    const { data, error } = await supabase.from('campaigns').select('*').eq('store_id', storeId).eq('active', true).lte('start_date', today).gte('end_date', today).order('display_order');
    return { data, error };
  },
  async getWithOffers(campaignId){
    const { data: camp, error: cErr } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
    if(cErr) return { data:null, error:cErr };
    const { data: links } = await supabase.from('campaign_offers').select('offer_id').eq('campaign_id', campaignId);
    const offerIds = (links||[]).map(r=>r.offer_id);
    let offers=[];
    if(offerIds.length){
      const { data: offs } = await supabase.from('offers').select('*').in('id', offerIds);
      offers = offs||[];
    }
    return { data: { ...camp, offers }, error: null };
  },
  async create(storeId, payload){
    const { offer_ids, ...campData } = payload;
    const { data: camp, error } = await supabase.from('campaigns').insert([{ ...campData, store_id: storeId }]).select().single();
    if(error) return { data:null, error };
    if(offer_ids?.length){
      const rows = offer_ids.map(oid=>({ campaign_id: camp.id, offer_id: oid }));
      const { error: lErr } = await supabase.from('campaign_offers').insert(rows);
      if(lErr) return { data:null, error:lErr };
    }
    return { data: camp, error: null };
  },
  async update(id, updates){
    const { offer_ids, ...campData } = updates;
    const { data, error } = await supabase.from('campaigns').update(campData).eq('id', id).select().single();
    if(error) return { data:null, error };
    if(offer_ids !== undefined){
      await supabase.from('campaign_offers').delete().eq('campaign_id', id);
      if(offer_ids.length){
        const rows = offer_ids.map(oid=>({ campaign_id: id, offer_id: oid }));
        const { error: lErr } = await supabase.from('campaign_offers').insert(rows);
        if(lErr) return { data:null, error:lErr };
      }
    }
    return { data, error: null };
  },
  async delete(id){
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    return { error };
  }
};

export default supabase;