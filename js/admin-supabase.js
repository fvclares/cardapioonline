/**
 * Admin Panel - Supabase Version
 * Multi-tenant SaaS com autenticação Supabase Auth
 */

// Estado global
let currentStore = null;
let currentUser = null;
let ordersSubscription = null;

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

// ============================================
// AUTENTICAÇÃO
// ============================================

async function initAuth() {
  const authGate = document.getElementById('authGate');
  const adminLayout = document.getElementById('adminLayout');
  const magicLinkForm = document.getElementById('magicLinkForm');
  const passwordForm = document.getElementById('passwordForm');
  const toggleAuthMode = document.getElementById('toggleAuthMode');
  const logoutBtn = document.getElementById('logoutBtn');

  // Verifica sessão existente
  const session = await auth.getSession();
  if (session?.user) {
    await onAuthSuccess(session.user);
    return;
  }

  // Listener de mudanças de auth
  auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      onAuthSuccess(session.user);
    } else if (event === 'SIGNED_OUT') {
      onAuthLogout();
    }
  });

  // Magic Link Form
  magicLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('magicLinkBtn');
    const email = document.getElementById('magicLinkEmail').value.trim();
    const errorEl = document.getElementById('authError');
    const successEl = document.getElementById('authSuccess');

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    errorEl.textContent = '';
    successEl.textContent = '';

    const { error } = await auth.signInWithMagicLink(email, window.location.origin + '/admin.html');
    
    if (error) {
      errorEl.textContent = error.message;
    } else {
      successEl.textContent = '✅ Link mágico enviado! Verifique seu e-mail (incluindo spam).';
      magicLinkForm.reset();
    }
    btn.disabled = false;
    btn.textContent = '🔗 Enviar Link Mágico';
  });

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
    btn.textContent = 'Entrar com Senha';
  });

  // Toggle auth mode
  toggleAuthMode.addEventListener('click', () => {
    const isMagic = magicLinkForm.style.display !== 'none';
    magicLinkForm.style.display = isMagic ? 'none' : 'block';
    passwordForm.style.display = isMagic ? 'block' : 'none';
    toggleAuthMode.textContent = isMagic ? 'Alternar para link mágico' : 'Alternar para login com senha';
    document.getElementById('authError').textContent = '';
    document.getElementById('passwordError').textContent = '';
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
  });
}

async function onAuthSuccess(user) {
  currentUser = user;
  console.log('✅ Usuário logado:', user.email);

  // Busca perfil e store_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id, role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile?.store_id) {
    showToast('⚠️ Usuário sem loja associada. Crie uma loja primeiro.', 'error');
    await auth.signOut();
    return;
  }

  currentStore = profile.store_id;
  
  // Inicializa storage com store_id
  await storage.init(currentStore);
  
  // Carrega dados da loja
  await loadStoreData();
  
  // UI updates
  document.getElementById('authGate').classList.remove('active');
  document.getElementById('adminLayout').classList.add('authenticated');
  document.getElementById('userBadge').style.display = 'flex';
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userAvatar').textContent = user.email?.[0]?.toUpperCase() || 'U';

  // Inicia realtime para pedidos
  startOrdersRealtime();
  
  showToast(`Bem-vindo, ${user.email}!`, 'success');
}

function onAuthLogout() {
  currentUser = null;
  currentStore = null;
  if (ordersSubscription) ordersSubscription.unsubscribe();
  
  document.getElementById('authGate').classList.add('active');
  document.getElementById('adminLayout').classList.remove('authenticated');
  document.getElementById('userBadge').style.display = 'none';
  
  // Reset forms
  document.getElementById('magicLinkForm').reset();
  document.getElementById('passwordForm').reset();
  document.getElementById('passwordForm').style.display = 'none';
  document.getElementById('magicLinkForm').style.display = 'block';
  document.getElementById('toggleAuthMode').textContent = 'Alternar para login com senha';
}

