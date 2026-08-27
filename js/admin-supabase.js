/**
 * Admin Panel - Supabase Version
 * Multi-tenant SaaS com autenticação Supabase Auth
 * Sistema de Convites (invite-only)
 */

import { supabase, auth, storeApi, categoriesApi, productsApi, addonGroupsApi, addonOptionsApi, neighborhoodsApi, ordersApi, settingsApi, storageApi, invitesApi, profilesApi, pizzaSizesApi, productSizePricesApi } from './lib/supabase.js?v=16';
import storage from './state/storage-supabase.js?v=16';

// Expose para compatibilidade global
window.supabase = supabase;
window.auth = auth;
window.storeApi = storeApi;
window.categoriesApi = categoriesApi;
window.productsApi = productsApi;
window.addonGroupsApi = addonGroupsApi;
window.addonOptionsApi = addonOptionsApi;
window.pizzaSizesApi = pizzaSizesApi;
window.productSizePricesApi = productSizePricesApi;
window.neighborhoodsApi = neighborhoodsApi;
window.ordersApi = ordersApi;
window.settingsApi = settingsApi;
window.storageApi = storageApi;
window.invitesApi = invitesApi;
window.profilesApi = profilesApi;
window.storage = storage;

// Estado global
let currentStoreId = null;
let currentStore = null;
let currentUser = null;
let currentUserProfile = null;
let ordersSubscription = null;
let isSuperadmin = false;
let authInitialized = false;

// Utilitários
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.2rem;line-height:1;">✕</button>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (cleaned.length === 10) return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return phone;
}

// Compressão de imagem para cardápio (max 800px, JPEG 0.7)
async function compressImage(file, maxSide = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Falha ao comprimir'));
        resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Imagem inválida'));
    img.src = URL.createObjectURL(file);
  });
}

// ============================================
// AUTENTICAÇÃO
// ============================================

async function initAuth() {
  const authGate = document.getElementById('authGate');
  const adminLayout = document.getElementById('adminLayout');
  const passwordForm = document.getElementById('passwordForm');
  const inviteSignupForm = document.getElementById('inviteSignupForm');
  const logoutBtn = document.getElementById('logoutBtn');

  // ============================================
  // PRIMEIRO: registra TODOS os event listeners
  // ============================================

  // Password Form
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('passwordBtn');
    const email = document.getElementById('passwordEmail').value.trim();
    const password = document.getElementById('passwordInput').value;
    const errorEl = document.getElementById('passwordError');

    btn.disabled = true;
    btn.textContent = 'Entrando...';
    errorEl.textContent = '';

    const { error } = await auth.signIn(email, password);
    
    if (error) {
      errorEl.textContent = error.message;
    }
    btn.disabled = false;
    btn.textContent = 'Entrar';
  });

  // Invite Signup Form
  inviteSignupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('inviteSignupBtn');
    const email = document.getElementById('inviteSignupEmail').value.trim();
    const fullName = '';
    const password = document.getElementById('inviteSignupPassword').value;
    const token = document.getElementById('inviteTokenValue').value;
    const errorEl = document.getElementById('inviteSignupError');

    btn.disabled = true;
    btn.textContent = 'Criando conta...';
    errorEl.textContent = '';

    // Valida convite antes de criar conta
    const { data: inviteResult, error: inviteError } = await invitesApi.validate(token);
    if (inviteError || !inviteResult?.[0]?.is_valid) {
      errorEl.textContent = 'Convite inválido ou expirado. Solicite um novo convite.';
      btn.disabled = false;
      btn.textContent = '🚀 Criar Conta';
      return;
    }
    // Garante que o e-mail digitado é o convidado
    let expectedEmail = inviteResult[0].invite_email || inviteResult[0].email;
    if (!expectedEmail) {
      const { data: inv } = await supabase.from('invites').select('email').eq('token', token).maybeSingle();
      expectedEmail = inv?.email || '';
    }
    if (email.toLowerCase() !== expectedEmail.toLowerCase()) {
      errorEl.textContent = `Use o e-mail convidado: ${expectedEmail}`;
      btn.disabled = false;
      btn.textContent = '🚀 Criar Conta';
      return;
    }

    // Cria conta com token no metadata
    const { data, error } = await auth.signUpWithInvite(email, password, token, fullName);
    
    if (error) {
      if (error.message.includes('already registered')) {
        errorEl.textContent = 'Este e-mail já possui conta. Faça login normalmente.';
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        errorEl.textContent = 'Limite de e-mails atingido. Desative "Confirm email" no Supabase Auth ou aguarde 1h / use outro e-mail.';
      } else {
        errorEl.textContent = error.message;
      }
    } else if (data?.user) {
      showToast('✅ Conta criada! Entrando...', 'success');
      setTimeout(() => location.reload(), 1200);
    }
    btn.disabled = false;
    btn.textContent = '🚀 Criar Conta';
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
  });

  // Listener de mudanças de auth
  auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      // Na primeira carga, o getSession() manual já cuida disso
      if (authInitialized) {
        if (window.location.search.includes('invite=')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        onAuthSuccess(session.user);
      } else {
        authInitialized = true;
      }
    } else if (event === 'SIGNED_OUT') {
      authInitialized = false;
      onAuthLogout();
    }
  });

  // ============================================
  // DEPOIS: verifica sessão / convite
  // ============================================

  // Verifica se veio com token de convite na URL
  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get('invite');

  if (inviteToken) {
    await setupInviteSignup(inviteToken);
    authGate.classList.add('active');
    return;
  }

  // Verifica sessão existente
  const session = await auth.getSession();
  if (session?.user) {
    await onAuthSuccess(session.user);
    return;
  }
}

async function setupInviteSignup(token) {
  const inviteSignupForm = document.getElementById('inviteSignupForm');
  const passwordForm = document.getElementById('passwordForm');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const inviteTokenInput = document.getElementById('inviteTokenValue');
  const inviteStoreHint = document.getElementById('inviteStoreHint');

  // Valida token
  const { data: result } = await invitesApi.validate(token);
  
  if (!result?.[0]?.is_valid) {
    authSubtitle.textContent = 'Este convite é inválido ou expirou.';
    passwordForm.style.display = 'none';
    return;
  }

  const invite = result[0];
  inviteTokenInput.value = token;

  // Busca e-mail do convite (validate pode não retornar, então busca direta)
  let inviteEmail = invite.invite_email || invite.email;
  if (!inviteEmail) {
    const { data: inv } = await supabase.from('invites').select('email').eq('token', token).maybeSingle();
    inviteEmail = inv?.email || '';
  }

  // Mostra formulário de convite, esconde login
  inviteSignupForm.style.display = 'flex';
  passwordForm.style.display = 'none';
  authTitle.textContent = '✉️ Cadastro por Convite';

  // Preenche e-mail travado no convidado
  const emailInput = document.getElementById('inviteSignupEmail');
  emailInput.value = inviteEmail;
  emailInput.readOnly = true;
  emailInput.style.background = 'var(--bg-input)';
  emailInput.style.opacity = '0.7';
  emailInput.title = 'E-mail do convite - não pode ser alterado';
  if (invite.store_name) {
    inviteStoreHint.textContent = `Loja: ${invite.store_name}`;
  } else {
    inviteStoreHint.textContent = `Convite para ${inviteEmail} - configure sua loja após o cadastro.`;
  }
}

async function onAuthSuccess(user) {
  currentUser = user;
  console.log('✅ Usuário logado:', user.email);

  // Busca perfil e store_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  currentUserProfile = profile;
  isSuperadmin = profile?.role === 'superadmin';

  // Se tem loja associada, carrega normalmente
  if (profile?.store_id) {
    currentStoreId = profile.store_id;
    await storage.init(currentStoreId);
    await loadStoreData();
    showAdminLayout(user);
    startOrdersRealtime();
    return;
  }

  // Se NÃO tem loja: primeiro login → mostra formulário criar loja
  showCreateStorePanel(user, profile);
}

