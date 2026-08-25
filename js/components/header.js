/**
 * Componente: Cabeçalho da Loja & Reconhecimento do Cliente
 * Compatível com file:// e http://
 */

function renderHeader(container) {
  const store = window.appState.store;
  const customer = window.appState.customer;
  const lastOrder = window.orderService.getLastOrder();
  const cs = window.customerService;

  const isOpen = store.status === 'open';

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

  container.innerHTML = `
    <header class="store-header">
      <div class="store-cover" style="background-image: linear-gradient(180deg, rgba(14, 17, 23, 0.2) 0%, rgba(14, 17, 23, 0.85) 100%), url('${store.cover || ''}')"></div>
      
      <div class="container">
        <div class="store-info-wrapper">
          <div class="store-main-meta">
            <img src="${store.logo || ''}" alt="${store.name}" class="store-logo" />
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
              ⚠️ A pizzaria está fechada no momento. Você ainda pode montar sua sacola e enviar seu pedido para agendamento via WhatsApp.
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
