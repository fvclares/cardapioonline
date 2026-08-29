/**
 * Componente: Modal de Checkout, Identificação do Cliente e Confirmação de Pedido
 * Compatível com file:// e http://
 */

function setupCheckoutModal() {
  const checkoutBackdrop = document.getElementById('checkoutModalBackdrop');
  const checkoutContent = document.getElementById('checkoutModalContent');
  const successBackdrop = document.getElementById('successModalBackdrop');
  const successContent = document.getElementById('successModalContent');

  function openCheckout() {
    renderCheckoutForm();
    checkoutBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCheckout() {
    checkoutBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderCheckoutForm() {
    const cs = window.customerService;
    const profile = cs ? cs.getProfile() : {};
    const isDelivery = window.appState.cart.orderType === 'delivery';
    const total = window.appState.getTotal();
    const savedAddresses = profile.addresses || [];
    const defaultAddr = savedAddresses.find(a => a.id === profile.default_address_id) || savedAddresses[0] || null;

    checkoutContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Identificação & Entrega</div>
        <button class="modal-close-btn" id="btnCloseCheckout">✕</button>
      </div>

      <div class="modal-body">
        <!-- Dados Pessoais -->
        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
            👤 Seus Dados de Contato
          </h4>

          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label class="form-label">Seu Nome Completo *</label>
              <input type="text" id="custNameInput" placeholder="Ex: João da Silva" value="${profile.name || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Seu WhatsApp *</label>
              <input type="tel" id="custPhoneInput" placeholder="(11) 99999-9999" value="${cs ? cs.formatPhone(profile.phone) : (profile.phone || '')}" required />
            </div>
          </div>
        </div>

        ${isDelivery ? `
          <!-- Endereço de Entrega -->
          <div style="margin-bottom: 1.25rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
              <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
                📍 Endereço de Entrega
              </h4>
              ${savedAddresses.length > 0 ? `
                <button type="button" id="btnToggleNewAddress" style="font-size: 0.78rem; color: var(--primary); font-weight: 700;">
                  + Outro Endereço
                </button>
              ` : ''}
            </div>

            ${savedAddresses.length > 0 ? `
              <div id="savedAddressesContainer" style="margin-bottom: 1rem;">
                ${savedAddresses.map(addr => `
                  <div class="addon-option address-choice-card ${defaultAddr?.id === addr.id ? 'selected' : ''}" data-address-id="${addr.id}">
                    <div class="addon-option-info">
                      <input type="radio" name="selectedSavedAddress" value="${addr.id}" ${defaultAddr?.id === addr.id ? 'checked' : ''} style="width: auto;" />
                      <div>
                        <div style="font-weight: 700; font-size: 0.88rem;">${addr.label || 'Casa'} — ${addr.street}, ${addr.number}</div>
                        <div style="font-size: 0.78rem; color: var(--text-muted);">${addr.neighborhood} ${addr.complement ? '• ' + addr.complement : ''}</div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Formulário de Endereço -->
            <div id="addressFormFields" style="${savedAddresses.length > 0 ? 'display: none;' : 'display: block;'}">
              <div class="form-grid form-grid-2" style="margin-bottom: 0.75rem;">
                <div class="form-group">
                  <label class="form-label">Rua / Avenida *</label>
                  <input type="text" id="addrStreet" placeholder="Ex: Rua das Flores" value="${defaultAddr ? defaultAddr.street : ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Número *</label>
                  <input type="text" id="addrNumber" placeholder="Ex: 123" value="${defaultAddr ? defaultAddr.number : ''}" />
                </div>
              </div>

              <div class="form-grid form-grid-2" style="margin-bottom: 0.75rem;">
                <div class="form-group">
                  <label class="form-label">Bairro *</label>
                  <input type="text" id="addrNeighborhood" placeholder="Ex: Centro" value="${window.appState.cart.neighborhood?.name || (defaultAddr ? defaultAddr.neighborhood : '')}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Complemento (Opcional)</label>
                  <input type="text" id="addrComplement" placeholder="Ex: Apto 42, Bloco B" value="${defaultAddr ? defaultAddr.complement : ''}" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Ponto de Referência (Opcional)</label>
                <input type="text" id="addrReference" placeholder="Ex: Próximo à padaria" value="${defaultAddr ? defaultAddr.reference : ''}" />
              </div>
            </div>
          </div>
        ` : `
          <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 0.25rem;">🏪 Retirada no Balcão</div>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">Você retirará seu pedido diretamente na loja em: <strong>${window.appState.store.address}</strong></p>
          </div>
        `}

        <div class="form-group" style="margin-bottom: 0.5rem;">
          <label class="form-label">Observações Gerais do Pedido (Opcional)</label>
          <textarea id="orderGeneralNotes" rows="2" placeholder="Ex: Não tocar campainha, ligar quando estiver no portão..." style="resize: none;"></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-whatsapp btn-block" id="btnSubmitOrderToWhatsApp" style="font-size: 1rem; padding: 0.95rem;">
          <span>🚀 Enviar Pedido pelo WhatsApp</span>
          <span>(${cs ? cs.formatCurrency(total) : 'R$ ' + total})</span>
        </button>
      </div>
    `;

    bindCheckoutEvents(profile, savedAddresses);
  }

  function bindCheckoutEvents(profile, savedAddresses) {
    const cs = window.customerService;
    checkoutContent.querySelector('#btnCloseCheckout')?.addEventListener('click', closeCheckout);

    // Formatação de telefone
    const phoneInput = checkoutContent.querySelector('#custPhoneInput');
    if (phoneInput && cs) {
      phoneInput.addEventListener('input', (e) => {
        e.target.value = cs.formatPhone(e.target.value);
      });
    }

    // Toggle de novo endereço
    const btnToggleNew = checkoutContent.querySelector('#btnToggleNewAddress');
    const addressFormFields = checkoutContent.querySelector('#addressFormFields');
    if (btnToggleNew && addressFormFields) {
      btnToggleNew.addEventListener('click', () => {
        const isHidden = addressFormFields.style.display === 'none';
        addressFormFields.style.display = isHidden ? 'block' : 'none';
        btnToggleNew.textContent = isHidden ? '✕ Cancelar Novo' : '+ Outro Endereço';
        
        if (isHidden) {
          checkoutContent.querySelectorAll('.address-choice-card').forEach(c => c.classList.remove('selected'));
          checkoutContent.querySelectorAll('input[name="selectedSavedAddress"]').forEach(r => r.checked = false);
        }
      });
    }

    // Seleção de endereço salvo
    checkoutContent.querySelectorAll('.address-choice-card').forEach(card => {
      card.addEventListener('click', () => {
        checkoutContent.querySelectorAll('.address-choice-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        if (addressFormFields) {
          addressFormFields.style.display = 'none';
          if (btnToggleNew) btnToggleNew.textContent = '+ Outro Endereço';
        }
      });
    });

    // Enviar pedido
    const btnSubmit = checkoutContent.querySelector('#btnSubmitOrderToWhatsApp');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        handleOrderSubmission(profile, savedAddresses);
      });
    }
  }

  function handleOrderSubmission(profile, savedAddresses) {
    const cs = window.customerService;
    // Validação fração ½ - pizzas incompletas
    if(window.appState.validateFractionalCart){
      const v = window.appState.validateFractionalCart();
      if(!v.valid){
        alert('⚠️ Pizza incompleta:\n\n' + v.errors.join('\n') + '\n\nComplete com outra ½ do mesmo tamanho ou remova a fração.');
        return;
      }
      // Validação tamanho consistente: verifica se alguma pizza fracionada tem tamanho diferente dentro do mesmo "grupo" - já agrupado por tamanho, mas se misturar tamanhos diferentes em meias, já está separado por tamanho, então erro já é por tamanho incompleto.
      // Também bloqueia 3/4, 1 inteira + ½ (que já cai no erro anterior)
    }
    const nameInput = checkoutContent.querySelector('#custNameInput');
    const phoneInput = checkoutContent.querySelector('#custPhoneInput');
    const notesInput = checkoutContent.querySelector('#orderGeneralNotes');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput && cs ? cs.cleanPhone(phoneInput.value) : (phoneInput ? phoneInput.value.trim() : '');

    if (!name) {
      alert('Por favor, informe seu nome.');
      nameInput.focus();
      return;
    }

    if (!phone || phone.length < 10) {
      alert('Por favor, informe um telefone WhatsApp válido.');
      phoneInput.focus();
      return;
    }

    if (cs) cs.saveProfile(name, phone);

    let deliveryAddress = null;
    const isDelivery = window.appState.cart.orderType === 'delivery';

    if (isDelivery) {
      const selectedRadio = checkoutContent.querySelector('input[name="selectedSavedAddress"]:checked');
      const addressFormFields = checkoutContent.querySelector('#addressFormFields');
      const isManualFormOpen = addressFormFields && addressFormFields.style.display !== 'none';

      if (selectedRadio && !isManualFormOpen) {
        deliveryAddress = savedAddresses.find(a => a.id === selectedRadio.value);
      } else {
        const street = checkoutContent.querySelector('#addrStreet')?.value.trim();
        const number = checkoutContent.querySelector('#addrNumber')?.value.trim();
        const neighborhood = checkoutContent.querySelector('#addrNeighborhood')?.value.trim();
        const complement = checkoutContent.querySelector('#addrComplement')?.value.trim();
        const reference = checkoutContent.querySelector('#addrReference')?.value.trim();

        if (!street || !number || !neighborhood) {
          alert('Por favor, preencha a Rua, Número e Bairro para a entrega.');
          return;
        }

        if (cs) {
          deliveryAddress = cs.saveAddress({
            label: 'Casa',
            street,
            number,
            neighborhood,
            complement,
            reference,
            city: 'São Paulo'
          });
        }
      }
    }

    const orderSnapshot = window.orderService.createOrderSnapshot({
      customer: {
        token: profile.token,
        name,
        phone
      },
      address: deliveryAddress,
      paymentMethod: window.appState.cart.paymentMethod,
      cashChange: window.appState.cart.cashChange,
      notes: notesInput ? notesInput.value : ''
    });

    window.whatsappService.openWhatsApp(orderSnapshot);
    window.appState.clearCart();

    closeCheckout();
    openSuccessModal(orderSnapshot);
  }

  function openSuccessModal(order) {
    const cs = window.customerService;
    successContent.innerHTML = `
      <div class="modal-body success-screen">
        <div class="success-icon">✓</div>
        <h2 class="success-title">Pedido Enviado para o WhatsApp!</h2>
        <p class="success-subtitle">
          Abrimos uma conversa no WhatsApp da <strong>${order.storeName}</strong> com o resumo do seu pedido preenchido.
          Basta tocar em <strong>"Enviar"</strong> no WhatsApp para confirmar o pedido com a cozinha.
        </p>

        <div class="success-order-box">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: 800; font-size: 1.05rem;">
            <span>Pedido ${order.orderNumber}</span>
            <span style="color: var(--secondary);">${cs ? cs.formatCurrency(order.total) : 'R$ ' + order.total}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
            ${order.items.length} ${order.items.length === 1 ? 'item' : 'itens'} • ${order.orderType === 'delivery' ? 'Entrega em ' + (order.deliveryAddress?.neighborhood || '') : 'Retirada no Balcão'}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border-light); padding-top: 0.5rem;">
            Forma de Pagamento: ${order.payment.method.toUpperCase()} ${order.payment.cashChange ? '(Troco p/ ' + (cs ? cs.formatCurrency(order.payment.cashChange) : 'R$ ' + order.payment.cashChange) + ')' : ''}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button class="btn btn-whatsapp btn-block" id="btnReopenWhatsApp">
            💬 Reabrir WhatsApp da Pizzaria
          </button>
          <button class="btn btn-secondary btn-block" id="btnMakeNewOrder">
            🍕 Fazer Outro Pedido
          </button>
        </div>
      </div>
    `;

    successContent.querySelector('#btnReopenWhatsApp')?.addEventListener('click', () => {
      window.whatsappService.openWhatsApp(order);
    });

    successContent.querySelector('#btnMakeNewOrder')?.addEventListener('click', () => {
      successBackdrop.classList.remove('active');
      document.body.style.overflow = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    successBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Backdrop clicks
  checkoutBackdrop.addEventListener('click', (e) => {
    if (e.target === checkoutBackdrop) closeCheckout();
  });

  return { openCheckout, closeCheckout };
}

window.setupCheckoutModal = setupCheckoutModal;