function showAdminLayout(user) {
  document.getElementById('authGate').classList.remove('active');
  document.getElementById('adminLayout').classList.add('authenticated');
  document.getElementById('userBadge').style.display = 'flex';
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userAvatar').textContent = user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U';

  // Mostra aba de convites se superadmin
  if (isSuperadmin) {
    document.getElementById('navTabInvites').style.display = 'flex';
  }
}

function showCreateStorePanel(user, profile) {
  document.getElementById('authGate').classList.remove('active');
  document.getElementById('adminLayout').classList.add('authenticated');
  document.getElementById('userBadge').style.display = 'flex';
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userAvatar').textContent = user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U';
  document.getElementById('sidebarStoreName').textContent = 'Criar Loja';

  // Esconde todas as tabs normais, mostra apenas create-store
  document.querySelectorAll('.admin-nav-item').forEach(item => item.style.display = 'none');
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById('tab-create-store').classList.add('active');
  document.getElementById('pageTitle').textContent = 'Criar Sua Loja';

  // Mostra aba convites se superadmin
  if (isSuperadmin) {
    document.getElementById('navTabInvites').style.display = 'flex';
  }

  showToast('Configure sua loja para começar!', 'info');
}

function onAuthLogout() {
  currentUser = null;
  currentUserProfile = null;
  currentStoreId = null;
  currentStore = null;
  isSuperadmin = false;
  if (ordersSubscription) ordersSubscription.unsubscribe();
  
  document.getElementById('authGate').classList.add('active');
  document.getElementById('adminLayout').classList.remove('authenticated');
  document.getElementById('userBadge').style.display = 'none';
  document.getElementById('navTabInvites').style.display = 'none';
  
  // Restore nav items
  document.querySelectorAll('.admin-nav-item').forEach(item => item.style.display = 'flex');
  
  // Reset forms
  document.getElementById('passwordForm').reset();
  document.getElementById('inviteSignupForm').reset();
  document.getElementById('passwordForm').style.display = 'block';
  document.getElementById('inviteSignupForm').style.display = 'none';
  document.getElementById('authTitle').textContent = '🍕 Cardápio Online';
  document.getElementById('authSubtitle').textContent = 'Painel administrativo multi-loja. Faça login para gerenciar sua pizzaria.';

  // Clean URL
  if (window.location.search.includes('invite=')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

async function loadStoreData() {
  const { data: store, error } = await storeApi.getById(currentStoreId);
  if (error || !store) {
    showToast('Erro ao carregar loja: ' + (error?.message || 'não encontrada'), 'error');
    return;
  }

  currentStore = store;
  document.getElementById('sidebarStoreName').textContent = store.name;
  
  // Preenche formulário
  document.getElementById('storeNameInput').value = store.name || '';
  document.getElementById('storeSlugInput').value = store.slug || '';
  document.getElementById('storePhoneInput').value = store.phone || '';
  document.getElementById('storePhoneDisplayInput').value = store.phone_display || '';
  document.getElementById('storeAddressInput').value = store.address || '';
  document.getElementById('storeHoursInput').value = store.opening_hours || '';
  document.getElementById('storeDeliveryFeeInput').value = store.default_delivery_fee || 7.00;
  document.getElementById('storeMinOrderInput').value = store.min_order_value || 35.00;
  document.getElementById('storeLogoCurrentUrl').value = store.logo_url || '';
  document.getElementById('storeCoverCurrentUrl').value = store.cover_url || '';
  document.getElementById('storeLogoInput').value = '';
  document.getElementById('storeCoverInput').value = '';
  if (store.logo_url) showPreview('storeLogoPreview', store.logo_url);
  else document.getElementById('storeLogoPreview').innerHTML = '';
  if (store.cover_url) showPreview('storeCoverPreview', store.cover_url);
  else document.getElementById('storeCoverPreview').innerHTML = '';

  const isOpen = store.status === 'open';
  const statusInput = document.getElementById('storeStatusInput');
  const statusText = document.getElementById('storeStatusText');
  statusInput.checked = isOpen;
  statusText.textContent = isOpen ? 'Aberto' : 'Fechado';
  statusText.style.color = isOpen ? 'var(--status-open)' : 'var(--status-closed)';

  // Live preview file (once)
  const logoInput = document.getElementById('storeLogoInput');
  const coverInput = document.getElementById('storeCoverInput');
  if (!logoInput._previewBound) {
    logoInput._previewBound = true;
    logoInput.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) {
        if (f.size > 5*1024*1024) { showToast('Logo muito grande (max 5MB)','error'); e.target.value=''; return; }
        showPreview('storeLogoPreview', URL.createObjectURL(f));
      } else if (document.getElementById('storeLogoCurrentUrl').value) {
        showPreview('storeLogoPreview', document.getElementById('storeLogoCurrentUrl').value);
      } else document.getElementById('storeLogoPreview').innerHTML = '';
    });
  }
  if (!coverInput._previewBound) {
    coverInput._previewBound = true;
    coverInput.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) {
        if (f.size > 5*1024*1024) { showToast('Capa muito grande (max 5MB)','error'); e.target.value=''; return; }
        showPreview('storeCoverPreview', URL.createObjectURL(f));
      } else if (document.getElementById('storeCoverCurrentUrl').value) {
        showPreview('storeCoverPreview', document.getElementById('storeCoverCurrentUrl').value);
      } else document.getElementById('storeCoverPreview').innerHTML = '';
    });
  }

  // Atualiza link público
  updatePublicUrl(store.slug);
}

function showPreview(containerId, url) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 180px; max-height: 100px; border-radius: var(--radius-md); border: 1px solid var(--border);" />`;
}

function getBaseUrl() {
  // Preserve GitHub Pages subpath (/cardapioonline) if present
  return window.location.origin + window.location.pathname.replace(/\/admin\.html.*$/, '');
}
function updatePublicUrl(slug) {
  const baseUrl = getBaseUrl();
  const publicUrl = `${baseUrl}/index.html?store=${slug}`;
  const el = document.getElementById('publicStoreUrl');
  if (el) el.textContent = publicUrl;
  const topBtn = document.getElementById('btnTopOpenMenu');
  if (topBtn) topBtn.href = publicUrl;
}

// ============================================
// STORE SETTINGS
// ============================================

document.getElementById('storeSettingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentStoreId) return;

  showLoading(true);
  // Upload logo/cover se houver novo arquivo
  let logoUrl = document.getElementById('storeLogoCurrentUrl').value;
  let coverUrl = document.getElementById('storeCoverCurrentUrl').value;
  const logoFile = document.getElementById('storeLogoInput').files?.[0];
  const coverFile = document.getElementById('storeCoverInput').files?.[0];
  try {
    if (logoFile) {
      const comp = await compressImage(logoFile, 800, 0.7);
      const { data, error } = await storageApi.uploadProductImage(currentStoreId, comp, comp.name);
      if (error) throw error;
      logoUrl = storageApi.getPublicUrl(data.path);
    }
    if (coverFile) {
      const comp = await compressImage(coverFile, 1200, 0.75);
      const { data, error } = await storageApi.uploadProductImage(currentStoreId, comp, comp.name);
      if (error) throw error;
      coverUrl = storageApi.getPublicUrl(data.path);
    }
  } catch (err) {
    showLoading(false);
    showToast('Erro imagem: ' + err.message, 'error');
    return;
  }

  const updates = {
    name: document.getElementById('storeNameInput').value.trim(),
    slug: document.getElementById('storeSlugInput').value.trim().toLowerCase(),
    phone: document.getElementById('storePhoneInput').value.replace(/\D/g, ''),
    phone_display: document.getElementById('storePhoneDisplayInput').value.trim(),
    address: document.getElementById('storeAddressInput').value.trim(),
    opening_hours: document.getElementById('storeHoursInput').value.trim(),
    default_delivery_fee: Number(document.getElementById('storeDeliveryFeeInput').value) || 7.00,
    min_order_value: Number(document.getElementById('storeMinOrderInput').value) || 35.00,
    logo_url: logoUrl,
    cover_url: coverUrl,
    status: document.getElementById('storeStatusInput').checked ? 'open' : 'closed'
  };

  showLoading(true);
  const { data, error } = await storeApi.update(currentStore.id, updates);
  showLoading(false);

  if (error) {
    showToast('Erro ao salvar: ' + error.message, 'error');
  } else {
    currentStore = data;
    document.getElementById('sidebarStoreName').textContent = data.name;
    updatePublicUrl(data.slug);
    showToast('✅ Configurações salvas!', 'success');
  }
});

