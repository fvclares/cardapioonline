/**
 * Componente: Modal de Personalização e Adição de Produto à Sacola
 * Suporta: Tamanhos definidos pela loja (P/M/G) com preço por pizza/tamanho e divisão em até 4 sabores
 */

function setupProductModal() {
  const modalBackdrop = document.getElementById('productModalBackdrop');
  const modalContent = document.getElementById('productModalContent');

  let currentProduct = null;
  let selectedSize = null;
  let selectedFlavors = []; // adicionais além do principal (fluxo combinado antigo)
  let selectedFraction = { label:'Inteira', value:1, numerator:1, denominator:1 };
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

  function getFractionOptionsForSize(size){
    if(!size || !size.max_flavors || size.max_flavors<=1) return [{ label:'Inteira', value:1, numerator:1, denominator:1 }];
    const max=size.max_flavors;
    if(max===2) return [
      { label:'Inteira', value:1, numerator:1, denominator:1 },
      { label:'Meia (½)', value:0.5, numerator:1, denominator:2 }
    ];
    if(max===3) return [
      { label:'Inteira', value:1, numerator:1, denominator:1 },
      { label:'Meia (½)', value:0.5, numerator:1, denominator:2 },
      { label:'1/3', value:1/3, numerator:1, denominator:3 }
    ];
    return [
      { label:'Inteira', value:1, numerator:1, denominator:1 },
      { label:'Meia (½)', value:0.5, numerator:1, denominator:2 },
      { label:'1/4 (¼)', value:0.25, numerator:1, denominator:4 }
    ];
  }
  function buildFractionOptionsHtml(size){
    const opts=getFractionOptionsForSize(size);
    return opts.map((o,idx)=>`
      <div class="addon-option fraction-option ${idx===0?'selected':''}" data-fraction-value="${o.value}" data-fraction-label="${o.label}" data-num="${o.numerator}" data-den="${o.denominator}">
        <div class="addon-option-info">
          <input type="radio" name="fraction" value="${o.value}" ${idx===0?'checked':''} style="width:auto;" />
          <span style="font-size:0.88rem; font-weight:600;">${o.label}</span>
        </div>
        <span class="addon-option-price" style="font-size:0.78rem; color:var(--text-muted);">${o.value===1?'pizza completa': o.value===0.5?'metade da pizza': o.label}</span>
      </div>
    `).join('');
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
    selectedFraction = { label:'Inteira', value:1, numerator:1, denominator:1 };
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

        <!-- Fração (novo fluxo ½) -->
        ${product.is_pizza ? `
          <div class="addon-group" id="fractionGroup">
            <div class="addon-group-header">
              <span class="addon-group-title">🍕 Como deseja sua pizza?</span>
              <span style="font-size:0.70rem; color:var(--text-muted); border:1px solid var(--border); padding:0.15rem 0.4rem; border-radius:999px;">${selectedSize ? selectedSize.name.split('(')[0].trim() : ''}</span>
            </div>
            <div class="addon-options-list" id="fractionOptionsList">
              ${buildFractionOptionsHtml(selectedSize)}
            </div>
            <div id="fractionHelp" style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.6rem 0.75rem; display:none;"></div>
          </div>
        ` : ''}

        <!-- Divisão em sabores (fluxo combinado - só quando Inteira) -->
        ${product.is_pizza && usePizzaSizes ? `
          <div class="addon-group" id="flavorsGroup" style="${(selectedSize?.max_flavors||1) > 1 && selectedFraction.value===1 ? 'display:block;' : 'display:none;'}">
            <div class="addon-group-header">
              <span class="addon-group-title">🍕 Combinar sabores agora</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">até ${selectedSize?.max_flavors||1} sabores • opcional</span>
            </div>
            <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.5rem;">Ou use "Meia (½)" acima para adicionar ½ no carrinho e escolher outra ½ depois. Validação ao fechar garante pizzas completas do mesmo tamanho.</p>
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
    let html = '<p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">Selecione os sabores adicionais (ingredientes visíveis):</p>';
    for (let i=1; i < size.max_flavors; i++) {
      html += `
        <div style="margin-bottom:0.75rem; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.6rem 0.6rem 0.5rem;">
          <label class="form-label" style="font-size:0.8rem; margin-bottom:0.3rem; display:flex; justify-content:space-between;"><span>${i+1}º sabor:</span><span style="color:var(--text-muted); font-weight:400; font-size:0.70rem;">toque para ver ingredientes</span></label>
          <select class="flavor-select" data-index="${i}" style="width:100%;">
            <option value="">-- não dividir --</option>
            ${allPizzas.map(p => {
              const descShort = (p.description||'').substring(0,80);
              return `<option value="${p.id}" title="${(p.description||'').replace(/"/g,'&quot;')}">${p.name} (${cs ? cs.formatCurrency(getPriceForProductSize(p, size)) : 'R$ '+getPriceForProductSize(p, size)}) — ${descShort}</option>`;
            }).join('')}
          </select>
          <div class="flavor-desc" data-desc-for="${i}" style="font-size:0.72rem; color:var(--text-muted); margin-top:0.35rem; line-height:1.25; min-height:1.0em;"></div>
        </div>
      `;
    }
    html += '<div style="font-size:0.75rem; color:var(--secondary); margin-top:0.3rem; background:rgba(255,184,0,0.08); border:1px solid rgba(255,184,0,0.18); border-radius:var(--radius-sm); padding:0.5rem 0.6rem;">ℹ️ Ao combinar agora, o valor será o <strong>maior preço</strong> entre os sabores. Ou use <strong>Meia (½)</strong> acima para adicionar ½ no carrinho e escolher outra ½ depois — validação ao fechar pedido garante pizzas completas do mesmo tamanho.</div>';
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

    function updateFractionUI(){
      const grp = modalContent.querySelector('#flavorsGroup');
      const help = modalContent.querySelector('#fractionHelp');
      const isFraction = selectedFraction && selectedFraction.value < 1;
      if(grp){
        if(isFraction) grp.style.display='none';
        else grp.style.display = (selectedSize?.max_flavors||1) > 1 ? 'block' : 'none';
      }
      if(help){
        if(isFraction){
          const sizeLabel = selectedSize ? selectedSize.name.split('(')[0].trim() : '';
          const price = getPriceForProductSize(product, selectedSize);
          help.style.display='block';
          help.innerHTML = `Você vai adicionar <strong>${selectedFraction.label} ${product.name.replace('Pizza ','')}</strong> ${sizeLabel?`[${sizeLabel}]`:''} por <strong>${cs?cs.formatCurrency(price):'R$ '+price}</strong>.<br> No carrinho ficará como <strong>${selectedFraction.label}</strong> — complete com outra <strong>${selectedFraction.label}</strong> do mesmo tamanho. Validação ao fechar pedido garante pizzas completas.`;
          help.style.borderColor='rgba(37,211,102,0.35)';
          help.style.background='rgba(37,211,102,0.08)';
          help.style.color='var(--text-primary)';
        } else {
          help.style.display='none';
        }
      }
      // atualiza botão texto
      const btnAdd = modalContent.querySelector('#btnConfirmAddToCart');
      if(btnAdd){
        const span = btnAdd.querySelector('span');
        if(span) span.textContent = isFraction ? `Adicionar ${selectedFraction.label}` : 'Adicionar';
      }
    }

    // Fração - novo fluxo ½
    modalContent.querySelectorAll('.fraction-option').forEach(option=>{
      option.addEventListener('click', ()=>{
        modalContent.querySelectorAll('.fraction-option').forEach(o=>{ o.classList.remove('selected'); const r=o.querySelector('input'); if(r) r.checked=false; });
        option.classList.add('selected'); const r=option.querySelector('input'); if(r) r.checked=true;
        const val=parseFloat(option.dataset.fractionValue);
        const label=option.dataset.fractionLabel;
        const num=parseInt(option.dataset.num||'1',10);
        const den=parseInt(option.dataset.den||'1',10);
        selectedFraction={ label, value:val, numerator:num, denominator:den };
        // se for fração, limpa sabores combinados
        if(val<1) selectedFlavors=[];
        updateFractionUI();
        updateModalTotal();
      });
    });
    updateFractionUI();

    // Tamanhos pizza nova
    if (usePizzaSizes) {
      modalContent.querySelectorAll('.size-option').forEach(option => {
        option.addEventListener('click', () => {
          modalContent.querySelectorAll('.size-option').forEach(o=>{ o.classList.remove('selected'); const r=o.querySelector('input'); if(r) r.checked=false; });
          option.classList.add('selected'); const r=option.querySelector('input'); if(r) r.checked=true;
          const sizeId = option.dataset.sizeId;
          selectedSize = pizzaSizes.find(s=> s.id===sizeId) || null;
          selectedFlavors = [];
          // rebuild fraction options for new size
          const fracList = modalContent.querySelector('#fractionOptionsList');
          if(fracList){
            fracList.innerHTML = buildFractionOptionsHtml(selectedSize);
            // rebind
            fracList.querySelectorAll('.fraction-option').forEach(opt=>{
              opt.addEventListener('click', ()=>{
                modalContent.querySelectorAll('.fraction-option').forEach(o=>{ o.classList.remove('selected'); const r2=o.querySelector('input'); if(r2) r2.checked=false; });
                opt.classList.add('selected'); const r2=opt.querySelector('input'); if(r2) r2.checked=true;
                const v=parseFloat(opt.dataset.fractionValue);
                const lb=opt.dataset.fractionLabel;
                const nn=parseInt(opt.dataset.num||'1',10);
                const dd=parseInt(opt.dataset.den||'1',10);
                selectedFraction={ label:lb, value:v, numerator:nn, denominator:dd };
                if(v<1) selectedFlavors=[];
                updateFractionUI();
                updateModalTotal();
              });
            });
            selectedFraction={ label:'Inteira', value:1, numerator:1, denominator:1 };
            updateFractionUI();
          }
          // rebuild flavor selectors
          const cont = modalContent.querySelector('#flavorsSelectors');
          const grp = modalContent.querySelector('#flavorsGroup');
          if (cont && grp) {
            cont.innerHTML = buildFlavorSelectors(selectedSize, allPizzas, cs);
            grp.style.display = (selectedSize?.max_flavors||1) > 1 && selectedFraction.value===1 ? 'block' : 'none';
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
        const updateDesc = ()=>{
          const descEl = modalContent.querySelector(`.flavor-desc[data-desc-for="${sel.dataset.index}"]`);
          if(descEl){
            const pf = allPizzas.find(p=>p.id===sel.value);
            descEl.textContent = pf ? (pf.description||'') : '';
            descEl.style.color = pf ? 'var(--text-secondary)' : 'var(--text-muted)';
          }
        };
        sel.addEventListener('change', ()=>{
          selectedFlavors = [];
          modalContent.querySelectorAll('.flavor-select').forEach(s=>{
            if(s.value){ const pf=allPizzas.find(p=>p.id===s.value); if(pf) selectedFlavors.push(pf); }
          });
          updateDesc();
          // atualiza todos descs
          modalContent.querySelectorAll('.flavor-select').forEach(s=>{
            const dEl = modalContent.querySelector(`.flavor-desc[data-desc-for="${s.dataset.index}"]`);
            if(dEl){
              const pf2 = allPizzas.find(p=>p.id===s.value);
              dEl.textContent = pf2 ? (pf2.description||'') : (s.value?'':'' );
            }
          });
          updateModalTotal();
        });
        // inicializa desc
        updateDesc();
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
      // Se for fração <1, preço é o da pizza inteira (max será calculado no carrinho)
      if(selectedFraction && selectedFraction.value < 1){
        let base = getPriceForProductSize(product, selectedSize);
        let unit = base;
        if (!usePizzaSizes && selectedSize && typeof selectedSize.price_diff === 'number') unit += selectedSize.price_diff;
        if (selectedCrust && selectedCrust.price) unit += Number(selectedCrust.price);
        if (selectedExtras && selectedExtras.length) selectedExtras.forEach(extra=> unit += Number(extra.price||0));
        return unit;
      }
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
      // Para fração, mostra preço da pizza completa como referência, e total proporcional
      let total;
      let label='';
      if(selectedFraction && selectedFraction.value < 1){
        const effectiveQty = quantity * selectedFraction.value;
        // ex: 1 meia = 0.5 pizza, 2 meias =1 pizza
        total = unit * Math.ceil(effectiveQty); // arredonda para cima para estimativa de pizzas completas
        label = ` (${quantity}× ${selectedFraction.label} ≈ ${effectiveQty.toFixed(2).replace('.',',')} pizza)`;
        // mostra também proporcional para transparência
        // atualiza help
        const help = modalContent.querySelector('#fractionHelp');
        if(help && selectedFraction.value<1){
          help.innerHTML = `Você vai adicionar <strong>${selectedFraction.label} ${product.name.replace('Pizza ','')}</strong> ${selectedSize?`[${selectedSize.name.split('(')[0].trim()}]`:''} — <strong>${cs?cs.formatCurrency(unit):'R$ '+unit}</strong> é o valor da pizza inteira (maior sabor). No carrinho ficará como <strong>${selectedFraction.label}</strong> — complete com outra <strong>${selectedFraction.label}</strong> do mesmo tamanho. ${label}`;
        }
      } else {
        total = unit * quantity;
      }
      priceDisplay.textContent = cs ? cs.formatCurrency(total) : 'R$ ' + total;
      // também atualiza tooltip do botão
      const btnAdd = modalContent.querySelector('#btnConfirmAddToCart');
      if(btnAdd && selectedFraction && selectedFraction.value<1){
        btnAdd.title = `Adicionará ${quantity} × ${selectedFraction.label} (total ${ (quantity*selectedFraction.value).toFixed(2)} pizza)`;
      }
    }
    // inicializa total
    updateModalTotal();

    const btnAdd = modalContent.querySelector('#btnConfirmAddToCart');
    btnAdd.addEventListener('click', () => {
      observation = obsInput ? obsInput.value : '';
      // Fluxo fracionado
      if(selectedFraction && selectedFraction.value < 1){
        // Fração meia/quarter
        window.appState.addItem({
          product,
          size: selectedSize,
          quantity, crust: selectedCrust, extras: selectedExtras, observation,
          fraction: selectedFraction
        });
        if(window.showToast) window.showToast(`✅ ${selectedFraction.label} ${product.name} [${selectedSize?selectedSize.name.split('(')[0].trim():''}] adicionada! Complete no carrinho.`, 'success');
        closeModal();
        // abre carrinho para feedback
        setTimeout(()=> window.dispatchEvent(new CustomEvent('open_cart')), 300);
        return;
      }
      // Fluxo combinado antigo
      if (selectedFlavors.length && selectedFlavors.some(f=>!f)) { alert('Selecione os sabores corretamente.'); return; }
      const secondFlavor = selectedFlavors[0] || null;
      window.appState.addItem({
        product,
        size: selectedSize,
        secondFlavor: secondFlavor,
        quantity, crust: selectedCrust, extras: selectedExtras, observation,
        _allFlavors: selectedFlavors
      });
      closeModal();
    });
  }

  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

  return { openModal, closeModal };
}

window.setupProductModal = setupProductModal;
