/**
 * Componente: Cabeçalho da Loja & Reconhecimento do Cliente
 * Compatível com file:// e http://
 */

function isStoreOpenNowHeader(schedule, fallbackStatus){
  if(!schedule || !Object.keys(schedule).length) return fallbackStatus==='open';
  const WEEK_DAYS_KEYS = ['seg','ter','qua','qui','sex','sab','dom'];
  const hasAnyDay = WEEK_DAYS_KEYS.some(k=> {
    const v=schedule[k];
    if(!v) return false;
    if(v.closed===true) return false;
    return !!(v.open || v.close || v.open2 || v.close2);
  });
  const hasWeekdayKeys = WEEK_DAYS_KEYS.some(k=> schedule[k] !== undefined);
  if(!hasAnyDay){
    if(hasWeekdayKeys) return false;
    return fallbackStatus==='open';
  }
  const map={0:'dom',1:'seg',2:'ter',3:'qua',4:'qui',5:'sex',6:'sab'};
  const now=new Date(); const key=map[now.getDay()]; const day=schedule[key];
  if(!day) return false;
  if(day.closed===true) return false;
  if(day.closed===false && day.open && day.close && !schedule.hasLunchClosure){
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
  const hasLunch = !!schedule.hasLunchClosure;
  if(hasLunch){
    if(inInterval(day.open, day.close)) return true;
    if(inInterval(day.open2, day.close2)) return true;
    return false;
  } else {
    return inInterval(day.open, day.close);
  }
}
function renderHeader(container) {
  const store = window.appState.store;
  const customer = window.appState.customer;
  const lastOrder = window.orderService.getLastOrder();
  const cs = window.customerService;
  const schedule = window.appState?.settings?.schedule || window.appState?.store?.schedule || window.storage?.getSettings?.()?.schedule;
  const isOpen = isStoreOpenNowHeader(schedule, store.status);

  let customerBarHtml = '';
  if (customer && customer.name) {
    customerBarHtml = `
      <div class="customer-welcome-bar">
        <div class="customer-welcome-text">
          👋 Olá, <span>${customer.name}</span>!
        </div>
        ${lastOrder && lastOrder.items ? `
          <button id="btnRepeatLastOrder" class="btn-repeat-order-mini" title="Adicionar itens do pedido ${lastOrder.orderNumber} à sacola">
            🔄 Repetir último pedido
          </button>
        ` : ''}
      </div>
    `;
  }

  const coverUrl = store.cover || store.cover_url || '';
  const logoUrl = store.logo || store.logo_url || '';
  container.innerHTML = `
    <header class="store-header">
      <div class="store-cover" style="background-image: linear-gradient(180deg, rgba(14, 17, 23, 0.2) 0%, rgba(14, 17, 23, 0.85) 100%), url('${coverUrl}')"></div>
      
      <div class="container">
        <div class="store-info-wrapper">
          <div class="store-main-meta">
            ${logoUrl ? `<img src="${logoUrl}" alt="${store.name}" class="store-logo" />` : ''}
            <div class="store-titles">
              <h1 class="store-name">${store.name}</h1>
              <div class="store-details-bar" style="margin-top: 0.35rem;">
                <span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">
                  <span class="pulse-dot"></span>
                  ${isOpen ? 'Aberto Agora' : 'Fechado no Momento'}
                </span>
                <span class="store-detail-item">
                  🕒 ${store.opening_hours || '18h às 23h30'}
                </span>
              </div>
            </div>
          </div>

          <div class="store-details-bar">
            <span class="store-detail-item">
              📍 ${store.address || 'São Paulo - SP'}
            </span>
            <span class="store-detail-item">
              🛵 Entrega a partir de ${cs ? cs.formatCurrency(store.default_delivery_fee || 7) : 'R$ 7,00'}
            </span>
          </div>

          ${!isOpen ? `
            <div class="store-notice-closed">
              ⚠️ O estabelecimento  está fechada no momento. Você ainda pode montar sua sacola e enviar seu pedido para agendamento via WhatsApp.
            </div>
          ` : ''}

          ${customerBarHtml}
        </div>
      </div>
    </header>
  `;

  // Bind repeat last order button
  const btnRepeat = container.querySelector('#btnRepeatLastOrder');
  if (btnRepeat && lastOrder && lastOrder.items) {
    btnRepeat.addEventListener('click', () => {
      window.appState.reorder(lastOrder.items);
      window.dispatchEvent(new CustomEvent('open_cart'));
    });
  }
}

window.renderHeader = renderHeader;
