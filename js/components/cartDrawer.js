/**
 * Componente: Barra Flutuante da Sacola e Gaveta do Carrinho (Cart Drawer)
 * Compatível com file:// e http://
 */

function setupCartDrawer(onProceedToCheckout) {
  const floatingBar = document.getElementById('floatingCartBar');
  const cartDrawerBackdrop = document.getElementById('cartDrawerBackdrop');
  const cartDrawerContent = document.getElementById('cartDrawerContent');
  const cs = window.customerService;

  function updateFloatingBar() {
    const count = window.appState.getItemCount();
    const total = window.appState.getTotal();

    if (count > 0) {
      floatingBar.classList.add('visible');
      floatingBar.innerHTML = `
        <button class="floating-cart-btn" id="btnOpenCart">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="cart-badge-count">${count} ${count === 1 ? 'item' : 'itens'}</span>
            <span>Ver Sacola</span>
          </div>
          <span style="font-size: 1.1rem; font-weight: 800;">${cs ? cs.formatCurrency(total) : 'R$ ' + total}</span>
        </button>
      `;

      const btnOpen = floatingBar.querySelector('#btnOpenCart');
      if (btnOpen) btnOpen.addEventListener('click', openDrawer);
    } else {
      floatingBar.classList.remove('visible');
      closeDrawer();
    }
  }

  function openDrawer() {
    renderCartContent();
    cartDrawerBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    cartDrawerBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderCartContent() {
    const items = window.appState.cart.items;
    const store = window.appState.store;
    const subtotal = window.appState.getSubtotal();
    const deliveryFee = window.appState.getDeliveryFee();
    const total = window.appState.getTotal();
    const orderType = window.appState.cart.orderType;
    const paymentMethod = window.appState.cart.paymentMethod;
    const cashChange = window.appState.cart.cashChange;
    const minOrder = Number(store.min_order_value || 0);

    const isBelowMin = subtotal < minOrder;

    if (items.length === 0) {
      cartDrawerContent.innerHTML = `
        <div class="modal-header">
          <div class="modal-title">Sua Sacola</div>
          <button class="modal-close-btn" id="btnCloseCart">✕</button>
        </div>
        <div class="modal-body" style="text-align: center; padding: 3rem 1.5rem;">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🍕</div>
          <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.35rem;">Sua sacola está vazia</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">Adicione deliciosas pizzas e bebidas do cardápio para continuar.</p>
          <button class="btn btn-secondary" id="btnBackToMenu">Ver Cardápio</button>
        </div>
      `;

      cartDrawerContent.querySelector('#btnCloseCart')?.addEventListener('click', closeDrawer);
      cartDrawerContent.querySelector('#btnBackToMenu')?.addEventListener('click', closeDrawer);
      return;
    }

    cartDrawerContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Sua Sacola (${window.appState.getItemCount()} ${window.appState.getItemCount() === 1 ? 'item' : 'itens'})</div>
        <button class="modal-close-btn" id="btnCloseCart">✕</button>
      </div>

      <div class="modal-body">
        <!-- Tipo de Pedido: Entrega / Retirada -->
        <div class="delivery-toggle">
          <button class="delivery-toggle-btn ${orderType === 'delivery' ? 'active' : ''}" data-type="delivery">
            🛵 Entrega em Casa
          </button>
          <button class="delivery-toggle-btn ${orderType === 'pickup' ? 'active' : ''}" data-type="pickup">
            🏪 Retirar no Balcão
          </button>
        </div>

        <!-- Lista de Itens da Sacola -->
        <div class="cart-items-list">
          ${items.map(item => `
            <div class="cart-item">
              <div class="cart-item-details">
                <div class="cart-item-title">${item.productName}</div>
                
                ${item.crust && item.crust.name && item.crust.price > 0 ? `
                  <div class="cart-item-addons">🧀 Borda: ${item.crust.name} (+${cs ? cs.formatCurrency(item.crust.price) : 'R$ ' + item.crust.price})</div>
                ` : ''}

                ${item.extras && item.extras.length > 0 ? `
                  <div class="cart-item-addons">🥓 Extras: ${item.extras.map(e => `${e.name} (+${cs ? cs.formatCurrency(e.price) : 'R$ ' + e.price})`).join(', ')}</div>
                ` : ''}

                ${item.observation ? `
                  <div class="cart-item-notes">💬 "${item.observation}"</div>
                ` : ''}

                <div class="cart-item-footer" style="margin-top: 0.5rem;">
                  <div class="quantity-control" style="padding: 0.15rem 0.35rem;">
                    <button class="btn-qty btn-cart-qty-minus" data-id="${item.id}" style="width: 26px; height: 26px; font-size: 0.9rem;">-</button>
                    <span class="qty-number" style="font-size: 0.88rem;">${item.quantity}</span>
                    <button class="btn-qty btn-cart-qty-plus" data-id="${item.id}" style="width: 26px; height: 26px; font-size: 0.9rem;">+</button>
                  </div>

                  <span class="cart-item-price">${cs ? cs.formatCurrency(item.itemTotal) : 'R$ ' + item.itemTotal}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        ${orderType === 'delivery' ? `
          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label">📍 Selecione seu Bairro para a Taxa de Entrega:</label>
            <select id="cartNeighborhoodSelect">
              ${(store.neighborhoods || []).map(n => `
                <option value="${n.name}" ${window.appState.cart.neighborhood?.name === n.name ? 'selected' : ''}>
                  ${n.name} — ${cs ? cs.formatCurrency(n.fee) : 'R$ ' + n.fee}
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        <!-- Forma de Pagamento -->
        <div style="margin-bottom: 1.25rem;">
          <label class="form-label" style="margin-bottom: 0.5rem; display: block;">💳 Como deseja pagar?</label>
          <div class="payment-grid">
            <div class="payment-card ${paymentMethod === 'pix' ? 'selected' : ''}" data-method="pix">
              <div class="payment-card-icon">⚡</div>
              <div class="payment-card-label">PIX</div>
            </div>
            <div class="payment-card ${paymentMethod === 'card' ? 'selected' : ''}" data-method="card">
              <div class="payment-card-icon">💳</div>
              <div class="payment-card-label">Cartão na Entrega</div>
            </div>
            <div class="payment-card ${paymentMethod === 'cash' ? 'selected' : ''}" data-method="cash">
              <div class="payment-card-icon">💵</div>
              <div class="payment-card-label">Dinheiro</div>
            </div>
          </div>

          ${paymentMethod === 'cash' ? `
            <div class="form-group" id="cashChangeGroup">
              <label class="form-label">Precisa de troco para quanto? (Deixe em branco se não precisar):</label>
              <input type="number" id="cashChangeInput" placeholder="Ex: 100" value="${cashChange || ''}" min="${Math.ceil(total)}" step="5" />
            </div>
          ` : ''}
        </div>

        <!-- Totais -->
        <div class="order-totals">
          <div class="order-total-row">
            <span>Subtotal dos Itens:</span>
            <span>${cs ? cs.formatCurrency(subtotal) : 'R$ ' + subtotal}</span>
          </div>
          ${orderType === 'delivery' ? `
            <div class="order-total-row">
              <span>Taxa de Entrega (${window.appState.cart.neighborhood?.name || 'Padrão'}):</span>
              <span>${cs ? cs.formatCurrency(deliveryFee) : 'R$ ' + deliveryFee}</span>
            </div>
          ` : `
            <div class="order-total-row">
              <span>Taxa de Entrega:</span>
              <span style="color: var(--status-open); font-weight: 700;">Grátis (Retirada)</span>
            </div>
          `}
          <div class="order-total-row final">
            <span>Total:</span>
            <span class="total-value">${cs ? cs.formatCurrency(total) : 'R$ ' + total}</span>
          </div>
        </div>

        ${isBelowMin ? `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 0.65rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-bottom: 1rem; text-align: center;">
            ⚠️ Pedido mínimo: ${cs ? cs.formatCurrency(minOrder) : 'R$ ' + minOrder}. Faltam ${cs ? cs.formatCurrency(minOrder - subtotal) : 'R$ ' + (minOrder - subtotal)}.
          </div>
        ` : ''}
      </div>

      <div class="modal-footer">
        <button class="btn btn-whatsapp btn-block" id="btnProceedCheckout" ${isBelowMin ? 'disabled style="opacity: 0.5; pointer-events: none;"' : ''}>
          <span>Finalizar Pedido</span>
          <span>${cs ? cs.formatCurrency(total) : 'R$ ' + total} →</span>
        </button>
      </div>
    `;

    bindCartEvents();
  }

  function bindCartEvents() {
    cartDrawerContent.querySelector('#btnCloseCart')?.addEventListener('click', closeDrawer);

    // Tipo de entrega toggle
    cartDrawerContent.querySelectorAll('.delivery-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.appState.setOrderType(btn.dataset.type);
        renderCartContent();
      });
    });

    // Quantidade +/-
    cartDrawerContent.querySelectorAll('.btn-cart-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        window.appState.updateQuantity(btn.dataset.id, -1);
        renderCartContent();
      });
    });

    cartDrawerContent.querySelectorAll('.btn-cart-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        window.appState.updateQuantity(btn.dataset.id, 1);
        renderCartContent();
      });
    });

    // Bairro
    const selectNeighborhood = cartDrawerContent.querySelector('#cartNeighborhoodSelect');
    if (selectNeighborhood) {
      selectNeighborhood.addEventListener('change', (e) => {
        const found = window.appState.store.neighborhoods?.find(n => n.name === e.target.value);
        if (found) {
          window.appState.setNeighborhood(found);
          renderCartContent();
        }
      });
    }

    // Pagamento
    cartDrawerContent.querySelectorAll('.payment-card').forEach(card => {
      card.addEventListener('click', () => {
        const method = card.dataset.method;
        window.appState.setPaymentMethod(method);
        renderCartContent();
      });
    });

    // Troco
    const cashInput = cartDrawerContent.querySelector('#cashChangeInput');
    if (cashInput) {
      cashInput.addEventListener('input', (e) => {
        window.appState.cart.cashChange = e.target.value;
      });
    }

    // Avançar
    const btnProceed = cartDrawerContent.querySelector('#btnProceedCheckout');
    if (btnProceed) {
      btnProceed.addEventListener('click', () => {
        closeDrawer();
        if (onProceedToCheckout) {
          onProceedToCheckout();
        }
      });
    }
  }

  // Escuta mudanças de estado para atualizar a barra e drawer
  window.appState.subscribe(() => {
    updateFloatingBar();
    if (cartDrawerBackdrop.classList.contains('active')) {
      renderCartContent();
    }
  });

  // Ouve evento customizado de abrir carrinho
  window.addEventListener('open_cart', () => {
    openDrawer();
  });

  // Fecha ao clicar no backdrop
  cartDrawerBackdrop.addEventListener('click', (e) => {
    if (e.target === cartDrawerBackdrop) {
      closeDrawer();
    }
  });

  updateFloatingBar();

  return { openDrawer, closeDrawer };
}

window.setupCartDrawer = setupCartDrawer;