document.getElementById('storeStatusInput').addEventListener('change', (e) => {
  const statusText = document.getElementById('storeStatusText');
  statusText.textContent = e.target.checked ? 'Aberto' : 'Fechado';
  statusText.style.color = e.target.checked ? 'var(--status-open)' : 'var(--status-closed)';
});

// ============================================
// CATEGORIAS
// ============================================

async function renderCategories() {
  const container = document.getElementById('categoriesListContainer');
  const { data, error } = await categoriesApi.list(currentStoreId);
  
  if (error) {
    container.innerHTML = `<p style="color: var(--status-closed);">Erro: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Nenhuma categoria. Clique em "+ Nova Categoria".</p>`;
    return;
  }

  container.innerHTML = data.map(cat => `
    <div class="item-row">
      <div class="item-main">
        <div style="font-size: 1.3rem;">📂</div>
        <div>
          <div class="item-info-title">${cat.name}</div>
          <div class="item-info-meta">Ordem: ${cat.display_order}</div>
        </div>
      </div>
      <div class="table-actions">
        <button class="btn btn-secondary btn-sm btn-edit-cat" data-id="${cat.id}">✏️ Editar</button>
        <button class="btn btn-secondary btn-sm btn-del-cat" data-id="${cat.id}" style="color: #ef4444;">🗑️</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-edit-cat').forEach(btn => 
    btn.addEventListener('click', () => openCategoryModal(btn.dataset.id))
  );
  container.querySelectorAll('.btn-del-cat').forEach(btn => 
    btn.addEventListener('click', () => deleteCategory(btn.dataset.id))
  );
}

function openCategoryModal(catId = null) {
  const titleEl = document.getElementById('categoryModalTitle');
  const idInput = document.getElementById('catEditId');
  const nameInput = document.getElementById('catNameInput');
  const orderInput = document.getElementById('catOrderInput');
  const modal = document.getElementById('categoryModalBackdrop');

  if (catId) {
    titleEl.textContent = 'Editar Categoria';
    idInput.value = catId;
    // Busca dados da categoria
    categoriesApi.list(currentStoreId).then(({ data }) => {
      const cat = data?.find(c => c.id === catId);
      if (cat) {
        nameInput.value = cat.name;
        orderInput.value = cat.display_order || 1;
      }
    });
  } else {
    titleEl.textContent = 'Nova Categoria';
    idInput.value = '';
    nameInput.value = '';
    orderInput.value = 1;
  }
  modal.classList.add('active');
}

function closeCategoryModal() {
  document.getElementById('categoryModalBackdrop').classList.remove('active');
}

document.getElementById('btnNewCategory').addEventListener('click', () => openCategoryModal());
document.getElementById('btnCloseCategoryModal').addEventListener('click', closeCategoryModal);
document.getElementById('btnCancelCategory').addEventListener('click', closeCategoryModal);

document.getElementById('categoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('catEditId').value;
  const name = document.getElementById('catNameInput').value.trim();
  const display_order = Number(document.getElementById('catOrderInput').value) || 1;

  showLoading(true);
  let error;
  if (id) {
    const result = await categoriesApi.update(id, { name, display_order });
    error = result.error;
  } else {
    const result = await categoriesApi.create(currentStoreId, { name, display_order });
    error = result.error;
  }
  showLoading(false);

  if (error) {
    showToast('Erro: ' + error.message, 'error');
  } else {
    closeCategoryModal();
    renderCategories();
    updateCategoryDropdowns();
    showToast('✅ Categoria salva!', 'success');
  }
});

async function deleteCategory(catId) {
  if (!confirm('Excluir esta categoria? Produtos vinculados ficarão sem categoria.')) return;
  
  showLoading(true);
  const { error } = await categoriesApi.delete(catId);
  showLoading(false);

  if (error) {
    showToast('Erro: ' + error.message, 'error');
  } else {
    renderCategories();
    updateCategoryDropdowns();
    showToast('🗑️ Categoria removida', 'success');
  }
}

// ============================================
// PRODUTOS
// ============================================

async function updateCategoryDropdowns() {
  const { data } = await categoriesApi.list(currentStoreId);
  const options = data?.map(c => `<option value="${c.id}">${c.name}</option>`).join('') || '';
  
  document.getElementById('filterProductCategory').innerHTML = 
    `<option value="">Todas as Categorias</option>` + options;
  document.getElementById('prodCategorySelect').innerHTML = options;
}

async function renderProducts() {
  const container = document.getElementById('productsListContainer');
  const selectedCat = document.getElementById('filterProductCategory').value;
  const searchQuery = document.getElementById('filterProductSearch').value.trim().toLowerCase();

  const { data, error } = await productsApi.listAdmin(currentStoreId);
  
  if (error) {
    container.innerHTML = `<p style="color: var(--status-closed);">Erro: ${error.message}</p>`;
    return;
  }

  // Ordena por codigo se existir
  let filtered = (data || []).slice().sort((a,b)=> (a.codigo||9999) - (b.codigo||9999) || a.display_order - b.display_order);
  if (selectedCat) filtered = filtered.filter(p => p.category_id === selectedCat);
  if (searchQuery) filtered = filtered.filter(p => 
    p.name.toLowerCase().includes(searchQuery) ||
    (p.description && p.description.toLowerCase().includes(searchQuery)) ||
    String(p.codigo||'').includes(searchQuery)
  );

  if (!filtered.length) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Nenhum produto encontrado.</p>`;
    return;
  }

  container.innerHTML = filtered.map(prod => {
    const catName = prod.categories?.name || 'Sem categoria';
    const codigoStr = prod.codigo ? String(prod.codigo).padStart(3,'0') : '—';
    return `
      <div class="item-row">
        <div class="item-main">
          ${prod.image_url ? `<img src="${prod.image_url}" class="item-thumb" alt="${prod.name}" />` : ''}
          <div>
            <div class="item-info-title"><span style="color:var(--primary); font-weight:800; margin-right:0.35rem;">#${codigoStr}</span> ${prod.name} ${!prod.available ? '<span class="badge badge-closed">Pausado</span>' : ''}</div>
            <div class="item-info-meta">
              ${catName} • 
              <strong style="color: var(--secondary);">${formatCurrency(prod.base_price)}</strong>
              ${prod.has_crusts ? ' • Borda' : ''}
              ${prod.has_extras ? ' • Extras' : ''}
            </div>
          </div>
        </div>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm btn-edit-prod" data-id="${prod.id}">✏️ Editar</button>
          <button class="btn btn-secondary btn-sm btn-del-prod" data-id="${prod.id}" style="color: #ef4444;">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-edit-prod').forEach(btn => 
    btn.addEventListener('click', () => openProductModal(btn.dataset.id))
  );
  container.querySelectorAll('.btn-del-prod').forEach(btn => 
    btn.addEventListener('click', () => deleteProduct(btn.dataset.id))
  );
}

document.getElementById('filterProductCategory').addEventListener('change', renderProducts);
document.getElementById('filterProductSearch').addEventListener('input', renderProducts);

async function getNextCodigo() {
  const { data, error } = await productsApi.listAdmin(currentStoreId);
  if (error || !data || data.length === 0) return 101;
  const used = new Set(data.map(p => Number(p.codigo)).filter(n => n >= 1 && n <= 999));
  if (used.size === 0) return 101;
  // Reusa primeira lacuna em 101..999 (padrão centenas), depois 1..100
  for (let n = 101; n <= 999; n++) if (!used.has(n)) return n;
  for (let n = 1; n < 101; n++) if (!used.has(n)) return n;
  // Lotado (999 itens) - retorna próximo sequencial e deixa validação acusar
  return Math.max(...used) + 1;
}

async function openProductModal(prodId = null) {
  const titleEl = document.getElementById('productModalTitle');
  const idInput = document.getElementById('prodEditId');
  const codigoInput = document.getElementById('prodCodigoInput');
  const nameInput = document.getElementById('prodNameInput');
  const catSelect = document.getElementById('prodCategorySelect');
  const priceInput = document.getElementById('prodPriceInput');
  const descInput = document.getElementById('prodDescriptionInput');
  const imgInput = document.getElementById('prodImageInput');
  const imgCurrent = document.getElementById('prodImageCurrentUrl');
  const isPizzaInput = document.getElementById('prodIsPizzaInput');
  const crustsInput = document.getElementById('prodHasCrustsInput');
  const extrasInput = document.getElementById('prodHasExtrasInput');
  const availInput = document.getElementById('prodAvailableInput');
  const previewContainer = document.getElementById('prodImagePreview');
  const priceContainer = document.getElementById('prodSizePricesContainer');
  const modal = document.getElementById('productModalBackdrop');

  updateCategoryDropdowns();

  if (prodId) {
    titleEl.textContent = 'Editar Produto';
    idInput.value = prodId;
    const { data: prod } = await productsApi.getById(prodId);
    if (prod) {
      codigoInput.value = prod.codigo || await getNextCodigo();
      nameInput.value = prod.name;
      catSelect.value = prod.category_id;
      priceInput.value = prod.base_price;
      descInput.value = prod.description || '';
      imgInput.value = '';
      imgCurrent.value = prod.image_url || '';
      if (prod.image_url) showPreview('prodImagePreview', prod.image_url);
      else previewContainer.innerHTML = '';
      isPizzaInput.checked = !!prod.is_pizza;
      crustsInput.checked = !!prod.has_crusts;
      extrasInput.checked = !!prod.has_extras;
      availInput.checked = prod.available !== false;
      // mostra precos por tamanho se pizza
      if (prod.is_pizza) {
        priceContainer.style.display = 'block';
        document.getElementById('prodPriceInput').parentElement.style.display='none';
        await renderProdSizePrices(prodId);
      } else {
        priceContainer.style.display = 'none';
        document.getElementById('prodPriceInput').parentElement.style.display='block';
      }
    }
  } else {
    titleEl.textContent = 'Novo Produto';
    idInput.value = '';
    const next = await getNextCodigo();
    codigoInput.value = next;
    nameInput.value = '';
    priceInput.value = '';
    descInput.value = '';
    imgInput.value = '';
    imgCurrent.value = '';
    previewContainer.innerHTML = '';
    isPizzaInput.checked = false;
    crustsInput.checked = true;
    extrasInput.checked = true;
    availInput.checked = true;
    priceContainer.style.display = 'none';
    document.getElementById('prodPriceInput').parentElement.style.display='block';
  }

  isPizzaInput.onchange = () => {
    if (isPizzaInput.checked) {
      priceContainer.style.display = 'block';
      document.getElementById('prodPriceInput').parentElement.style.display='none';
      renderProdSizePrices(prodId);
    } else {
      priceContainer.style.display = 'none';
      document.getElementById('prodPriceInput').parentElement.style.display='block';
    }
  };

  imgInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('⚠️ Imagem muito grande (max 5MB)', 'error');
        imgInput.value = '';
        return;
      }
      const url = URL.createObjectURL(file);
      showPreview('prodImagePreview', url);
    } else if (imgCurrent.value) {
      showPreview('prodImagePreview', imgCurrent.value);
    } else {
      previewContainer.innerHTML = '';
    }
  };

  modal.classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModalBackdrop').classList.remove('active');
}

document.getElementById('btnNewProduct').addEventListener('click', () => openProductModal());
document.getElementById('btnCloseProductModal').addEventListener('click', closeProductModal);
document.getElementById('btnCancelProduct').addEventListener('click', closeProductModal);

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('prodEditId').value;
  const fileInput = document.getElementById('prodImageInput');
  const currentUrl = document.getElementById('prodImageCurrentUrl').value;

  // Upload com compressão se houver arquivo novo
  let imageUrl = currentUrl || '';
  if (fileInput.files?.[0]) {
    try {
      const compressed = await compressImage(fileInput.files[0], 800, 0.7);
      const { data, error } = await storageApi.uploadProductImage(currentStoreId, compressed, compressed.name);
      if (error) throw error;
      imageUrl = storageApi.getPublicUrl(data.path);
    } catch (err) {
      showToast('Erro ao enviar imagem: ' + err.message, 'error');
      return;
    }
  }

  const codigoVal = Number(document.getElementById('prodCodigoInput').value);
  if (!codigoVal || codigoVal < 1 || codigoVal > 999) {
    showToast('Código deve ser entre 1 e 999', 'error');
    return;
  }
  // Valida duplicidade na loja
  const { data: allProds } = await productsApi.listAdmin(currentStoreId);
  const dup = (allProds||[]).find(p => Number(p.codigo) === codigoVal && p.id !== id);
  if (dup) {
    showToast(`Código ${String(codigoVal).padStart(3,'0')} já usado em "${dup.name}"`, 'error');
    return;
  }

  const isPizza = document.getElementById('prodIsPizzaInput').checked;
  let basePriceVal = Number(document.getElementById('prodPriceInput').value) || 0;
  // Se pizza e tem tamanhos, base_price será o menor preço por tamanho (fallback)
  const productData = {
    codigo: codigoVal,
    name: document.getElementById('prodNameInput').value.trim(),
    category_id: document.getElementById('prodCategorySelect').value,
    base_price: isPizza ? 0 : basePriceVal,
    description: document.getElementById('prodDescriptionInput').value.trim(),
    image_url: imageUrl,
    is_pizza: isPizza,
    has_crusts: document.getElementById('prodHasCrustsInput').checked,
    has_extras: document.getElementById('prodHasExtrasInput').checked,
    available: document.getElementById('prodAvailableInput').checked
  };

  showLoading(true);
  let error;
  async function trySave(data) {
    if (id) return await productsApi.update(id, data);
    return await productsApi.create(currentStoreId, data);
  }
  let result = await trySave(productData);
  error = result.error;
  // Fallback se coluna codigo ainda não existe no Supabase (cache de schema)
  let usedFallback = false;
  if (error && error.message && error.message.includes('codigo')) {
    console.warn('Coluna codigo ausente, tentando sem codigo...', error.message);
    const { codigo, ...withoutCodigo } = productData;
    result = await trySave(withoutCodigo);
    error = result.error;
    usedFallback = !error;
  }
  // Salva preços por tamanho se pizza
  if (!error && isPizza) {
    const prodId = result.data?.id || id;
    const inputs = document.querySelectorAll('#prodSizePricesFields input[data-size-id]');
    let minPrice = null;
    for (const inp of inputs) {
      const sizeId = inp.dataset.sizeId;
      const val = inp.value.trim();
      if (val !== '' && !isNaN(val)) {
        const price = Number(val);
        await productSizePricesApi.upsert(prodId, sizeId, price);
        if (minPrice === null || price < minPrice) minPrice = price;
      } else {
        await supabase.from('product_size_prices').delete().eq('product_id', prodId).eq('size_id', sizeId);
      }
    }
    if (minPrice !== null) {
      await productsApi.update(prodId, { base_price: minPrice });
    }
  }
  showLoading(false);

  if (error) {
    if (error.message && error.message.includes('duplicate')) {
      showToast(`Código ${String(codigoVal).padStart(3,'0')} já existe nesta loja`, 'error');
    } else {
      showToast('Erro: ' + error.message, 'error');
    }
  } else {
    closeProductModal();
    renderProducts();
    if (usedFallback) showToast('⚠️ Salvo sem código - rode fix-codigo-migration.sql no Supabase', 'info');
    else showToast('✅ Produto salvo!', 'success');
  }
});

async function deleteProduct(prodId) {
  if (!confirm('Excluir este produto?')) return;
  
  showLoading(true);
  const { error } = await productsApi.delete(prodId);
  showLoading(false);

  if (error) {
    showToast('Erro: ' + error.message, 'error');
  } else {
    renderProducts();
    showToast('🗑️ Produto removido', 'success');
  }
}

// ============================================
// PEDIDOS
// ============================================

async function renderOrders() {
  const container = document.getElementById('ordersListContainer');
  const statusFilter = document.getElementById('orderStatusFilter').value;

  const { data, error } = await ordersApi.list(currentStoreId, { 
    status: statusFilter || undefined,
    limit: 50 
  });

  if (error) {
    container.innerHTML = `<p style="color: var(--status-closed);">Erro: ${error.message}</p>`;
    return;
  }

  document.getElementById('orderCountBadge').textContent = `${data?.length || 0} pedidos`;

  if (!data?.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📋</div>
        <p style="font-weight: 600; color: var(--text-secondary);">Nenhum pedido</p>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(order => {
    const dateStr = new Date(order.created_at).toLocaleString('pt-BR');
    const statusLabels = {
      received: '📥 Recebido',
      preparing: '👨‍🍳 Preparando',
      ready: '✅ Pronto',
      delivering: '🚚 Saindo',
      delivered: '🏁 Entregue',
      cancelled: '❌ Cancelado'
    };
    const statusColors = {
      received: 'var(--primary)',
      preparing: 'var(--warning)',
      ready: 'var(--status-open)',
      delivering: 'var(--info)',
      delivered: 'var(--success)',
      cancelled: 'var(--status-closed)'
    };

    return `
      <div class="admin-card" style="margin-bottom: 1rem; padding: 1.2rem; background: var(--bg-card);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;">
          <div>
            <span style="font-weight: 800; font-size: 1.05rem; color: var(--primary);">${order.order_number}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">• ${dateStr}</span>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-top: 0.2rem;">
              👤 ${order.customer_name} (${formatPhone(order.customer_phone)})
            </div>
          </div>
          <div style="text-align: right;">
            <span style="background: ${statusColors[order.status] || 'var(--primary)'}; color: white; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">
              ${statusLabels[order.status] || order.status}
            </span>
            <div style="font-weight: 800; font-size: 1.1rem; color: var(--secondary); margin-top: 0.35rem;">
              ${formatCurrency(order.total)}
            </div>
          </div>
        </div>

        <div style="font-size: 0.85rem; margin-bottom: 0.75rem; color: var(--text-secondary);">
          <strong>Itens:</strong>
          <ul style="margin-left: 1.25rem; margin-top: 0.25rem;">
            ${(order.items || []).map(item => `
              <li>
                ${item.quantity}x ${item.product_name} 
                ${item.crust ? `(Borda: ${item.crust.name})` : ''} 
                ${item.extras?.length ? ` + ${item.extras.map(e => e.name).join(', ')}` : ''}
                ${item.observation ? `— <em>"${item.observation}"</em>` : ''}
                — <strong>${formatCurrency(item.item_total)}</strong>
              </li>
            `).join('')}
          </ul>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); background: var(--bg-input); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);">
          <span>
            ${order.order_type === 'delivery' ? `📍 ${order.customer_address?.street}, ${order.customer_address?.number} (${order.customer_address?.neighborhood})` : '🏪 Retirada no Balcão'}
          </span>
          <span>💳 ${order.payment_method?.toUpperCase()}</span>
        </div>

        <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
          ${['received', 'preparing', 'ready', 'delivering'].includes(order.status) ? `
            <select class="status-select" data-order-id="${order.id}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-input); color: var(--text-primary);">
              <option value="received" ${order.status==='received'?'selected':''}>📥 Recebido</option>
              <option value="preparing" ${order.status==='preparing'?'selected':''}>👨‍🍳 Preparando</option>
              <option value="ready" ${order.status==='ready'?'selected':''}>✅ Pronto</option>
              <option value="delivering" ${order.status==='delivering'?'selected':''}>🚚 Saindo</option>
              <option value="delivered" ${order.status==='delivered'?'selected':''}>🏁 Entregue</option>
              <option value="cancelled" ${order.status==='cancelled'?'selected':''}>❌ Cancelado</option>
            </select>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Status change handlers
  container.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const orderId = e.target.dataset.orderId;
      const newStatus = e.target.value;
      showLoading(true);
      const { error } = await ordersApi.updateStatus(orderId, newStatus);
      showLoading(false);
      if (error) {
        showToast('Erro: ' + error.message, 'error');
        renderOrders();
      } else {
        showToast(`Status: ${newStatus}`, 'success');
      }
    });
  });
}

document.getElementById('orderStatusFilter').addEventListener('change', renderOrders);

function startOrdersRealtime() {
  if (ordersSubscription) ordersSubscription.unsubscribe();
  
  ordersSubscription = ordersApi.subscribeToNewOrders(currentStoreId, (newOrder) => {
    showToast(`🔔 Novo pedido: ${newOrder.order_number} - ${formatCurrency(newOrder.total)}`, 'info');
    renderOrders();
  });
}

// ============================================
// SHARE LINK & EXPORT/IMPORT
// ============================================

document.getElementById('btnCopyStoreLink').addEventListener('click', () => {
  const url = document.getElementById('publicStoreUrl').textContent;
  navigator.clipboard.writeText(url).then(() => {
    showToast('✅ Link copiado!', 'success');
  }).catch(() => {
    showToast('Copie manualmente: ' + url, 'info');
  });
});

document.getElementById('btnExportData').addEventListener('click', async () => {
  try {
    const store = await storage.getStore();
    const categories = await storage.getCategories();
    const products = await storage.getProducts();
    const addonGroups = await storage.getAddonGroups();

    const data = {
      store,
      categories,
      products,
      addon_groups: addonGroups,
      exported_at: new Date().toISOString(),
      version: '2.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cardapio-${store.slug}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ JSON baixado! Substitua no js/mock/initialData.js no GitHub.', 'success');
  } catch (err) {
    showToast('Erro ao exportar: ' + err.message, 'error');
  }
});

document.getElementById('importJsonFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.store) await storage.saveStore(data.store);
      if (data.categories) await storage.saveCategories(data.categories);
      if (data.products) await storage.saveProducts(data.products);
      if (data.addon_groups) await storage.saveAddonGroups(data.addon_groups);
      showToast('✅ Importado! Recarregue a página.', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast('Erro ao importar: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btnResetData').addEventListener('click', async () => {
  if (confirm('Restaurar dados padrão (apenas localStorage)?')) {
    await storage.resetDefaults();
    showToast('Dados padrão restaurados (local). Recarregue.', 'success');
    setTimeout(() => location.reload(), 1500);
  }
});

// ============================================
// NAVIGATION TABS
// ============================================

const navItems = document.querySelectorAll('.admin-nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');
const pageTitle = document.getElementById('pageTitle');

const tabTitles = {
  'tab-settings': 'Configurações da Loja',
  'tab-categories': 'Gestão de Categorias',
  'tab-products': 'Catálogo de Produtos & Preços',
  'tab-orders': 'Pedidos Recebidos',
  'tab-sizes': 'Tamanhos de Pizza',
  'tab-addons': 'Bordas & Extras',
  'tab-share': 'Link da Loja',
  'tab-invites': 'Gerenciar Convites',
  'tab-create-store': 'Criar Sua Loja'
};

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabId = item.dataset.tab;
    
    // Bloqueia navegação se está no "criar loja" (sem loja ainda)
    if (!currentStoreId && tabId !== 'tab-create-store' && tabId !== 'tab-invites') return;
    
    navItems.forEach(i => i.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));

    item.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');
    pageTitle.textContent = tabTitles[tabId] || 'Painel';

    if (tabId === 'tab-categories') renderCategories();
    if (tabId === 'tab-products') renderProducts();
    if (tabId === 'tab-orders') renderOrders();
    if (tabId === 'tab-sizes') renderPizzaSizes();
    if (tabId === 'tab-addons') renderAddons();
    if (tabId === 'tab-share') updatePublicUrl(currentStore?.slug);
    if (tabId === 'tab-invites') renderInvites();
  });
});

// ============================================
// CREATE STORE (Primeiro Login)
// ============================================

document.getElementById('createStoreForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const storeData = {
    owner_id: currentUser.id,
    name: document.getElementById('createStoreName').value.trim(),
    slug: document.getElementById('createStoreSlug').value.trim().toLowerCase(),
    phone: document.getElementById('createStorePhone').value.replace(/\D/g, ''),
    phone_display: document.getElementById('createStorePhoneDisplay').value.trim(),
    address: document.getElementById('createStoreAddress').value.trim(),
    status: 'open'
  };

  showLoading(true);
  const { data: store, error } = await storeApi.create(storeData);
  showLoading(false);

  if (error) {
    if (error.message.includes('unique')) {
      showToast('Este slug já existe. Escolha outro.', 'error');
    } else {
      showToast('Erro ao criar loja: ' + error.message, 'error');
    }
    return;
  }

  // Atualiza profile com store_id
  const { error: profileError } = await profilesApi.update(currentUser.id, {
    store_id: store.id,
    role: 'owner'
  });

  if (profileError) {
    showToast('Loja criada, mas erro ao vincular perfil. Contate o suporte.', 'error');
    return;
  }

  // Cria configurações padrão
  await settingsApi.upsert(store.id, {});

  // Inicializa
  currentStoreId = store.id;
  currentStore = store;
  await storage.init(currentStoreId);
  await loadStoreData();

  // Restaura UI normal
  document.querySelectorAll('.admin-nav-item').forEach(item => item.style.display = 'flex');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-settings').classList.add('active');
  document.querySelector('[data-tab="tab-settings"]').classList.add('active');
  document.getElementById('pageTitle').textContent = 'Configurações da Loja';
  document.getElementById('sidebarStoreName').textContent = store.name;

  startOrdersRealtime();
  showToast(`✅ Loja "${store.name}" criada com sucesso!`, 'success');
});

// Auto-gera slug a partir do nome
document.getElementById('createStoreName').addEventListener('input', (e) => {
  const slug = e.target.value
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  document.getElementById('createStoreSlug').value = slug;
});

// ============================================
// INVITES MANAGEMENT (Superadmin)
// ============================================

async function renderInvites() {
  if (!isSuperadmin) return;
  const container = document.getElementById('invitesListContainer');

  const { data, error } = await invitesApi.list();

  if (error) {
    container.innerHTML = `<p style="color: var(--status-closed);">Erro: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✉️</div>
        <p style="font-weight: 600; color: var(--text-secondary);">Nenhum convite enviado</p>
        <p style="font-size: 0.85rem; margin-top: 0.25rem;">Clique em "+ Novo Convite" para convidar uma pizzaria.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(invite => {
    const created = new Date(invite.created_at).toLocaleString('pt-BR');
    const expires = new Date(invite.expires_at).toLocaleString('pt-BR');
    const inviteUrl = `${getBaseUrl()}/admin.html?invite=${invite.token}`;

    return `
      <div class="admin-card" style="margin-bottom: 1rem; padding: 1.2rem; background: var(--bg-card);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem;">📧 ${invite.email}</div>
            ${invite.store_name ? `<div style="font-size: 0.8rem; color: var(--text-muted);">🏪 ${invite.store_name}</div>` : ''}
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
              Criado: ${created} • Expira: ${expires}
            </div>
          </div>
          <span class="invite-status ${invite.status}">${invite.status}</span>
        </div>
        ${invite.status === 'pending' ? `
          <div class="invite-link-box" id="inviteLink-${invite.id}">${inviteUrl}</div>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
            <button class="btn btn-secondary btn-sm btn-copy-invite" data-url="${inviteUrl}">
              📋 Copiar Link
            </button>
            <button class="btn btn-secondary btn-sm btn-revoke-invite" data-id="${invite.id}" style="color: var(--status-closed);">
              🚫 Revogar
            </button>
          </div>
        ` : ''}
        ${invite.status === 'accepted' && invite.accepted_by ? `
          <div style="font-size: 0.8rem; color: var(--status-open); margin-top: 0.5rem;">
            ✅ Aceito por: ${invite.accepted_by}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Copy invite link
  container.querySelectorAll('.btn-copy-invite').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.url).then(() => {
        showToast('✅ Link de convite copiado!', 'success');
      });
    });
  });

  // Revoke invite
  container.querySelectorAll('.btn-revoke-invite').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Revogar este convite? O link deixará de funcionar.')) return;
      showLoading(true);
      const { error } = await invitesApi.revoke(btn.dataset.id);
      showLoading(false);
      if (error) {
        showToast('Erro: ' + error.message, 'error');
      } else {
        showToast('🚫 Convite revogado', 'success');
        renderInvites();
      }
    });
  });
}

