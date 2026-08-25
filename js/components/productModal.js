/**
 * Componente: Modal de Personalização e Adição de Produto à Sacola
 * Suporta: Escolha de Tamanho (Média, Grande, Gigante), Pizza Meio a Meio (2 Sabores), Bordas e Extras.
 * Compatível com file:// e http://
 */

function setupProductModal() {
  const modalBackdrop = document.getElementById('productModalBackdrop');
  const modalContent = document.getElementById('productModalContent');

  let currentProduct = null;
  let selectedSize = null;
  let isHalfHalf = false;
  let selectedSecondFlavor = null;
  let selectedCrust = null;
  let selectedExtras = [];
  let quantity = 1;
  let observation = '';

  function openModal(product) {
    currentProduct = product;
    const addonGroups = window.appState.addonGroups || {};
    const sizeGroup = addonGroups.sizes;
    const crustGroup = addonGroups.crusts;
    const extraGroup = addonGroups.extras;
    const cs = window.customerService;

    // Tamanho padrão (Grande)
    selectedSize = sizeGroup?.options.find(s => s.default) || sizeGroup?.options[1] || null;
    isHalfHalf = false;
    selectedSecondFlavor = null;
    selectedCrust = null;
    selectedExtras = [];
    quantity = 1;
    observation = '';

    // Filtra todas as pizzas disponíveis para a opção meio a meio
    const allPizzas = (window.appState.products || []).filter(p => p.is_pizza && p.available !== false && p.id !== product.id);

    modalContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">${product.name}</div>
        <button class="modal-close-btn" id="btnCloseProductModal">✕</button>
      </div>

      <div class="modal-body">
        <img src="${product.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'}" alt="${product.name}" class="custom-modal-img" />
        
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.25rem; line-height: 1.4;">
          ${product.description || ''}
        </p>

        <!-- Seleção de Tamanho (Se for Pizza) -->
        ${product.is_pizza && sizeGroup ? `
          <div class="addon-group">
            <div class="addon-group-header">
              <span class="addon-group-title">📏 ${sizeGroup.title}</span>
              <span class="addon-group-required">Obrigatório</span>
            </div>
            <div class="addon-options-list">
              ${sizeGroup.options.map(opt => `
                <div class="addon-option size-option ${opt.id === selectedSize?.id ? 'selected' : ''}" data-size-id="${opt.id}">
                  <div class="addon-option-info">
                    <input type="radio" name="pizza_size" value="${opt.id}" ${opt.id === selectedSize?.id ? 'checked' : ''} style="width: auto;" />
                    <span style="font-size: 0.88rem; font-weight: 600;">${opt.name}</span>
                  </div>
                  <span class="addon-option-price">
                    ${opt.price_diff > 0 ? '+ ' + (cs ? cs.formatCurrency(opt.price_diff) : opt.price_diff) : (opt.price_diff < 0 ? (cs ? cs.formatCurrency(opt.price_diff) : opt.price_diff) : 'Incluso')}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Opção Meio a Meio (2 Sabores) -->
        ${product.is_pizza && allPizzas.length > 0 ? `
          <div class="addon-group" id="halfHalfContainer" style="${selectedSize?.allows_half_half !== false ? 'display: block;' : 'display: none;'}">
            <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.9rem; margin-bottom: 0.75rem;">
              <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <input type="checkbox" id="checkHalfHalf" style="width: auto;" />
                  <div>
                    <div style="font-weight: 700; font-size: 0.9rem;">🍕 Dividir em 2 Sabores? (Meio a Meio)</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">Escolha um segundo sabor para a outra metade da pizza</div>
                  </div>
                </div>
              </label>

              <div id="secondFlavorWrapper" style="display: none; margin-top: 0.85rem; border-top: 1px solid var(--border-light); padding-top: 0.85rem;">
                <label class="form-label" style="margin-bottom: 0.4rem; display: block;">Selecione o 2º Sabor:</label>
                <select id="secondFlavorSelect">
                  <option value="">-- Escolha a outra metade da pizza --</option>
                  ${allPizzas.map(p => `
                    <option value="${p.id}" data-price="${p.price}">
                      ${p.name} (${cs ? cs.formatCurrency(p.price) : 'R$ ' + p.price})
                    </option>
                  `).join('')}
                </select>
                <div style="font-size: 0.75rem; color: var(--secondary); margin-top: 0.35rem;">
                  ℹ️ O valor base será cobrado pelo sabor de maior valor.
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Bordas Recheadas -->
        ${product.has_crusts && crustGroup ? `
          <div class="addon-group">
            <div class="addon-group-header">
              <span class="addon-group-title">🧀 ${crustGroup.title}</span>
              <span class="addon-group-required">Opcional</span>
            </div>
            <div class="addon-options-list">
              ${crustGroup.options.map(opt => `
                <div class="addon-option crust-option ${opt.price === 0 ? 'selected' : ''}" data-crust-id="${opt.id}" data-price="${opt.price}">
                  <div class="addon-option-info">
                    <input type="radio" name="crust" value="${opt.id}" ${opt.price === 0 ? 'checked' : ''} style="width: auto;" />
                    <span style="font-size: 0.88rem; font-weight: 600;">${opt.name}</span>
                  </div>
                  <span class="addon-option-price">${opt.price > 0 ? '+ ' + (cs ? cs.formatCurrency(opt.price) : opt.price) : 'Grátis'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Adicionais Extras -->
        ${product.has_extras && extraGroup ? `
          <div class="addon-group">
            <div class="addon-group-header">
              <span class="addon-group-title">🥓 ${extraGroup.title}</span>
              <span class="addon-group-required">Opcional</span>
            </div>
            <div class="addon-options-list">
              ${extraGroup.options.map(opt => `
                <div class="addon-option extra-option" data-extra-id="${opt.id}" data-price="${opt.price}" data-name="${opt.name}">
                  <div class="addon-option-info">
                    <input type="checkbox" name="extra" value="${opt.id}" style="width: auto;" />
                    <span style="font-size: 0.88rem; font-weight: 600;">${opt.name}</span>
                  </div>
                  <span class="addon-option-price">+ ${cs ? cs.formatCurrency(opt.price) : opt.price}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Observações do Item -->
        <div class="addon-group">
          <div class="addon-group-header">
            <span class="addon-group-title">💬 Observações do Item</span>
          </div>
          <textarea id="productObservation" rows="2" placeholder="Ex: Sem cebola, massa bem assada, tirar azeitonas..." style="resize: none;"></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <div class="quantity-control">
          <button class="btn-qty" id="btnQtyMinus">-</button>
          <span class="qty-number" id="modalQtyDisplay">1</span>
          <button class="btn-qty" id="btnQtyPlus">+</button>
        </div>

        <button class="btn btn-primary btn-block" id="btnConfirmAddToCart">
          <span>Adicionar</span>
          <span id="btnModalPriceTotal">${cs ? cs.formatCurrency(product.price) : 'R$ ' + product.price}</span>
        </button>
      </div>
    `;

    bindModalEvents(product, sizeGroup, crustGroup, extraGroup, allPizzas);

    modalBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  function bindModalEvents(product, sizeGroup, crustGroup, extraGroup, allPizzas) {
    const cs = window.customerService;
    const btnClose = modalContent.querySelector('#btnCloseProductModal');
    if (btnClose) btnClose.addEventListener('click', closeModal);

    const btnMinus = modalContent.querySelector('#btnQtyMinus');
    const btnPlus = modalContent.querySelector('#btnQtyPlus');
    const qtyDisplay = modalContent.querySelector('#modalQtyDisplay');
    const priceDisplay = modalContent.querySelector('#btnModalPriceTotal');
    const obsInput = modalContent.querySelector('#productObservation');

    // Borda default
    if (product.has_crusts && crustGroup) {
      selectedCrust = crustGroup.options.find(o => o.price === 0) || null;
    }

    // Seleção de Tamanho
    const halfHalfContainer = modalContent.querySelector('#halfHalfContainer');
    const checkHalfHalf = modalContent.querySelector('#checkHalfHalf');
    const secondFlavorWrapper = modalContent.querySelector('#secondFlavorWrapper');
    const secondFlavorSelect = modalContent.querySelector('#secondFlavorSelect');

    modalContent.querySelectorAll('.size-option').forEach(option => {
      option.addEventListener('click', () => {
        modalContent.querySelectorAll('.size-option').forEach(o => {
          o.classList.remove('selected');
          const radio = o.querySelector('input[type="radio"]');
          if (radio) radio.checked = false;
        });
        option.classList.add('selected');
        const radio = option.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        const sizeId = option.dataset.sizeId;
        selectedSize = sizeGroup.options.find(s => s.id === sizeId) || null;

        if (halfHalfContainer) {
          if (selectedSize && selectedSize.allows_half_half === false) {
            halfHalfContainer.style.display = 'none';
            if (checkHalfHalf) checkHalfHalf.checked = false;
            if (secondFlavorWrapper) secondFlavorWrapper.style.display = 'none';
            isHalfHalf = false;
            selectedSecondFlavor = null;
          } else {
            halfHalfContainer.style.display = 'block';
          }
        }

        updateModalTotal();
      });
    });

    // Meio a Meio Toggle
    if (checkHalfHalf) {
      checkHalfHalf.addEventListener('change', (e) => {
        isHalfHalf = e.target.checked;
        if (secondFlavorWrapper) {
          secondFlavorWrapper.style.display = isHalfHalf ? 'block' : 'none';
        }
        if (!isHalfHalf) {
          selectedSecondFlavor = null;
        } else if (secondFlavorSelect && secondFlavorSelect.value) {
          selectedSecondFlavor = allPizzas.find(p => p.id === secondFlavorSelect.value) || null;
        }
        updateModalTotal();
      });
    }

    if (secondFlavorSelect) {
      secondFlavorSelect.addEventListener('change', (e) => {
        const pId = e.target.value;
        selectedSecondFlavor = allPizzas.find(p => p.id === pId) || null;
        updateModalTotal();
      });
    }

    // Seleção de borda
    modalContent.querySelectorAll('.crust-option').forEach(option => {
      option.addEventListener('click', () => {
        modalContent.querySelectorAll('.crust-option').forEach(o => {
          o.classList.remove('selected');
          const radio = o.querySelector('input[type="radio"]');
          if (radio) radio.checked = false;
        });
        option.classList.add('selected');
        const radio = option.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        const crustId = option.dataset.crustId;
        selectedCrust = crustGroup.options.find(o => o.id === crustId) || null;
        updateModalTotal();
      });
    });

    // Seleção de extras
    modalContent.querySelectorAll('.extra-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }

        if (checkbox.checked) {
          option.classList.add('selected');
        } else {
          option.classList.remove('selected');
        }

        const extraId = option.dataset.extraId;
        const extraOpt = extraGroup.options.find(o => o.id === extraId);
        if (checkbox.checked && extraOpt) {
          if (!selectedExtras.some(e => e.id === extraId)) {
            selectedExtras.push(extraOpt);
          }
        } else {
          selectedExtras = selectedExtras.filter(e => e.id !== extraId);
        }
        updateModalTotal();
      });
    });

    // Quantidade
    btnMinus.addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        qtyDisplay.textContent = quantity;
        updateModalTotal();
      }
    });

    btnPlus.addEventListener('click', () => {
      quantity++;
      qtyDisplay.textContent = quantity;
      updateModalTotal();
    });

    function calculateUnitPrice() {
      let base = Number(product.price);
      if (isHalfHalf && selectedSecondFlavor) {
        base = Math.max(Number(product.price), Number(selectedSecondFlavor.price));
      }

      let unit = base;
      if (selectedSize && typeof selectedSize.price_diff === 'number') {
        unit += selectedSize.price_diff;
      }
      if (selectedCrust && selectedCrust.price) {
        unit += Number(selectedCrust.price);
      }
      if (selectedExtras && selectedExtras.length > 0) {
        selectedExtras.forEach(extra => {
          unit += Number(extra.price || 0);
        });
      }
      return unit;
    }

    function updateModalTotal() {
      const unit = calculateUnitPrice();
      const total = unit * quantity;
      priceDisplay.textContent = cs ? cs.formatCurrency(total) : 'R$ ' + total;
    }

    // Botão Adicionar
    const btnAdd = modalContent.querySelector('#btnConfirmAddToCart');
    btnAdd.addEventListener('click', () => {
      if (isHalfHalf && !selectedSecondFlavor) {
        alert('Por favor, selecione o 2º sabor da pizza.');
        if (secondFlavorSelect) secondFlavorSelect.focus();
        return;
      }

      observation = obsInput ? obsInput.value : '';
      window.appState.addItem({
        product,
        size: product.is_pizza ? selectedSize : null,
        secondFlavor: isHalfHalf ? selectedSecondFlavor : null,
        quantity,
        crust: selectedCrust,
        extras: selectedExtras,
        observation
      });
      closeModal();
    });
  }

  // Fecha modal ao clicar fora
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) {
      closeModal();
    }
  });

  return { openModal, closeModal };
}

window.setupProductModal = setupProductModal;
