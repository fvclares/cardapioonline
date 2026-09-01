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
    const { storeApi } = await import('./lib/supabase.js?v=12');
    const { data: store, error } = await storeApi.getBySlug(slug);
    
    if (error || !store) {
      throw new Error(error?.message || 'Loja não encontrada');
    }

    // 3. Inicializa storage com store_id
    const { storage } = await import('./state/storage-supabase.js?v=12');
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

    // 4. Checa assinatura (trial até próximo 01, bloqueio dia 06 se pending)
    try {
      const { subscriptionsApi } = await import('./lib/supabase.js?v=16');
      const { data: sub } = await subscriptionsApi.get(store.id);
      if (sub && (sub.status === 'blocked' || sub.status === 'past_due')) {
        const due = sub.current_period_end ? new Date(sub.current_period_end+'T12:00:00').toLocaleDateString('pt-BR') : '';
        const msg = sub.status === 'blocked'
          ? `<h1>🚫 Loja temporariamente indisponível</h1><p>Assinatura vencida em ${due}. O lojista regulariza o PIX dia 01 (vence dia 06).</p>`
          : `<h1>⏳ Aguardando pagamento</h1><p>Vencimento dia 01 — carência até dia 06. PIX pendente.</p>`;
        document.getElementById('menuContainer').innerHTML = `<div class="store-closed">${msg}<p style="font-size:0.85rem; margin-top:1rem;">Entre em contato com a loja.</p></div>`;
        document.getElementById('floatingCartBar').style.display='none';
        loadingScreen.classList.add('hidden');
        return;
      }
    } catch(e){ console.warn('check subscription falhou', e.message); }

    // 4. Atualiza metadados da página
    document.title = `${store.name} — Cardápio Online`;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogTitle) ogTitle.content = `${store.name} — Cardápio Online`;
    if (ogDesc) ogDesc.content = store.description || 'Faça seu pedido online!';
    if (footerStoreName) footerStoreName.textContent = store.name;

    // 5. Verifica se loja está aberta (considera horário por dia) — não trava a página, apenas informa status no header
    const _settings = storage.getSettings ? storage.getSettings() : {};
    const _schedule = _settings?.schedule;
    const _isOpen = (()=>{
      if(!_schedule || !Object.keys(_schedule).length) return store.status==='open';
      const WEEK_DAYS_KEYS = ['seg','ter','qua','qui','sex','sab','dom'];
      const hasAnyDay = WEEK_DAYS_KEYS.some(k=> {
        const v=_schedule[k];
        if(!v) return false;
        if(v.closed===true) return false;
        return !!(v.open || v.close || v.open2 || v.close2);
      });
      const hasWeekdayKeys = WEEK_DAYS_KEYS.some(k=> _schedule[k] !== undefined);
      if(!hasAnyDay){
        if(hasWeekdayKeys) return false;
        return store.status==='open';
      }
      const map={0:'dom',1:'seg',2:'ter',3:'qua',4:'qui',5:'sex',6:'sab'};
      const now=new Date(); const key=map[now.getDay()]; const day=_schedule[key];
      if(!day) return false;
      if(day.closed===true) return false;
      if(day.closed===false && day.open && day.close && !_schedule.hasLunchClosure){
        const [oh,om]=(day.open||'00:00').split(':').map(Number);
        const [ch,cm]=(day.close||'23:59').split(':').map(Number);
        const cur=now.getHours()*60+now.getMinutes(); const open=oh*60+om, close=ch*60+cm;
        if(close<open) return cur>=open || cur<=close;
        return cur>=open && cur<=close;
      }
      const cur=now.getHours()*60+now.getMinutes();
      function inInterval(openStr, closeStr){
        if(!openStr || !closeStr) return false;
        const [oh,om]= openStr.split(':').map(Number);
        const [ch,cm]= closeStr.split(':').map(Number);
        if(Number.isNaN(oh)||Number.isNaN(om)||Number.isNaN(ch)||Number.isNaN(cm)) return false;
        const open=oh*60+om, close=ch*60+cm;
        if(close<open) return cur>=open || cur<=close;
        return cur>=open && cur<=close;
      }
      const hasLunch = !!_schedule.hasLunchClosure;
      if(hasLunch){
        if(inInterval(day.open, day.close)) return true;
        if(inInterval(day.open2, day.close2)) return true;
        return false;
      } else {
        return inInterval(day.open, day.close);
      }
    })();
    window._storeIsOpen = _isOpen;
    if (!_isOpen) console.info('Loja fechada — página mantida com badge "Fechado" no header (app-supabase.js:53). Cliente ainda pode navegar e montar sacola para agendamento.');

    // 6. Renderiza header
    if (window.renderHeader) {
      window.renderHeader(headerContainer);
    }

    // 6.1 Carrossel de promoções (vitrine) - antes das categorias
    const carouselContainer = document.getElementById('carouselContainer');
    const openProduct = (product)=>{
      if (window.setupProductModal) {
        const modal = window.setupProductModal();
        modal.openModal(product);
      }
    };
    if (window.renderCarousel && carouselContainer) {
      window.renderCarousel(carouselContainer, openProduct);
    }

    // 6.2 Ofertas / Combos por regras (motor de ofertas)
    const offersContainer = document.getElementById('offersContainer');
    if (window.renderOffersSection && offersContainer) {
      window.renderOffersSection(offersContainer);
    }

    // 7. Renderiza navegação de categorias
    if (window.renderCategoryNav) {
      window.renderCategoryNav(navContainer, (filter) => {
        if (window.renderProductSections) {
          window.renderProductSections(menuContainer, filter, (product) => openProduct(product));
        }
      });
    }

    // 8. Renderiza seções de produtos
    if (window.renderProductSections) {
      window.renderProductSections(menuContainer, '', (product) => openProduct(product));
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
        const cc = document.getElementById('carouselContainer');
        if (window.renderCarousel && cc) {
          const openP = (product)=>{
            if (window.setupProductModal) {
              const modal = window.setupProductModal();
              modal.openModal(product);
            }
          };
          window.renderCarousel(cc, openP);
        }
        const oc = document.getElementById('offersContainer');
        if (window.renderOffersSection && oc) window.renderOffersSection(oc);
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