// Invite modal handlers
document.getElementById('btnNewInvite').addEventListener('click', () => {
  document.getElementById('inviteModalBackdrop').classList.add('active');
});

document.getElementById('btnCloseInviteModal').addEventListener('click', () => {
  document.getElementById('inviteModalBackdrop').classList.remove('active');
});

document.getElementById('btnCancelInvite').addEventListener('click', () => {
  document.getElementById('inviteModalBackdrop').classList.remove('active');
});

document.getElementById('inviteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('inviteEmailInput').value.trim();

  showLoading(true);
  const { data, error } = await invitesApi.create(email, null, null);
  showLoading(false);

  if (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      showToast('Já existe um convite pendente para este e-mail.', 'error');
    } else {
      showToast('Erro ao criar convite: ' + error.message, 'error');
    }
    return;
  }

  // Copia link automaticamente
  const inviteUrl = `${getBaseUrl()}/admin.html?invite=${data.token}`;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showToast(`✅ Convite criado! Link copiado para ${email}`, 'success');
  }).catch(() => {
    showToast(`✅ Convite criado! Link: ${inviteUrl}`, 'success');
  });

  document.getElementById('inviteModalBackdrop').classList.remove('active');
  document.getElementById('inviteForm').reset();
  renderInvites();
});

// ============================================
// BORDAS & EXTRAS (Addon Groups & Options)
// ============================================

