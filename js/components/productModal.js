/**
 * Componente: Modal de Personalização e Adição de Produto à Sacola
 * Suporta: Tamanhos definidos pela loja (P/M/G) com preço por pizza/tamanho e divisão em até 4 sabores
 */

function setupProductModal() {
  const modalBackdrop = document.getElementById('productModalBackdrop');
  const modalContent = document.getElementById('productModalContent');

  let currentProduct = null;
  let selectedSize = null;
  let selectedFlavors = []; // adicionais além do principal
  let selectedCrust = null;
  let selectedExtras = [];
  let quantity = 1;
  let observation = '';

  function getPizzaSizes() {
    const fromApp = window.appState?.pizzaSizes || [];
    const fromStorage = window.storage?.getPizzaSizes?.() || [];
    const list = (fromApp.length ? fromApp : fromStorage).filter(s=> s.is_active!==false).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
    return list;
  }
  function getPriceForProductSize(product, size) {
    if (!size) return Number(product.price || product.base_price || 0);
    // tenta product_size_prices
    const allPrices = window.appState?.productSizePrices || window.storage?.getProductSizePrices?.() || [];
    const found = allPrices.find(p=> p.product_id===product.id && p.size_id===size.id);
    if (found) return Number(found.price);
    // fallback para product.price (ou base_price) se não houver preço por tamanho
    return Number(product.price || product.base_price || 0);
  }

  function openModal(product) {
    currentProduct = product;
    const addonGroups = window.appState.addonGroups || {};
    const crustGroup = addonGroups.crusts;
    const extraGroup = addonGroups.extras;
    const cs = window.customerService;
    const pizzaSizes = getPizzaSizes();
    const usePizzaSizes = product.is_pizza && pizzaSizes.length > 0;
    const sizeGroup = addonGroups.sizes; // fallback legado

    // Tamanho padrão
    if (usePizzaSizes) {
      selectedSize = pizzaSizes[0] || null;
    } else {
      selectedSize = sizeGroup?.options.find(s => s.default) || sizeGroup?.options[1] || null;
    }
    selectedFlavors = [];
    selectedCrust = null;
    selectedExtras = [];
    quantity = 1;
    observation = '';

    const allPizzas = (window.appState.products || []).filter(p => p.is_pizza && p.available !== false && p.id !== product.id);

    // Preço inicial para display
    const initialPrice = usePizzaSizes ? getPriceForProductSize(product, selectedSize) : Number(product.price || 0);

    modalContent.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">${product.codigo ? '#' + String(product.codigo).padStart(3,'0') + ' ' : ''}${product.name}</div>
        <button class="modal-close-btn" id="btnCloseProductModal">✕</button>
      </div>

      <div class="modal-body">
        ${product.image ? `<img src="${product.image}" alt="${product.name}" class="custom-modal-img" />` : ''}
        
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.25rem; line-height: 1.4;">
          ${product.description || ''}
        </p>

        <!-- Tamanhos (loja) -->
        ${product.is_pizza ? (
          usePizzaSizes ? `
          <div class="addon-group">
            <div class="addon-group-header">
              <span class="addon-group-title">📏 Escolha o Tamanho</span>
              <span class="addon-group-required">Obrigatório</span>
            </div>
            <div class="addon-options-list">
              ${pizzaSizes.map(s=>{
                const price = getPriceForProductSize(product, s);
                const isSel = s.id===selectedSize?.id;
                return `
                <div class="addon-option size-option ${isSel?'selected':''}" data-size-id="${s.id}">
                  <div class="addon-option-info">
                    <input type="radio" name="pizza_size" value="${s.id}" ${isSel?'checked':''} style="width:auto;" />
                    <span style="font-size:0.88rem; font-weight:600;">${s.name} (${s.slices} fatias) - até ${s.max_flavors} sabor${s.max_flavors>1?'es':''}</span>
                  </div>
                  <span class="addon-option-price">${cs ? cs.formatCurrency(price) : 'R$ '+price}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
          ` : (sizeGroup ? `
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
          ` : '')
        ) : ''}

        <!-- Divisão em sabores -->
        ${product.is_pizza && usePizzaSizes ? `
          <div class="addon-group" id="flavorsGroup" style="${(selectedSize?.max_flavors||1) > 1 ? 'display:block;' : 'display:none;'}">
            <div class="addon-group-header">
              <span class="addon-group-title">🍕 Dividir sabores</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">até ${selectedSize?.max_flavors||1} sabores</span>
            </div>
            <div id="flavorsSelectors">
              ${buildFlavorSelectors(selectedSize, allPizzas, cs)}
            </div>
          </div>
        ` : (product.is_pizza && allPizzas.length > 0 && !usePizzaSizes ? `
          <div class="addon-group" id="halfHalfContainer" style="${selectedSize?.allows_half_half !== false ? 'display: block;' : 'display: none;'}">
            <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.9rem; margin-bottom: 0.75rem;">
              <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <input type="checkbox" id="checkHalfHalf" style="width: auto;" />
                  <div>
                    <div style="font-weight: 700; font-size: 0.9rem;">🍕 Dividir em 2 Sabores? (Meio a Meio)</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">Escolha um segundo sabor para a outra metade</div>
                  </div>
                </div>
              </label>
              <div id="secondFlavorWrapper" style="display: none; margin-top: 0.85rem; border-top: 1px solid var(--border-light); padding-top: 0.85rem;">
                <label class="form-label" style="margin-bottom: 0.4rem; display: block;">Selecione o 2º Sabor:</label>
                <select id="secondFlavorSelect">
                  <option value="">-- Escolha a outra metade --</option>
                  ${allPizzas.map(p => `<option value="${p.id}">${p.name} (${cs ? cs.formatCurrency(getPriceForProductSize(p, selectedSize)) : 'R$ '+getPriceForProductSize(p, selectedSize)})</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
        ` : '')}

        <!-- Bordas -->
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

        <!-- Extras -->
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

        <div class="addon-group">
          <div class="addon-group-header">
            <span class="addon-group-title">💬 Observações do Item</span>
          </div>
          <textarea id="productObservation" rows="2" placeholder="Ex: Sem cebola, massa bem assada..." style="resize: none;"></textarea>
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
          <span id="btnModalPriceTotal">${cs ? cs.formatCurrency(initialPrice) : 'R$ ' + initialPrice}</span>
        </button>
      </div>
    `;

    bindModalEvents(product, sizeGroup, crustGroup, extraGroup, allPizzas, pizzaSizes, usePizzaSizes);

    modalBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function buildFlavorSelectors(size, allPizzas, cs) {
    if (!size || size.max_flavors <= 1) return '<p style="font-size:0.8rem; color:var(--text-muted);">Este tamanho não permite divisão.</p>';
    let html = '<p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">Selecione os sabores adicionais:</p>';
    for (let i=1; i < size.max_flavors; i++) {
      html += `
        <div style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.8rem;">${i+1}º sabor:</label>
          <select class="flavor-select" data-index="${i}" style="width:100%;">
            <option value="">-- não dividir --</option>
            ${allPizzas.map(p => `<option value="${p.id}">${p.name} (${cs ? cs.formatCurrency(getPriceForProductSize(p, size)) : 'R$ '+getPriceForProductSize(p, size)})</option>`).join('')}
          </select>
        </div>
      `;
    }
    html += '<div style="font-size:0.75rem; color:var(--secondary); margin-top:0.3rem;">ℹ️ Valor cobrado será o maior preço entre os sabores no tamanho escolhido.</div>';
    return html;
  }

  function getPriceForProductSize(product, size) {
    if (!size) return Number(product.price || product.base_price || 0);
    const allPrices = window.appState?.productSizePrices || window.storage?.getProductSizePrices?.() || [];
    const found = allPrices.find(p=> p.product_id===product.id && p.size_id===size.id);
    if (found) return Number(found.price);
    return Number(product.price || product.base_price || 0);
  }

  function closeModal() {
    modalBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  function bindModalEvents(product, sizeGroup, crustGroup, extraGroup, allPizzas, pizzaSizes, usePizzaSizes) {
    const cs = window.customerService;
    const btnClose = modalContent.querySelector('#btnCloseProductModal');
    if (btnClose) btnClose.addEventListener('click', closeModal);

    const btnMinus = modalContent.querySelector('#btnQtyMinus');
    const btnPlus = modalContent.querySelector('#btnQtyPlus');
    const qtyDisplay = modalContent.querySelector('#modalQtyDisplay');
    const priceDisplay = modalContent.querySelector('#btnModalPriceTotal');
    const obsInput = modalContent.querySelector('#productObservation');

    if (product.has_crusts && crustGroup) {
      selectedCrust = crustGroup.options.find(o => o.price === 0) || null;
    }

    // Tamanhos pizza nova
    if (usePizzaSizes) {
      modalContent.querySelectorAll('.size-option').forEach(option => {
        option.addEventListener('click', () => {
          modalContent.querySelectorAll('.size-option').forEach(o=>{ o.classList.remove('selected'); const r=o.querySelector('input'); if(r) r.checked=false; });
          option.classList.add('selected'); const r=option.querySelector('input'); if(r) r.checked=true;
          const sizeId = option.dataset.sizeId;
          selectedSize = pizzaSizes.find(s=> s.id===sizeId) || null;
          selectedFlavors = [];
          // rebuild flavor selectors
          const cont = modalContent.querySelector('#flavorsSelectors');
          const grp = modalContent.querySelector('#flavorsGroup');
          if (cont && grp) {
            cont.innerHTML = buildFlavorSelectors(selectedSize, allPizzas, cs);
            grp.style.display = (selectedSize?.max_flavors||1) > 1 ? 'block' : 'none';
            bindFlavorSelects();
          }
          updateModalTotal();
        });
      });
      bindFlavorSelects();
    } else {
      // legado sizeGroup
      const halfHalfContainer = modalContent.querySelector('#halfHalfContainer');
      const checkHalfHalf = modalContent.querySelector('#checkHalfHalf');
      const secondFlavorWrapper = modalContent.querySelector('#secondFlavorWrapper');
      const secondFlavorSelect = modalContent.querySelector('#secondFlavorSelect');
      modalContent.querySelectorAll('.size-option').forEach(option => {
        option.addEventListener('click', () => {
          modalContent.querySelectorAll('.size-option').forEach(o => { o.classList.remove('selected'); const radio=o.querySelector('input'); if(radio) radio.checked=false; });
          option.classList.add('selected'); const radio=option.querySelector('input'); if(radio) radio.checked=true;
          const sizeId = option.dataset.sizeId;
          selectedSize = sizeGroup.options.find(s => s.id === sizeId) || null;
          if (halfHalfContainer) {
            if (selectedSize && selectedSize.allows_half_half === false) {
              halfHalfContainer.style.display = 'none';
              if (checkHalfHalf) checkHalfHalf.checked = false;
              if (secondFlavorWrapper) secondFlavorWrapper.style.display = 'none';
              selectedFlavors = [];
            } else { halfHalfContainer.style.display = 'block'; }
          }
          updateModalTotal();
        });
      });
      if (checkHalfHalf) {
        checkHalfHalf.addEventListener('change', (e) => {
          const isHalf = e.target.checked;
          if (secondFlavorWrapper) secondFlavorWrapper.style.display = isHalf ? 'block' : 'none';
          if (!isHalf) selectedFlavors = [];
          else if (secondFlavorSelect && secondFlavorSelect.value) {
            const pf = allPizzas.find(p=> p.id===secondFlavorSelect.value);
            selectedFlavors = pf ? [pf] : [];
          }
          updateModalTotal();
        });
      }
      if (secondFlavorSelect) {
        secondFlavorSelect.addEventListener('change', (e) => {
          const pf = allPizzas.find(p=> p.id===e.target.value);
          selectedFlavors = pf ? [pf] : [];
          updateModalTotal();
        });
      }
    }

    function bindFlavorSelects(){
      modalContent.querySelectorAll('.flavor-select').forEach(sel=>{
        sel.addEventListener('change', ()=>{
          selectedFlavors = [];
          modalContent.querySelectorAll('.flavor-select').forEach(s=>{
            if(s.value){ const pf=allPizzas.find(p=>p.id===s.value); if(pf) selectedFlavors.push(pf); }
          });
          updateModalTotal();
        });
      });
    }

    // Bordas
    modalContent.querySelectorAll('.crust-option').forEach(option => {
      option.addEventListener('click', () => {
        modalContent.querySelectorAll('.crust-option').forEach(o => { o.classList.remove('selected'); const radio=o.querySelector('input'); if(radio) radio.checked=false; });
        option.classList.add('selected'); const radio=option.querySelector('input'); if(radio) radio.checked=true;
        const crustId = option.dataset.crustId;
        selectedCrust = crustGroup.options.find(o => o.id === crustId) || null;
        updateModalTotal();
      });
    });

    // Extras
    modalContent.querySelectorAll('.extra-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        if (checkbox.checked) option.classList.add('selected'); else option.classList.remove('selected');
        const extraId = option.dataset.extraId;
        const extraOpt = extraGroup.options.find(o => o.id === extraId);
        if (checkbox.checked && extraOpt) { if (!selectedExtras.some(ee=>ee.id===extraId)) selectedExtras.push(extraOpt); }
        else { selectedExtras = selectedExtras.filter(ee=> ee.id !== extraId); }
        updateModalTotal();
      });
    });

    btnMinus.addEventListener('click', () => { if (quantity > 1) { quantity--; qtyDisplay.textContent = quantity; updateModalTotal(); } });
    btnPlus.addEventListener('click', () => { quantity++; qtyDisplay.textContent = quantity; updateModalTotal(); });

    function calculateUnitPrice() {
      let base = getPriceForProductSize(product, selectedSize);
      if (selectedFlavors.length) {
        let maxPrice = base;
        selectedFlavors.forEach(f=>{ const pr=getPriceForProductSize(f, selectedSize); if(pr>maxPrice) maxPrice=pr; });
        base = maxPrice;
      }
      let unit = base;
      if (!usePizzaSizes && selectedSize && typeof selectedSize.price_diff === 'number') unit += selectedSize.price_diff;
      if (selectedCrust && selectedCrust.price) unit += Number(selectedCrust.price);
      if (selectedExtras && selectedExtras.length) selectedExtras.forEach(extra=> unit += Number(extra.price||0));
      return unit;
    }

    function updateModalTotal() {
      const unit = calculateUnitPrice();
      const total = unit * quantity;
      priceDisplay.textContent = cs ? cs.formatCurrency(total) : 'R$ ' + total;
    }

    const btnAdd = modalContent.querySelector('#btnConfirmAddToCart');
    btnAdd.addEventListener('click', () => {
      if (selectedFlavors.length && selectedFlavors.some(f=>!f)) { alert('Selecione os sabores corretamente.'); return; }
      observation = obsInput ? obsInput.value : '';
      // Normaliza para orderService (primeiro sabor extra como secondFlavor para compatibilidade)
      const secondFlavor = selectedFlavors[0] || null;
      window.appState.addItem({
        product,
        size: selectedSize,
        secondFlavor: secondFlavor,
        quantity, crust: selectedCrust, extras: selectedExtras, observation,
        _allFlavors: selectedFlavors // para futuro 3-4 sabores
      });
      // Se tiver 3-4 sabores, adiciona observação
      if (selectedFlavors.length > 1) {
        const extraNames = selectedFlavors.slice(1).map(f=> f.name).join(', ');
        // já está em secondFlavor, extras sabores vão como observação
      }
      closeModal();
    });
  }

  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

  return { openModal, closeModal };
}

window.setupProductModal = setupProductModal;