async function loadStoreData() {
  const { data: store, error } = await storeApi.getById(currentStore);
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
  document.getElementById('storeLogoInput').value = store.logo_url || '';
  document.getElementById('storeCoverInput').value = store.cover_url || '';

  if (store.logo_url) showPreview('storeLogoPreview', store.logo_url);
  if (store.cover_url) showPreview('storeCoverPreview', store.cover_url);

  const isOpen = store.status === 'open';
  const statusInput = document.getElementById('storeStatusInput');
  const statusText = document.getElementById('storeStatusText');
  statusInput.checked = isOpen;
  statusText.textContent = isOpen ? 'Aberto' : 'Fechado';
  statusText.style.color = isOpen ? 'var(--status-open)' : 'var(--status-closed)';

  // Live preview
  document.getElementById('storeLogoInput').addEventListener('input', (e) => {
    if (e.target.value) showPreview('storeLogoPreview', e.target.value);
    else document.getElementById('storeLogoPreview').innerHTML = '';
  });
  document.getElementById('storeCoverInput').addEventListener('input', (e) => {
    if (e.target.value) showPreview('storeCoverPreview', e.target.value);
    else document.getElementById('storeCoverPreview').innerHTML = '';
  });

  // Atualiza link público
  updatePublicUrl(store.slug);
}

function showPreview(containerId, url) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 180px; max-height: 100px; border-radius: var(--radius-md); border: 1px solid var(--border);" />`;
}

function updatePublicUrl(slug) {
  const baseUrl = window.location.origin.replace('/admin.html', '');
  const publicUrl = `${baseUrl}/index.html?store=${slug}`;
  document.getElementById('publicStoreUrl').textContent = publicUrl;
}

// ============================================
// STORE SETTINGS
// ============================================