async function renderAddons() {
  const container = document.getElementById('addonsListContainer');
  if (!currentStoreId) {
    container.innerHTML = `<p style="color: var(--text-muted);">Crie sua loja primeiro.</p>`;
    return;
  }
  const { data, error } = await addonGroupsApi.list(currentStoreId);
  if (error) {
    container.innerHTML = `<p style="color: var(--status-closed);">Erro: ${error.message}</p>`;
    return;
  }
  if (!data?.length) {
    container.innerHTML = `
      <div style="text-align:center; padding:2rem; color:var(--text-muted); border:1px dashed var(--border); border-radius:var(--radius-md);">
        <div style="font-size:2rem;">🧀</div>
        <p style="font-weight:600; color:var(--text-secondary);">Nenhum grupo cadastrado</p>
        <p style="font-size:0.85rem; margin-top:0.25rem;">Crie grupos como "Tamanhos", "Bordas Recheadas" e "Adicionais Extras".<br>Se deixar vazio, o cardápio usa o padrão local.</p>
      </div>`;
    return;
  }
  container.innerHTML = data.map(group => {
    const opts = group.addon_options || [];
    return `
      <div class="admin-card" style="margin-bottom:1rem; padding:1rem; border:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
          <div>
            <div style="font-weight:800;">${group.title || group.name} <span style="font-weight:400; font-size:0.75rem; color:var(--text-muted);">(${group.type === 'single' ? 'única' : 'múltipla'}${group.required ? ' • obrigatório' : ''})</span></div>
            <div style="font-size:0.75rem; color:var(--text-muted);">nome: ${group.name} • ordem: ${group.display_order} ${group.applies_to?.length ? '• aplica: ' + group.applies_to.join(',') : ''}</div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-shrink:0;">
            <button class="btn btn-secondary btn-sm btn-edit-addon-group" data-id="${group.id}">✏️</button>
            <button class="btn btn-secondary btn-sm btn-delete-addon-group" data-id="${group.id}" style="color:var(--status-closed);">🗑️</button>
          </div>
        </div>
        <div style="margin-top:0.85rem;">
          ${opts.length ? `
            <div style="display:flex; flex-direction:column; gap:0.4rem;">
              ${opts.sort((a,b)=>a.display_order-b.display_order).map(o=>`
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.5rem 0.75rem;">
                  <div>
                    <span style="font-weight:600; font-size:0.88rem;">${o.name}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.4rem;">${o.is_default ? '⭐ padrão' : ''} ${o.allows_half_half ? '• meio a meio' : ''}</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:700; font-size:0.85rem; color:var(--primary);">${o.price_diff>0?'+ ':''}${formatCurrency(o.price_diff)}</span>
                    <button class="btn btn-secondary btn-sm btn-edit-addon-option" data-id="${o.id}" data-group="${group.id}" style="padding:0.2rem 0.4rem;">✏️</button>
                    <button class="btn btn-secondary btn-sm btn-delete-addon-option" data-id="${o.id}" style="padding:0.2rem 0.4rem; color:var(--status-closed);">✕</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<p style="font-size:0.8rem; color:var(--text-muted);">Nenhuma opção ainda.</p>`}
          <button class="btn btn-secondary btn-sm btn-new-addon-option" data-group="${group.id}" style="margin-top:0.6rem;">+ Opção</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-edit-addon-group').forEach(b=> b.addEventListener('click', ()=> openAddonGroupModal(b.dataset.id)));
  container.querySelectorAll('.btn-delete-addon-group').forEach(b=> b.addEventListener('click', ()=> deleteAddonGroup(b.dataset.id)));
  container.querySelectorAll('.btn-new-addon-option').forEach(b=> b.addEventListener('click', ()=> openAddonOptionModal(b.dataset.group)));
  container.querySelectorAll('.btn-edit-addon-option').forEach(b=> b.addEventListener('click', ()=> openAddonOptionModal(b.dataset.group, b.dataset.id)));
  container.querySelectorAll('.btn-delete-addon-option').forEach(b=> b.addEventListener('click', ()=> deleteAddonOption(b.dataset.id)));
}

function openAddonGroupModal(groupId=null){
  const modal=document.getElementById('addonGroupModalBackdrop');
  const title=document.getElementById('addonGroupModalTitle');
  document.getElementById('addonGroupEditId').value=groupId||'';
  if(!groupId){
    title.textContent='Novo Grupo';
    document.getElementById('addonGroupForm').reset();
    document.getElementById('addonGroupOrderInput').value='1';
  } else {
    title.textContent='Editar Grupo';
    addonGroupsApi.list(currentStoreId).then(({data})=>{
      const g=data?.find(x=>x.id===groupId);
      if(!g) return;
      document.getElementById('addonGroupTitleInput').value=g.title||'';
      document.getElementById('addonGroupNameInput').value=g.name||'';
      document.getElementById('addonGroupTypeInput').value=g.type||'single';
      document.getElementById('addonGroupRequiredInput').checked=!!g.required;
      document.getElementById('addonGroupOrderInput').value=g.display_order||1;
      document.getElementById('addonGroupAppliesInput').value=(g.applies_to||[]).join(', ');
    });
  }
  modal.classList.add('active');
}
function closeAddonGroupModal(){ document.getElementById('addonGroupModalBackdrop').classList.remove('active'); }
async function deleteAddonGroup(id){
  if(!confirm('Excluir este grupo e todas as suas opções?')) return;
  showLoading(true);
  const {error}=await addonGroupsApi.delete(id);
  showLoading(false);
  if(error) showToast(error.message,'error'); else { showToast('🗑️ Grupo removido','success'); renderAddons(); }
}
async function openAddonOptionModal(groupId, optionId=null){
  const modal=document.getElementById('addonOptionModalBackdrop');
  const title=document.getElementById('addonOptionModalTitle');
  document.getElementById('addonOptionGroupId').value=groupId;
  document.getElementById('addonOptionEditId').value=optionId||'';
  if(!optionId){
    title.textContent='Nova Opção';
    document.getElementById('addonOptionForm').reset();
    document.getElementById('addonOptionOrderInput').value='1';
    document.getElementById('addonOptionPriceInput').value='0';
  } else {
    title.textContent='Editar Opção';
    const {data:groups}=await addonGroupsApi.list(currentStoreId);
    const g=groups?.find(x=>x.id===groupId);
    const o=g?.addon_options?.find(x=>x.id===optionId);
    if(!o) return;
    document.getElementById('addonOptionNameInput').value=o.name||'';
    document.getElementById('addonOptionPriceInput').value=o.price_diff ?? 0;
    document.getElementById('addonOptionOrderInput').value=o.display_order||1;
    document.getElementById('addonOptionDefaultInput').checked=!!o.is_default;
    document.getElementById('addonOptionHalfInput').checked=!!o.allows_half_half;
  }
  modal.classList.add('active');
}
function closeAddonOptionModal(){ document.getElementById('addonOptionModalBackdrop').classList.remove('active'); }
async function deleteAddonOption(id){
  if(!confirm('Excluir esta opção?')) return;
  showLoading(true);
  const {error}=await addonOptionsApi.delete(id);
  showLoading(false);
  if(error) showToast(error.message,'error'); else { showToast('🗑️ Opção removida','success'); renderAddons(); }
}

document.getElementById('btnNewAddonGroup').addEventListener('click', ()=> openAddonGroupModal());
document.getElementById('btnCloseAddonGroupModal').addEventListener('click', closeAddonGroupModal);
document.getElementById('btnCancelAddonGroup').addEventListener('click', closeAddonGroupModal);
document.getElementById('addonGroupForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id=document.getElementById('addonGroupEditId').value;
  const payload={
    title: document.getElementById('addonGroupTitleInput').value.trim(),
    name: document.getElementById('addonGroupNameInput').value.trim().toLowerCase().replace(/\s+/g,'_') || document.getElementById('addonGroupTitleInput').value.trim().toLowerCase().replace(/\s+/g,'_'),
    type: document.getElementById('addonGroupTypeInput').value,
    required: document.getElementById('addonGroupRequiredInput').checked,
    display_order: Number(document.getElementById('addonGroupOrderInput').value)||1,
    applies_to: document.getElementById('addonGroupAppliesInput').value.split(',').map(s=>s.trim()).filter(Boolean)
  };
  showLoading(true);
  let error;
  if(id){ const r=await addonGroupsApi.update(id,payload); error=r.error; }
  else { const r=await addonGroupsApi.create(currentStoreId,payload); error=r.error; }
  showLoading(false);
  if(error) showToast(error.message,'error');
  else { closeAddonGroupModal(); showToast('✅ Grupo salvo!','success'); renderAddons(); }
});

document.getElementById('btnCloseAddonOptionModal').addEventListener('click', closeAddonOptionModal);
document.getElementById('btnCancelAddonOption').addEventListener('click', closeAddonOptionModal);
document.getElementById('addonOptionForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id=document.getElementById('addonOptionEditId').value;
  const groupId=document.getElementById('addonOptionGroupId').value;
  const payload={
    name: document.getElementById('addonOptionNameInput').value.trim(),
    price_diff: Number(document.getElementById('addonOptionPriceInput').value)||0,
    display_order: Number(document.getElementById('addonOptionOrderInput').value)||1,
    is_default: document.getElementById('addonOptionDefaultInput').checked,
    allows_half_half: document.getElementById('addonOptionHalfInput').checked
  };
  showLoading(true);
  let error;
  if(id){ const r=await addonOptionsApi.update(id,payload); error=r.error; }
  else { const r=await addonOptionsApi.create(groupId,payload); error=r.error; }
  showLoading(false);
  if(error) showToast(error.message,'error');
  else { closeAddonOptionModal(); showToast('✅ Opção salva!','success'); renderAddons(); }
});



// ============================================
// TAMANHOS DE PIZZA
// ============================================
async function renderPizzaSizes() {
  const container = document.getElementById('pizzaSizesListContainer');
  if (!currentStoreId) { container.innerHTML='<p style="color:var(--text-muted);">Crie sua loja primeiro.</p>'; return; }
  const { data, error } = await pizzaSizesApi.listAll(currentStoreId);
  if (error) { container.innerHTML=`<p style="color:var(--status-closed);">${error.message}</p>`; return; }
  if (!data?.length) {
    container.innerHTML=`<div style="text-align:center; padding:2rem; border:1px dashed var(--border); border-radius:var(--radius-md); color:var(--text-muted);">Nenhum tamanho cadastrado. Crie P, M, G, Família etc.</div>`;
    return;
  }
  container.innerHTML = data.map(s=>`
    <div class="admin-card" style="padding:1rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:800;">${s.name} <span style="font-weight:400; font-size:0.75rem; color:var(--text-muted);">${s.slices} fatias • até ${s.max_flavors} sabor${s.max_flavors>1?'es':''} • ordem ${s.display_order} ${s.is_active?'':'• inativo'}</span></div>
      </div>
      <div style="display:flex; gap:0.4rem;">
        <button class="btn btn-secondary btn-sm btn-edit-pizza-size" data-id="${s.id}">✏️</button>
        <button class="btn btn-secondary btn-sm btn-del-pizza-size" data-id="${s.id}" style="color:var(--status-closed);">🗑️</button>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.btn-edit-pizza-size').forEach(b=> b.addEventListener('click', ()=> openPizzaSizeModal(b.dataset.id)));
  container.querySelectorAll('.btn-del-pizza-size').forEach(b=> b.addEventListener('click', ()=> deletePizzaSize(b.dataset.id)));
}
function openPizzaSizeModal(id=null){
  const modal=document.getElementById('pizzaSizeModalBackdrop');
  const title=document.getElementById('pizzaSizeModalTitle');
  document.getElementById('pizzaSizeEditId').value=id||'';
  if(!id){
    title.textContent='Novo Tamanho';
    document.getElementById('pizzaSizeForm').reset();
    document.getElementById('pizzaSizeOrderInput').value='1';
    document.getElementById('pizzaSizeSlicesInput').value='8';
    document.getElementById('pizzaSizeMaxFlavorsInput').value='1';
    document.getElementById('pizzaSizeActiveInput').checked=true;
  } else {
    title.textContent='Editar Tamanho';
    pizzaSizesApi.listAll(currentStoreId).then(({data})=>{
      const s=data?.find(x=>x.id===id); if(!s) return;
      document.getElementById('pizzaSizeNameInput').value=s.name;
      document.getElementById('pizzaSizeSlicesInput').value=s.slices;
      document.getElementById('pizzaSizeMaxFlavorsInput').value=String(s.max_flavors);
      document.getElementById('pizzaSizeOrderInput').value=s.display_order;
      document.getElementById('pizzaSizeActiveInput').checked=!!s.is_active;
    });
  }
  modal.classList.add('active');
}
function closePizzaSizeModal(){ document.getElementById('pizzaSizeModalBackdrop').classList.remove('active'); }
async function deletePizzaSize(id){
  if(!confirm('Excluir este tamanho? Preços das pizzas neste tamanho serão apagados.')) return;
  showLoading(true);
  const {error}=await pizzaSizesApi.delete(id);
  showLoading(false);
  if(error) showToast(error.message,'error'); else { showToast('🗑️ Tamanho removido','success'); renderPizzaSizes(); }
}
document.getElementById('btnNewPizzaSize')?.addEventListener('click', ()=> openPizzaSizeModal());
document.getElementById('btnClosePizzaSizeModal')?.addEventListener('click', closePizzaSizeModal);
document.getElementById('btnCancelPizzaSize')?.addEventListener('click', closePizzaSizeModal);
document.getElementById('pizzaSizeForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id=document.getElementById('pizzaSizeEditId').value;
  const payload={
    name: document.getElementById('pizzaSizeNameInput').value.trim(),
    slices: Number(document.getElementById('pizzaSizeSlicesInput').value)||8,
    max_flavors: Number(document.getElementById('pizzaSizeMaxFlavorsInput').value)||1,
    display_order: Number(document.getElementById('pizzaSizeOrderInput').value)||1,
    is_active: document.getElementById('pizzaSizeActiveInput').checked
  };
  showLoading(true);
  let error;
  if(id){ const r=await pizzaSizesApi.update(id,payload); error=r.error; }
  else { const r=await pizzaSizesApi.create(currentStoreId,payload); error=r.error; }
  showLoading(false);
  if(error) showToast(error.message,'error'); else { closePizzaSizeModal(); showToast('✅ Tamanho salvo!','success'); renderPizzaSizes(); }
});

// Produto: preços por tamanho
async function renderProdSizePrices(productId){
  const container=document.getElementById('prodSizePricesFields');
  const { data: sizes } = await pizzaSizesApi.listAll(currentStoreId);
  if(!sizes?.length){ container.innerHTML='<p style="font-size:0.8rem; color:var(--text-muted);">Cadastre tamanhos em Tamanhos Pizza primeiro.</p>'; return; }
  let pricesMap={};
  if(productId){
    const { data: prices } = await productSizePricesApi.listByProduct(productId);
    (prices||[]).forEach(p=> pricesMap[p.size_id]=p.price);
  }
  container.innerHTML = sizes.map(s=>`
    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
      <span style="flex:1; font-size:0.85rem; font-weight:600;">${s.name} <span style="color:var(--text-muted); font-weight:400;">(${s.slices}f • ${s.max_flavors} sab)</span></span>
      <input type="number" step="0.50" data-size-id="${s.id}" placeholder="—" value="${pricesMap[s.id]!==undefined ? pricesMap[s.id] : ''}" style="width:110px; text-align:right;" />
    </div>
  `).join('');
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});