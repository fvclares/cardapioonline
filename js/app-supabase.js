/**
 * Controlador Principal do Cardápio Público - Supabase Version
 * Carrega dados da loja via slug na URL e inicializa componentes
 */

document.addEventListener('DOMContentLoaded', async () => {
  const loadingScreen = document.getElementById('loadingScreen');
  const headerContainer = document.getElementById('headerContainer');
  const navContainer = document.getElementById('navContainer');
  const menuContainer = document.getElementById('menuContainer');
  const footerStoreName = document.getElementById('footerStoreName');

  // 1. Obtém slug da URL (?store=bella-massa)
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('store') || urlParams.get('slug');

  if (!slug) {
    loadingScreen.classList.add('hidden');
    showStoreNotFound();
    return;
  }

  try {
    // 2. Busca loja por slug no Supabase
    const { storeApi } = await import('./lib/supabase.js?v=11');
    const { data: store, error } = await storeApi.getBySlug(slug);
    
    if (error || !store) {
      throw new Error(error?.message || 'Loja não encontrada');
    }

    // 3. Inicializa storage com store_id
    const { storage } = await import('./state/storage-supabase.js?v=11');
    await storage.init(store.id);
    // Garante que appState leia o cache recém-carregado
    if (window.appState) {
      await window.appState.refreshData();
      // Fallback: espera ready se ainda vazio
      if (!window.appState.products?.length) {
        await new Promise(r => setTimeout(r, 300));
        await window.appState.refreshData();
      }
    }

    // 4. Atualiza metadados da página
    document.title = `${store.name} — Cardápio Online`;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogTitle) ogTitle.content = `${store.name} — Cardápio Online`;
    if (ogDesc) ogDesc.content = store.description || 'Faça seu pedido online!';
    if (footerStoreName) footerStoreName.textContent = store.name;

    // 5. Verifica se loja está aberta
    if (store.status !== 'open') {
      loadingScreen.classList.add('hidden');
      showStoreClosed(store);
      return;
    }

    // 6. Renderiza header
    if (window.renderHeader) {
      window.renderHeader(headerContainer);
    }

    // 7. Renderiza navegação de categorias
    if (window.renderCategoryNav) {
      window.renderCategoryNav(navContainer, (query) => {
        if (window.renderProductSections) {
          window.renderProductSections(menuContainer, query, (product) => {
            if (window.setupProductModal) {
              const modal = window.setupProductModal();
              modal.openModal(product);
            }
          });
        }
      });
    }

    // 8. Renderiza seções de produtos
    if (window.renderProductSections) {
      window.renderProductSections(menuContainer, '', (product) => {
        if (window.setupProductModal) {
          const modal = window.setupProductModal();
          modal.openModal(product);
        }
      });
    }

    // 9. Inicializa modais
    if (window.setupProductModal) window.setupProductModal();
    if (window.setupCheckoutModal) window.setupCheckoutModal();
    if (window.setupCartDrawer) window.setupCartDrawer(() => {
      if (window.setupCheckoutModal) window.setupCheckoutModal().openCheckout();
    });

    loadingScreen.classList.add('hidden');

    // Reage a mudanças de dados
    if (window.appState) {
      window.appState.subscribe(() => {
        if (window.renderHeader) window.renderHeader(headerContainer);
      });
    }

  } catch (err) {
    console.error('Erro ao carregar cardápio:', err);
    loadingScreen.classList.add('hidden');
    showError(err.message);
  }
});

function showStoreNotFound() {
  const menuContainer = document.getElementById('menuContainer');
  menuContainer.innerHTML = `
    <div class="store-closed">
      <h1>🔍 Loja não encontrada</h1>
      <p>O link acessado não corresponde a nenhuma pizzaria ativa.</p>
      <p style="font-size: 0.85rem; margin-top: 1rem;">Verifique o URL ou entre em contato com o estabelecimento.</p>
    </div>
  `;
}

function showStoreClosed(store) {
  const menuContainer = document.getElementById('menuContainer');
  menuContainer.innerHTML = `
    <div class="store-closed">
      <h1>🏪 ${store.name}</h1>
      <p style="font-size: 1.2rem; color: var(--status-closed); font-weight: 700; margin-bottom: 1rem;">
        Fechado no momento
      </p>
      <p>${store.opening_hours || 'Consulte nossos horários de funcionamento.'}</p>
      <p style="font-size: 0.85rem; margin-top: 1.5rem; color: var(--text-muted);">
        Volte durante o horário de atendimento para fazer seu pedido.
      </p>
    </div>
  `;
}

function showError(message) {
  const menuContainer = document.getElementById('menuContainer');
  menuContainer.innerHTML = `
    <div class="store-closed">
      <h1>⚠️ Erro ao carregar</h1>
      <p>${message}</p>
      <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">
        Tentar novamente
      </button>
    </div>
  `;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Expose para componentes
window.showToast = showToast;
window.formatCurrency = (value) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
window.formatPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (cleaned.length === 10) return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return phone;
};