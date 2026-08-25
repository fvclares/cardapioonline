/**
 * Lógica do Painel de Administração da Pizzaria (admin.js)
 * Compatível com file:// e http://
 */

document.addEventListener('DOMContentLoaded', () => {
  const storage = window.storage;
  const cs = window.customerService;
  console.log('[DEBUG] admin.js carregado, storage:', !!storage, 'customerService:', !!cs);

  // Navigation Tabs
  const navItems = document.querySelectorAll('.admin-nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('pageTitle');

  const tabTitles = {
    'tab-settings': 'Configurações da Loja',
    'tab-categories': 'Gestão de Categorias',
    'tab-products': 'Catálogo de Produtos & Preços',
    'tab-orders': 'Histórico de Pedidos',
    'tab-share': 'Link Exclusivo da Loja'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.dataset.tab;
      navItems.forEach(i => i.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(tabId)?.classList.add('active');
      pageTitle.textContent = tabTitles[tabId] || 'Painel do Lojista';

      if (tabId === 'tab-categories') renderCategories();
      if (tabId === 'tab-products') renderProducts();
      if (tabId === 'tab-orders') renderOrders();
      if (tabId === 'tab-share') renderShareLink();
    });
  });

  // --- TAB 1: Configurações da Loja ---
  const storeForm = document.getElementById('storeSettingsForm');
  const statusInput = document.getElementById('storeStatusInput');
  const statusText = document.getElementById('storeStatusText');
  const sidebarStoreName = document.getElementById('sidebarStoreName');

  function loadStoreSettings() {
    const store = storage.getStore();
    document.getElementById('storeNameInput').value = store.name || '';
    document.getElementById('storePhoneInput').value = store.phone || '';
    document.getElementById('storeAddressInput').value = store.address || '';
    document.getElementById('storeHoursInput').value = store.opening_hours || '';
    document.getElementById('storeDeliveryFeeInput').value = store.default_delivery_fee || 7.00;
    document.getElementById('storeMinOrderInput').value = store.min_order_value || 35.00;
    document.getElementById('storeLogoInput').value = store.logo || '';
    document.getElementById('storeCoverInput').value = store.cover || '';

    const isOpen = store.status === 'open';
    statusInput.checked = isOpen;
    statusText.textContent = isOpen ? 'Aberto' : 'Fechado';
    statusText.style.color = isOpen ? 'var(--status-open)' : 'var(--status-closed)';

    sidebarStoreName.textContent = store.name || 'Pizzaria';
  }

  statusInput.addEventListener('change', () => {
    const isOpen = statusInput.checked;
    statusText.textContent = isOpen ? 'Aberto' : 'Fechado';
    statusText.style.color = isOpen ? 'var(--status-open)' : 'var(--status-closed)';
  });

  storeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const currentStore = storage.getStore();
    const updatedStore = {
      ...currentStore,
      name: document.getElementById('storeNameInput').value.trim(),
      phone: document.getElementById('storePhoneInput').value.replace(/\D/g, ''),
      address: document.getElementById('storeAddressInput').value.trim(),
      opening_hours: document.getElementById('storeHoursInput').value.trim(),
      default_delivery_fee: Number(document.getElementById('storeDeliveryFeeInput').value),
      min_order_value: Number(document.getElementById('storeMinOrderInput').value),
      logo: document.getElementById('storeLogoInput').value.trim(),
      cover: document.getElementById('storeCoverInput').value.trim(),
      status: statusInput.checked ? 'open' : 'closed'
    };

    storage.saveStore(updatedStore);
    sidebarStoreName.textContent = updatedStore.name;
    alert('Configurações da loja salvas com sucesso!');
  });

  // --- TAB 2: Categorias ---
  const categoriesContainer = document.getElementById('categoriesListContainer');
  const categoryModalBackdrop = document.getElementById('categoryModalBackdrop');
  const categoryForm = document.getElementById('categoryForm');
  const btnNewCategory = document.getElementById('btnNewCategory');

  function renderCategories() {
    const categories = storage.getCategories().slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const products = storage.getProducts();

    if (categories.length === 0) {
      categoriesContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Nenhuma categoria cadastrada.</p>`;
      return;
    }

    categoriesContainer.innerHTML = categories.map(cat => {
      const count = products.filter(p => p.category_id === cat.id).length;
      return `
        <div class="item-row">
          <div class="item-main">
            <div style="font-size: 1.3rem;">📂</div>
            <div>
              <div class="item-info-title">${cat.name}</div>
              <div class="item-info-meta">${count} ${count === 1 ? 'produto' : 'produtos'} • Ordem: ${cat.order || 1}</div>
            </div>
          </div>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm btn-edit-cat" data-id="${cat.id}">✏️ Editar</button>
            <button class="btn btn-secondary btn-sm btn-del-cat" data-id="${cat.id}" style="color: #ef4444;">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    categoriesContainer.querySelectorAll('.btn-edit-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        console.log('[DEBUG] Botão editar categoria clicado, ID:', btn.dataset.id);
        openCategoryModal(btn.dataset.id);
      });
    });

    categoriesContainer.querySelectorAll('.btn-del-cat').forEach(btn => {
      btn.addEventListener('click', () => deleteCategory(btn.dataset.id));
    });
    console.log('[DEBUG] renderCategories finalizado, botões anexados');
  }

  function openCategoryModal(catId = null) {
    console.log('[DEBUG] openCategoryModal chamado com:', catId);
    const titleEl = document.getElementById('categoryModalTitle');
    const idInput = document.getElementById('catEditId');
    const nameInput = document.getElementById('catNameInput');
    const orderInput = document.getElementById('catOrderInput');

    if (catId) {
      const cat = storage.getCategories().find(c => c.id === catId);
      console.log('[DEBUG] Categoria encontrada:', cat);
      if (!cat) {
        alert('Erro: Categoria não encontrada (ID: ' + catId + ')');
        return;
      }
      titleEl.textContent = 'Editar Categoria';
      idInput.value = cat.id;
      nameInput.value = cat.name;
      orderInput.value = cat.order || 1;
    } else {
      titleEl.textContent = 'Nova Categoria';
      idInput.value = '';
      nameInput.value = '';
      orderInput.value = storage.getCategories().length + 1;
    }

    categoryModalBackdrop.classList.add('active');
  }

  function closeCategoryModal() {
    categoryModalBackdrop.classList.remove('active');
  }

  btnNewCategory.addEventListener('click', () => openCategoryModal());
  document.getElementById('btnCloseCategoryModal').addEventListener('click', closeCategoryModal);
  document.getElementById('btnCancelCategory').addEventListener('click', closeCategoryModal);

  categoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const categories = storage.getCategories();
    const editId = document.getElementById('catEditId').value;
    const name = document.getElementById('catNameInput').value.trim();
    const order = Number(document.getElementById('catOrderInput').value) || 1;

    if (editId) {
      const idx = categories.findIndex(c => c.id === editId);
      if (idx >= 0) {
        categories[idx].name = name;
        categories[idx].order = order;
      }
    } else {
      const newId = 'cat_' + Date.now();
      categories.push({ id: newId, name, order });
    }

    storage.saveCategories(categories);
    closeCategoryModal();
    renderCategories();
  });

  function deleteCategory(catId) {
    if (!confirm('Deseja realmente excluir esta categoria?')) return;
    let categories = storage.getCategories().filter(c => c.id !== catId);
    storage.saveCategories(categories);
    renderCategories();
  }

  // --- TAB 3: Produtos & Preços ---
  const productsContainer = document.getElementById('productsListContainer');
  const productModalBackdrop = document.getElementById('productModalBackdrop');
  const productForm = document.getElementById('productForm');
  const btnNewProduct = document.getElementById('btnNewProduct');
  const filterCatSelect = document.getElementById('filterProductCategory');
  const filterSearchInput = document.getElementById('filterProductSearch');

  function updateCategoryDropdowns() {
    const categories = storage.getCategories();
    
    filterCatSelect.innerHTML = `<option value="">Todas as Categorias</option>` + 
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const prodCatSelect = document.getElementById('prodCategorySelect');
    prodCatSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  function renderProducts() {
    updateCategoryDropdowns();
    const products = storage.getProducts();
    const categories = storage.getCategories();
    const selectedCat = filterCatSelect.value;
    const searchQuery = filterSearchInput.value.trim().toLowerCase();

    let filtered = products;
    if (selectedCat) {
      filtered = filtered.filter(p => p.category_id === selectedCat);
    }
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery) ||
        (p.description && p.description.toLowerCase().includes(searchQuery))
      );
    }

    if (filtered.length === 0) {
      productsContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Nenhum produto encontrado.</p>`;
      return;
    }

    productsContainer.innerHTML = filtered.map(prod => {
      const cat = categories.find(c => c.id === prod.category_id);
      return `
        <div class="item-row">
          <div class="item-main">
            <img src="${prod.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=150&q=80'}" class="item-thumb" alt="${prod.name}" />
            <div>
              <div class="item-info-title">${prod.name} ${!prod.available ? '<span class="badge badge-closed">Pausado</span>' : ''}</div>
              <div class="item-info-meta">
                ${cat ? cat.name : 'Sem categoria'} • 
                <strong style="color: var(--secondary);">${cs ? cs.formatCurrency(prod.price) : 'R$ ' + prod.price}</strong>
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

    productsContainer.querySelectorAll('.btn-edit-prod').forEach(btn => {
      btn.addEventListener('click', () => {
        console.log('[DEBUG] Botão editar produto clicado, ID:', btn.dataset.id);
        openProductModal(btn.dataset.id);
      });
    });

    productsContainer.querySelectorAll('.btn-del-prod').forEach(btn => {
      btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
    });
    console.log('[DEBUG] renderProducts finalizado, botões anexados');
  }

  filterCatSelect.addEventListener('change', renderProducts);
  filterSearchInput.addEventListener('input', renderProducts);

  function openProductModal(prodId = null) {
    console.log('[DEBUG] openProductModal chamado com:', prodId);
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

    updateCategoryDropdowns();

    if (prodId) {
      const prod = storage.getProductById(prodId);
      console.log('[DEBUG] Produto encontrado:', prod);
      if (!prod) {
        alert('Erro: Produto não encontrado (ID: ' + prodId + ')');
        return;
      }
      titleEl.textContent = 'Editar Produto';
      idInput.value = prod.id;
      nameInput.value = prod.name;
      catSelect.value = prod.category_id;
      priceInput.value = prod.price;
      descInput.value = prod.description || '';
      imgInput.value = prod.image || '';
      crustsInput.checked = !!prod.has_crusts;
      extrasInput.checked = !!prod.has_extras;
      availInput.checked = prod.available !== false;
    } else {
      titleEl.textContent = 'Novo Produto';
      idInput.value = '';
      nameInput.value = '';
      priceInput.value = '';
      descInput.value = '';
      imgInput.value = '';
      crustsInput.checked = true;
      extrasInput.checked = true;
      availInput.checked = true;
    }

    productModalBackdrop.classList.add('active');
  }

  function closeProductModal() {
    productModalBackdrop.classList.remove('active');
  }

  btnNewProduct.addEventListener('click', () => openProductModal());
  document.getElementById('btnCloseProductModal').addEventListener('click', closeProductModal);
  document.getElementById('btnCancelProduct').addEventListener('click', closeProductModal);

  productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const products = storage.getProducts();
    const editId = document.getElementById('prodEditId').value;
    const name = document.getElementById('prodNameInput').value.trim();
    const category_id = document.getElementById('prodCategorySelect').value;
    const price = Number(document.getElementById('prodPriceInput').value);
    const description = document.getElementById('prodDescriptionInput').value.trim();
    const image = document.getElementById('prodImageInput').value.trim();
    const has_crusts = document.getElementById('prodHasCrustsInput').checked;
    const has_extras = document.getElementById('prodHasExtrasInput').checked;
    const available = document.getElementById('prodAvailableInput').checked;

    if (editId) {
      const idx = products.findIndex(p => p.id === editId);
      if (idx >= 0) {
        products[idx] = {
          ...products[idx],
          name, category_id, price, description, image, has_crusts, has_extras, available
        };
      }
    } else {
      const newId = 'prod_' + Date.now();
      products.push({
        id: newId,
        name, category_id, price, description, image, has_crusts, has_extras, available
      });
    }

    storage.saveProducts(products);
    closeProductModal();
    renderProducts();
  });

  function deleteProduct(prodId) {
    if (!confirm('Deseja realmente excluir este produto?')) return;
    let products = storage.getProducts().filter(p => p.id !== prodId);
    storage.saveProducts(products);
    renderProducts();
  }

  // --- TAB 4: Histórico de Pedidos ---
  const ordersContainer = document.getElementById('ordersListContainer');
  const orderCountBadge = document.getElementById('orderCountBadge');

  function renderOrders() {
    const orders = storage.getOrders();
    orderCountBadge.textContent = `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}`;

    if (orders.length === 0) {
      ordersContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📋</div>
          <p style="font-weight: 600; color: var(--text-secondary);">Nenhum pedido recebido ainda</p>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Quando os clientes enviarem pedidos pelo cardápio, eles aparecerão aqui.</p>
        </div>
      `;
      return;
    }

    ordersContainer.innerHTML = orders.map(order => {
      const dateStr = new Date(order.createdAt).toLocaleString('pt-BR');
      return `
        <div class="admin-card" style="margin-bottom: 1rem; padding: 1.2rem; background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem;">
            <div>
              <span style="font-weight: 800; font-size: 1.05rem; color: var(--primary);">${order.orderNumber}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">• ${dateStr}</span>
              <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-top: 0.2rem;">
                👤 ${order.customer.name} (${cs ? cs.formatPhone(order.customer.phone) : order.customer.phone})
              </div>
            </div>
            <div style="text-align: right;">
              <span class="badge badge-open">Enviado p/ WhatsApp</span>
              <div style="font-weight: 800; font-size: 1.1rem; color: var(--secondary); margin-top: 0.35rem;">
                ${cs ? cs.formatCurrency(order.total) : 'R$ ' + order.total}
              </div>
            </div>
          </div>

          <div style="font-size: 0.85rem; margin-bottom: 0.75rem; color: var(--text-secondary);">
            <strong>Itens:</strong>
            <ul style="margin-left: 1.25rem; margin-top: 0.25rem;">
              ${order.items.map(item => `
                <li>
                  ${item.quantity}x ${item.productName} 
                  ${item.crust ? `(Borda: ${item.crust.name})` : ''} 
                  ${item.observation ? `— <em>"${item.observation}"</em>` : ''}
                  — <strong>${cs ? cs.formatCurrency(item.itemTotal) : 'R$ ' + item.itemTotal}</strong>
                </li>
              `).join('')}
            </ul>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); background: var(--bg-input); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);">
            <span>
              ${order.orderType === 'delivery' ? `📍 Entrega: ${order.deliveryAddress?.street}, ${order.deliveryAddress?.number} (${order.deliveryAddress?.neighborhood})` : '🏪 Retirada no Balcão'}
            </span>
            <span>
              💳 ${order.payment.method.toUpperCase()}
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- TAB 5: Link de Divulgação ---
  function renderShareLink() {
    const urlDisplay = document.getElementById('publicStoreUrl');
    const fullUrl = window.location.href.replace('admin.html', 'index.html');
    urlDisplay.textContent = fullUrl;

    document.getElementById('btnCopyStoreLink').addEventListener('click', () => {
      navigator.clipboard.writeText(fullUrl).then(() => {
        alert('Link do cardápio copiado para a área de transferência!');
      }).catch(() => {
        alert('Copie o link manualmente: ' + fullUrl);
      });
    });

    document.getElementById('btnResetData').addEventListener('click', () => {
      if (confirm('Atenção: isso restaurará os produtos e configurações padrão da Pizzaria Bella Massa. Deseja continuar?')) {
        storage.resetDefaults();
        loadStoreSettings();
        renderCategories();
        renderProducts();
        renderOrders();
        alert('Dados padrão restaurados!');
      }
    });
  }

  // Inicialização inicial
  loadStoreSettings();
});
