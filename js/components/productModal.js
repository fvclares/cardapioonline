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
    const allExtraGroups = addonGroups.extraGroups || (addonGroups.extras ? [addonGroups.extras] : []);
    // Grupo vale para o produto se não tiver vínculo ou se a categoria do produto estiver vinculada
    const extraGroups = allExtraGroups.filter(g => !g.category_ids?.length || (product.category_id && g.category_ids.includes(product.category_id)));
    const cs = window.customerService;
    const pizzaSizes = product.is_pizza ? window.pizzaCatalog.sizes(product).map(r=>r.size) : [];
    if(product.is_pizza&&!pizzaSizes.length){
      modalContent.innerHTML=window.safeHTML('<p role="alert">Produto indisponível: preço por tamanho não configurado.</p><button id="closeUnavailableProduct">Fechar</button>');
      modalContent.querySelector('#closeUnavailableProduct').onclick=closeModal;modalBackdrop.classList.add('active');return;
    }
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

    modalContent.innerHTML = window.safeHTML(`
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

        <!-- Extras (um bloco por grupo aplicável à categoria do produto) -->
        ${product.has_extras && extraGroups.length ? extraGroups.map(g => `
          <div class="addon-group" data-extra-group="${g.id}">
            <div class="addon-group-header">
              <span class="addon-group-title">🥓 ${g.title}</span>
              <span class="addon-group-required">${g.type === 'single' ? (g.required ? 'Obrigatório · escolha 1' : 'Escolha 1') : (g.max_free != null ? `Máx ${g.max_free} grátis` : 'Opcional')}</span>
            </div>
            ${g.type !== 'single' && g.max_free != null ? `<p style="font-size:0.75rem; color:var(--text-muted); margin:-0.25rem 0 0.5rem;">Limite de ${g.max_free} item(ns) sem custo neste grupo — itens pagos à parte não contam para o limite.</p>` : ''}
            <div class="addon-options-list">
              ${g.options.map(opt => `
                <div class="addon-option extra-option" data-extra-id="${opt.id}" data-group-id="${g.id}">
                  <div class="addon-option-info">
                    ${g.type === 'single'
                      ? `<input type="radio" name="extra_${g.id}" value="${opt.id}" style="width: auto;" />`
                      : `<input type="checkbox" name="extra_${g.id}" value="${opt.id}" style="width: auto;" />`}
                    <span style="font-size:0.88rem; font-weight:600;">${opt.name}</span>
                  </div>
                  <span style="display:flex; align-items:center; gap:0.5rem;">
                    ${g.type !== 'single' && opt.cumulative !== false ? `<span class="extra-qty" data-qty-for="${opt.id}" style="display:none; align-items:center; gap:0.35rem;">
                      <button type="button" class="btn-qty" data-qty-act="dec" data-qty-id="${opt.id}" data-qty-group="${g.id}" style="width:1.5rem;height:1.5rem;font-size:0.9rem;">−</button>
                      <span class="extra-qty-n" style="min-width:1rem; text-align:center; font-weight:700;">1</span>
                      <button type="button" class="btn-qty" data-qty-act="inc" data-qty-id="${opt.id}" data-qty-group="${g.id}" style="width:1.5rem;height:1.5rem;font-size:0.9rem;">+</button>
                    </span>` : ''}
                    <span class="addon-option-price">+ ${cs ? cs.formatCurrency(opt.price) : opt.price}</span>
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('') : ''}

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
    `);

    bindModalEvents(product, sizeGroup, crustGroup, extraGroups, allPizzas, pizzaSizes, usePizzaSizes);

    modalBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function buildFlavorSelectors(size, allPizzas, cs) {
    allPizzas=allPizzas.filter(p=>Number.isFinite(getPriceForProductSize(p,size)));
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

  function getPriceForProductSize(product,size){
    if(!product.is_pizza)return Number(product.price||product.base_price||0);
    return window.pizzaCatalog.sizes(product).find(r=>r.size.id===size?.id)?.price ?? NaN;
  }

  function closeModal() {
    modalBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  function bindModalEvents(product, sizeGroup, crustGroup, extraGroups, allPizzas, pizzaSizes, usePizzaSizes) {
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

    function normFractionMode(v){
      if(v==='proportional'||v==='proporcional'||v==='average') return 'average';
      if(v==='fixed') return 'fixed';
      return 'max';
    }
    function getProductPricingInfo(prod){
      const raw = prod?.fraction_pricing_mode;
      let mode = normFractionMode(raw);
      let fixed = prod?.fraction_fixed_price!=null ? Number(prod.fraction_fixed_price) : null;
      if(!(fixed>0)) fixed = null;
      if(!raw){
        // fallback global antigo (pré-migration) para não quebrar exibição
        try{
          const s = window.storage?.getSettings?.() || {};
          let m = s.fraction_pricing_mode || s.fractionPricingMode || window.appState?.settings?.fraction_pricing_mode || window.appState?.store?.settings?.fraction_pricing_mode || 'max';
          if(m==='proporcional'||m==='proportional') mode='average';
        }catch{}
      }
      if(mode==='fixed' && !(fixed>0)) mode='max';
      return { mode, fixed };
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
          const info = getProductPricingInfo(product);
          const modeDesc = info.mode==='average'
            ? 'Esta pizza quando dividida: <strong>Média</strong> — cada ½ vale metade do preço (ex: ½ R$68 + ½ R$78 = R$73)'
            : info.mode==='fixed' && info.fixed>0
              ? `Esta pizza quando dividida: <strong>valor específico R$${Number(info.fixed).toFixed(2).replace('.',',')}</strong> — vale para qualquer combinação`
              : 'Esta pizza quando dividida: <strong>Mais cara</strong> — pizza completa vale o sabor mais caro (ex: ½ R$68 + ½ R$78 = R$78)';
          help.style.display='block';
          help.innerHTML = window.safeHTML(`Você vai adicionar <strong>${selectedFraction.label} ${product.name.replace('Pizza ','')}</strong> ${sizeLabel?`[${sizeLabel}]`:''} por <strong>${cs?cs.formatCurrency(price):'R$ '+price}</strong> (pizza inteira).<br> No carrinho ficará como <strong>${selectedFraction.label}</strong> — complete com outra <strong>${selectedFraction.label}</strong> do mesmo tamanho. Validação ao fechar garante pizzas completas.<br><span style="font-size:0.72rem; color:var(--text-muted);">${modeDesc}. Se juntar sabores com regras diferentes, vale: fixo &gt; mais cara &gt; média.</span>`);
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
            fracList.innerHTML = window.safeHTML(buildFractionOptionsHtml(selectedSize));
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
            cont.innerHTML = window.safeHTML(buildFlavorSelectors(selectedSize, allPizzas, cs));
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

    // Extras: um bloco por grupo; single=radio, multiple=checkbox (+stepper se cumulativo).
    // Regras por grupo: max_free conta unidades grátis; item não cumulativo é exclusivo no grupo.
    const MAX_EXTRA_QTY = 10;
    const findGroup = (gid) => extraGroups.find(g => g.id === gid);
    const findOpt = (gid, oid) => findGroup(gid)?.options.find(o => o.id === oid);
    const freeUnitsInGroup = (gid) => selectedExtras
      .filter(e => e.groupId === gid && Number(e.price || 0) === 0)
      .reduce((s, e) => s + Number(e.quantity || 1), 0);
    const exclusiveInGroup = (gid) => selectedExtras.find(e => e.groupId === gid && e.exclusive);
    function setRowDisabled(gid, oid, disabled) {
      const row = modalContent.querySelector(`.extra-option[data-group-id="${gid}"][data-extra-id="${oid}"]`);
      if (!row) return;
      const inp = row.querySelector('input');
      if (inp) inp.disabled = disabled;
      row.style.opacity = disabled ? '0.45' : '';
    }
    function refreshGroupDisabled(gid) {
      const g = findGroup(gid);
      if (!g || g.type === 'single') return;
      const locked = !!exclusiveInGroup(gid);
      g.options.forEach(o => {
        const sel = selectedExtras.some(e => e.groupId === gid && e.id === o.id);
        setRowDisabled(gid, o.id, locked && !sel);
      });
    }
    function qtyBadge(gid, oid) {
      return modalContent.querySelector(`.extra-qty[data-qty-for="${oid}"]`);
    }
    function setQtyBadge(gid, oid, qty) {
      const badge = qtyBadge(gid, oid);
      if (!badge) return;
      badge.style.display = qty > 0 ? 'inline-flex' : 'none';
      const n = badge.querySelector('.extra-qty-n');
      if (n) n.textContent = qty;
    }
    // Radios (grupos single)
    modalContent.querySelectorAll('.extra-option input[type="radio"]').forEach(radio => {
      const row = radio.closest('.extra-option');
      row.addEventListener('click', (e) => {
        if (e.target !== radio && radio.disabled) return;
        const gid = row.dataset.groupId, oid = row.dataset.extraId;
        const g = findGroup(gid), opt = findOpt(gid, oid);
        if (!g || !opt) return;
        if (Number(opt.price || 0) === 0 && g.max_free != null && 1 > g.max_free) {
          if (window.showToast) window.showToast(`Este grupo não permite itens grátis.`, 'error');
          return;
        }
        modalContent.querySelectorAll(`.extra-option[data-group-id="${gid}"]`).forEach(o => {
          o.classList.remove('selected');
          const r = o.querySelector('input'); if (r) r.checked = false;
        });
        radio.checked = true;
        row.classList.add('selected');
        selectedExtras = selectedExtras.filter(ee => ee.groupId !== gid);
        selectedExtras.push({ id: opt.id, name: opt.name, price: Number(opt.price || 0), quantity: 1, groupId: gid, exclusive: opt.cumulative === false });
        updateModalTotal();
      });
    });
    // Checkboxes (grupos multiple)
    modalContent.querySelectorAll('.extra-option input[type="checkbox"]').forEach(checkbox => {
      const row = checkbox.closest('.extra-option');
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-qty-act]')) return;
        if (e.target !== checkbox && checkbox.disabled) return;
        const gid = row.dataset.groupId, oid = row.dataset.extraId;
        const g = findGroup(gid), opt = findOpt(gid, oid);
        if (!g || !opt) return;
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
          const cumulative = opt.cumulative !== false;
          if (!cumulative) {
            // Exclusivo: substitui qualquer outra seleção do grupo
            modalContent.querySelectorAll(`.extra-option[data-group-id="${gid}"]`).forEach(o => {
              if (o === row) return;
              o.classList.remove('selected');
              const c = o.querySelector('input'); if (c) c.checked = false;
            });
            selectedExtras = selectedExtras.filter(ee => ee.groupId !== gid);
            if (Number(opt.price || 0) === 0 && g.max_free != null && 1 > g.max_free) {
              checkbox.checked = false;
              if (window.showToast) window.showToast(`Este grupo não permite itens grátis.`, 'error');
              updateModalTotal();
              return;
            }
            row.classList.add('selected');
            selectedExtras.push({ id: opt.id, name: opt.name, price: Number(opt.price || 0), quantity: 1, groupId: gid, exclusive: true });
          } else {
            if (exclusiveInGroup(gid)) {
              checkbox.checked = false;
              if (window.showToast) window.showToast(`Este grupo já tem um item exclusivo selecionado.`, 'error');
              updateModalTotal();
              return;
            }
            if (Number(opt.price || 0) === 0 && g.max_free != null && freeUnitsInGroup(gid) + 1 > g.max_free) {
              checkbox.checked = false;
              if (window.showToast) window.showToast(`Limite de ${g.max_free} item(ns) grátis neste grupo.`, 'error');
              updateModalTotal();
              return;
            }
            if (!selectedExtras.some(ee => ee.groupId === gid && ee.id === oid)) {
              row.classList.add('selected');
              selectedExtras.push({ id: opt.id, name: opt.name, price: Number(opt.price || 0), quantity: 1, groupId: gid, exclusive: false });
              setQtyBadge(gid, oid, 1);
            }
          }
        } else {
          row.classList.remove('selected');
          selectedExtras = selectedExtras.filter(ee => !(ee.groupId === gid && ee.id === oid));
          setQtyBadge(gid, oid, 0);
        }
        refreshGroupDisabled(gid);
        updateModalTotal();
      });
    });
    // Stepper de quantidade (opções cumulativas)
    modalContent.querySelectorAll('[data-qty-act]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gid = btn.dataset.qtyGroup, oid = btn.dataset.qtyId;
        const g = findGroup(gid), opt = findOpt(gid, oid);
        const entry = selectedExtras.find(ee => ee.groupId === gid && ee.id === oid);
        if (!g || !opt || !entry) return;
        let qty = Number(entry.quantity || 1);
        if (btn.dataset.qtyAct === 'inc') {
          if (qty >= MAX_EXTRA_QTY) return;
          if (Number(opt.price || 0) === 0 && g.max_free != null && freeUnitsInGroup(gid) + 1 > g.max_free) {
            if (window.showToast) window.showToast(`Limite de ${g.max_free} item(ns) grátis neste grupo.`, 'error');
            return;
          }
          qty += 1;
        } else {
          if (qty <= 1) return;
          qty -= 1;
        }
        entry.quantity = qty;
        setQtyBadge(gid, oid, qty);
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
        if (selectedExtras && selectedExtras.length) selectedExtras.forEach(extra=> unit += Number(extra.price||0)*Number(extra.quantity||1));
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
      if (selectedExtras && selectedExtras.length) selectedExtras.forEach(extra=> unit += Number(extra.price||0)*Number(extra.quantity||1));
      return unit;
    }

    function updateModalTotal() {
      const unit = calculateUnitPrice();
      let total;
      if(selectedFraction && selectedFraction.value < 1){
        const mode = getCurrentPricingMode();
        const effectiveQty = quantity * selectedFraction.value;
        if(mode === 'proportional'){
          total = unit * effectiveQty;
        } else {
          total = unit * Math.ceil(effectiveQty);
        }
        // help já é atualizado em updateFractionUI, apenas garante total
      } else {
        total = unit * quantity;
      }
      priceDisplay.textContent = cs ? cs.formatCurrency(total) : 'R$ ' + total;
      const btnAdd = modalContent.querySelector('#btnConfirmAddToCart');
      if(btnAdd && selectedFraction && selectedFraction.value<1){
        btnAdd.title = `Adicionará ${quantity} × ${selectedFraction.label} (total ${ (quantity*selectedFraction.value).toFixed(2)} pizza)`;
      }
    }
    // inicializa total
    updateModalTotal();

    const btnAdd = modalContent.querySelector('#btnConfirmAddToCart');
    btnAdd.addEventListener('click', () => {
      if(product.is_pizza&&(!Number.isFinite(getPriceForProductSize(product,selectedSize))||selectedFlavors.some(f=>!Number.isFinite(getPriceForProductSize(f,selectedSize))))){window.showToast?.('Tamanho indisponível para um dos sabores.','error');return;}
      for (const g of extraGroups) {
        if (g.type === 'single' && g.required && !selectedExtras.some(ee => ee.groupId === g.id)) {
          if (window.showToast) window.showToast(`Escolha uma opção em "${g.title}".`, 'error');
          return;
        }
      }
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