document.getElementById('storeSettingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentStore) return;

  const updates = {
    name: document.getElementById('storeNameInput').value.trim(),
    slug: document.getElementById('storeSlugInput').value.trim().toLowerCase(),
    phone: document.getElementById('storePhoneInput').value.replace(/\D/g, ''),
    phone_display: document.getElementById('storePhoneDisplayInput').value.trim(),
    address: document.getElementById('storeAddressInput').value.trim(),
    opening_hours: document.getElementById('storeHoursInput').value.trim(),
    default_delivery_fee: Number(document.getElementById('storeDeliveryFeeInput').value) || 7.00,
    min_order_value: Number(document.getElementById('storeMinOrderInput').value) || 35.00,
    logo_url: document.getElementById('storeLogoInput').value.trim(),
    cover_url: document.getElementById('storeCoverInput').value.trim(),
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
  const { data, error } = await categoriesApi.list(currentStore);
  
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
    categoriesApi.list(currentStore).then(({ data }) => {
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
    const result = await categoriesApi.create(currentStore, { name, display_order });
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
  const { data } = await categoriesApi.list(currentStore);
  const options = data?.map(c => `<option value="${c.id}">${c.name}</option>`).join('') || '';
  
  document.getElementById('filterProductCategory').innerHTML = 
    `<option value="">Todas as Categorias</option>` + options;
  document.getElementById('prodCategorySelect').innerHTML = options;
}

async function renderProducts() {
  const container = document.getElementById('productsListContainer');
  const selectedCat = document.getElementById('filterProductCategory').value;
  const searchQuery = document.getElementById('filterProductSearch').value.trim().toLowerCase();

  const { data, error } = await productsApi.listAdmin(currentStore);
  
  if (error) {
    container.innerHTML = `<p style="color: var(--status-closed);">Erro: ${error.message}</p>`;
    return;
  }

  let filtered = data || [];
  if (selectedCat) filtered = filtered.filter(p => p.category_id === selectedCat);
  if (searchQuery) filtered = filtered.filter(p => 
    p.name.toLowerCase().includes(searchQuery) ||
    (p.description && p.description.toLowerCase().includes(searchQuery))
  );

  if (!filtered.length) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Nenhum produto encontrado.</p>`;
    return;
  }

  container.innerHTML = filtered.map(prod => {
    const catName = prod.categories?.name || 'Sem categoria';
    return `
      <div class="item-row">
        <div class="item-main">
          <img src="${prod.image_url || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=150&q=80'}" class="item-thumb" alt="${prod.name}" />
          <div>
            <div class="item-info-title">${prod.name} ${!prod.available ? '<span class="badge badge-closed">Pausado</span>' : ''}</div>
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

function openProductModal(prodId = null) {
  const titleEl = document.getElementById('productModalTitle');
  const idInput = document.getElementById('prodEditId');
  const nameInput = document.getElementById('prodNameInput');
  const catSelect = document.getElementById('prodCategorySelect');
  const priceInput = document.getElementById('prodPriceInput');
  const descInput = document.getElementById('prodDescriptionInput');
  const imgInput = document.getElementById('prodImageInput');
  const crustsInput = document.getElementById('prodHasCrustsInput');
  const extrasInput = document.getElementById('prodHasExtrasInput');
  const availInput = document.getElementById('prodAvailableInput');
  const previewContainer = document.getElementById('prodImagePreview');
  const modal = document.getElementById('productModalBackdrop');

  updateCategoryDropdowns();

  if (prodId) {
    titleEl.textContent = 'Editar Produto';
    idInput.value = prodId;
    const { data: prod } = await productsApi.getById(prodId);
    if (prod) {
      nameInput.value = prod.name;
      catSelect.value = prod.category_id;
      priceInput.value = prod.base_price;
      descInput.value = prod.description || '';
      imgInput.value = prod.image_url || '';
      if (prod.image_url) showPreview('prodImagePreview', prod.image_url);
      crustsInput.checked = !!prod.has_crusts;
      extrasInput.checked = !!prod.has_extras;
      availInput.checked = prod.available !== false;
    }
  } else {
    titleEl.textContent = 'Novo Produto';
    idInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
    descInput.value = '';
    imgInput.value = '';
    previewContainer.innerHTML = '';
    crustsInput.checked = true;
    extrasInput.checked = true;
    availInput.checked = true;
  }

  imgInput.oninput = (e) => {
    if (e.target.value) showPreview('prodImagePreview', e.target.value);
    else previewContainer.innerHTML = '';
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
  const productData = {
    name: document.getElementById('prodNameInput').value.trim(),
    category_id: document.getElementById('prodCategorySelect').value,
    base_price: Number(document.getElementById('prodPriceInput').value),
    description: document.getElementById('prodDescriptionInput').value.trim(),
    image_url: document.getElementById('prodImageInput').value.trim(),
    has_crusts: document.getElementById('prodHasCrustsInput').checked,
    has_extras: document.getElementById('prodHasExtrasInput').checked,
    available: document.getElementById('prodAvailableInput').checked
  };

  showLoading(true);
  let error;
  if (id) {
    const result = await productsApi.update(id, productData);
    error = result.error;
  } else {
    const result = await productsApi.create(currentStore, productData);
    error = result.error;
  }
  showLoading(false);

  if (error) {
    showToast('Erro: ' + error.message, 'error');
  } else {
    closeProductModal();
    renderProducts();
    showToast('✅ Produto salvo!', 'success');
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

  const { data, error } = await ordersApi.list(currentStore, { 
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
  
  ordersSubscription = ordersApi.subscribeToNewOrders(currentStore, (newOrder) => {
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
  'tab-share': 'Link da Loja'
};

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabId = item.dataset.tab;
    navItems.forEach(i => i.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));

    item.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');
    pageTitle.textContent = tabTitles[tabId] || 'Painel';

    if (tabId === 'tab-categories') renderCategories();
    if (tabId === 'tab-products') renderProducts();
    if (tabId === 'tab-orders') renderOrders();
    if (tabId === 'tab-share') updatePublicUrl(currentStore?.slug);
  });
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  
  // Preview para produto image
  document.getElementById('prodImageInput').addEventListener('input', (e) => {
    const preview = document.getElementById('prodImagePreview');
    if (e.target.value) showPreview('prodImagePreview', e.target.value);
    else preview.innerHTML = '';
  });
});