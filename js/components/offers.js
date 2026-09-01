/**
 * Componente: Ofertas / Combos por regras (Motor de Ofertas)
 * Mostra vitrine de combos e modal de montagem por grupos
 */

function formatCurrencyOffer(v){
  const cs = window.customerService;
  return cs ? cs.formatCurrency(v) : 'R$ ' + Number(v||0).toFixed(2).replace('.',',');
}

function getActiveOffersForDisplay(){
  const storage = window.storage;
  const state = window.appState;
  let offers = [];
  if(storage?.getActiveOffers) offers = storage.getActiveOffers(new Date());
  else if(storage?.getOffers) offers = storage.getOffers().filter(o=>o.active!==false);
  else if(state?.offers) offers = state.offers;
  // filtra ativo já feito em getActiveOffers, mas garante
  return offers || [];
}

function renderOffersSection(container){
  if(!container) return;
  const offers = getActiveOffersForDisplay();
  if(!offers.length){
    container.style.display='none';
    container.innerHTML='';
    return;
  }
  container.style.display='block';
  container.innerHTML = `
    <div style="margin-bottom:1.25rem;">
      <h2 style="font-size:1.15rem; font-weight:800; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">🎁 Promoções e Combos</h2>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap:0.75rem;">
        ${offers.map(off=>{
          const groupsTxt = (off.groups||[]).map(g=>`${g.name} x${g.quantity}`).join(' + ') || 'Monte seu combo';
          const sched = (off.schedules||[]);
          const schedBadge = !sched.length ? '<span style="font-size:0.68rem; background:rgba(16,185,129,0.15); color:#10b981; padding:0.15rem 0.4rem; border-radius:999px;">Sempre</span>' : `<span style="font-size:0.68rem; background:rgba(255,184,0,0.15); color:#b45309; padding:0.15rem 0.4rem; border-radius:999px;">${sched.map(s=>`${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][s.weekday]} ${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`).join(', ')}</span>`;
          return `
            <div class="product-card" data-offer-id="${off.id}" style="border:1px solid rgba(255,184,0,0.35); background: linear-gradient(135deg, rgba(255,184,0,0.08), transparent); cursor:pointer;">
              <div class="product-card-body">
                <div style="display:flex; justify-content:space-between; align-items:start; gap:0.5rem;">
                  <div>
                    <h3 class="product-title" style="font-size:0.98rem;">${off.name}</h3>
                    <p class="product-description" style="font-size:0.78rem; color:var(--text-secondary);">${off.description|| groupsTxt}</p>
                    <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;">${groupsTxt}</div>
                    <div style="margin-top:0.35rem;">${schedBadge}</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-weight:800; color:var(--primary); font-size:1.05rem;">${formatCurrencyOffer(off.price)}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">preço fechado</div>
                  </div>
                </div>
                <div style="margin-top:0.6rem;">
                  <button class="btn btn-primary btn-sm btn-open-offer" data-offer-id="${off.id}" style="width:100%;">🎁 Montar Combo</button>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
  container.querySelectorAll('.btn-open-offer, .product-card[data-offer-id]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = el.dataset.offerId || el.closest('[data-offer-id]')?.dataset.offerId;
      if(id) openOfferSelectionModal(id);
    });
  });
}

// Modal de seleção
let currentOfferModal = null;
function openOfferSelectionModal(offerId){
  const offers = getActiveOffersForDisplay();
  const offer = offers.find(o=> String(o.id)===String(offerId));
  if(!offer){ alert('Oferta não encontrada'); return; }
  // garante groups com items
  const groups = offer.groups || [];
  if(!groups.length){ alert('Oferta sem grupos configurados'); return; }

  // cria backdrop se não existe
  let backdrop = document.getElementById('offerSelectionBackdrop');
  if(!backdrop){
    backdrop = document.createElement('div');
    backdrop.id='offerSelectionBackdrop';
    backdrop.className='modal-backdrop';
    backdrop.innerHTML=`<div id="offerSelectionContent" class="modal-sheet" style="max-width:620px; max-height:90vh; overflow:auto;"></div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (e)=>{ if(e.target===backdrop) closeOfferSelectionModal(); });
  }
  const content = document.getElementById('offerSelectionContent');
  const cs = window.customerService;
  // estado de seleção: Map groupId -> Set productIds
  const selections = new Map();
  groups.forEach(g=> selections.set(g.id, new Set()));

  function productById(pid){
    return window.appState?.products?.find(p=> String(p.id)===String(pid)) || null;
  }
  function extraFor(group, pid){
    const item = (group.offer_group_items||[]).find(it=> String(it.product_id)===String(pid));
    return Number(item?.extra_price||0);
  }

  function renderModal(){
    let totalExtra = 0;
    let allValid = true;
    const groupsHtml = groups.map(g=>{
      const sel = selections.get(g.id);
      const need = Number(g.quantity||1);
      const chosen = sel.size;
      const isValid = chosen===need;
      if(!isValid) allValid=false;
      // calcula extra deste grupo
      let grpExtra=0;
      sel.forEach(pid=> grpExtra+= extraFor(g,pid));
      totalExtra+= grpExtra;
      const items = g.offer_group_items||[];
      return `
        <div style="background:var(--bg-input); border:1px solid ${isValid?'rgba(16,185,129,0.35)':'var(--border)'}; border-radius:var(--radius-md); padding:0.75rem; margin-bottom:0.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <div style="font-weight:800; font-size:0.92rem;">${g.name}</div>
            <div style="font-size:0.78rem; font-weight:700; color:${isValid?'#10b981':'#ef4444'};">${chosen}/${need} ${isValid?'✓':''}</div>
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:0.5rem;">Escolha exatamente ${need} ${need>1?'itens':'item'}</div>
          <div style="display:flex; flex-direction:column; gap:0.35rem;">
            ${items.map(it=>{
              const pid = it.product_id;
              const prod = productById(pid) || it.products || { name: pid.slice(0,8), base_price:0 };
              const name = prod.name || it.products?.name || 'Produto';
              const base = Number(prod.base_price|| prod.price||0);
              const extra = Number(it.extra_price||0);
              const isChecked = sel.has(String(pid));
              return `
                <label style="display:flex; align-items:center; gap:0.6rem; background:var(--bg-card); border:1px solid ${isChecked?'var(--primary)':'var(--border)'}; border-radius:var(--radius-sm); padding:0.5rem 0.65rem; cursor:pointer;">
                  <input type="checkbox" data-group="${g.id}" data-product="${pid}" ${isChecked?'checked':''} style="width:auto;" />
                  <div style="flex:1;">
                    <div style="font-weight:600; font-size:0.85rem;">${name} ${extra>0?`<span style="color:var(--primary); font-size:0.75rem;">+${formatCurrencyOffer(extra)}</span>`:''}</div>
                    ${base?`<div style="font-size:0.72rem; color:var(--text-muted);">avulso ${formatCurrencyOffer(base)}</div>`:''}
                  </div>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    const finalPrice = Number(offer.price||0) + totalExtra;
    content.innerHTML=`
      <div class="modal-header">
        <div class="modal-title">🎁 ${offer.name} — ${formatCurrencyOffer(offer.price)}${totalExtra>0?` + ${formatCurrencyOffer(totalExtra)} extras`:''} = <span style="color:var(--primary);">${formatCurrencyOffer(finalPrice)}</span></div>
        <button class="modal-close-btn" id="btnCloseOfferSelection">✕</button>
      </div>
      <div class="modal-body">
        ${offer.description?`<p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.75rem;">${offer.description}</p>`:''}
        ${groupsHtml}
        <div style="margin-top:0.75rem; padding:0.65rem; background:${allValid?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)'}; border:1px solid ${allValid?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.25)'}; border-radius:var(--radius-md); font-size:0.82rem; text-align:center; font-weight:700; color:${allValid?'#10b981':'#ef4444'};">
          ${allValid?'✅ Combo completo — pode adicionar ao pedido':'Selecione exatamente a quantidade de cada grupo'}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="btnCancelOfferSelection">Cancelar</button>
        <button class="btn btn-primary" id="btnAddOfferToCart" ${allValid?'':'disabled style="opacity:0.5; pointer-events:none;"'}>Adicionar por ${formatCurrencyOffer(finalPrice)} →</button>
      </div>
    `;
    content.querySelector('#btnCloseOfferSelection')?.addEventListener('click', closeOfferSelectionModal);
    content.querySelector('#btnCancelOfferSelection')?.addEventListener('click', closeOfferSelectionModal);
    content.querySelector('#btnAddOfferToCart')?.addEventListener('click', ()=>{
      // coleta seleções validadas
      const groupsPayload = groups.map(g=>{
        const sel = Array.from(selections.get(g.id)||[]);
        const items = sel.map(pid=>{
          const prod = productById(pid) || { id: pid, name: pid };
          const extra = extraFor(g, pid);
          return { product_id: pid, name: prod.name, price: Number(prod.base_price||prod.price||0), extra_price: extra };
        });
        return { groupId: g.id, groupName: g.name, quantity: Number(g.quantity), items };
      });
      const total = Number(offer.price) + totalExtra;
      // adiciona ao carrinho via appState
      if(window.appState?.addOffer){
        window.appState.addOffer({ offer, groups: groupsPayload, total });
      } else {
        // fallback cria item manual
        window.appState.addItem({ product: { id: offer.id, name: offer.name, price: offer.price }, quantity:1 });
      }
      closeOfferSelectionModal();
      // feedback
      if(window.showToast) window.showToast('🎁 Combo adicionado!', 'success');
      // abre carrinho
      window.dispatchEvent(new CustomEvent('open_cart'));
    });
    // bind checkboxes com validação de limite
    content.querySelectorAll('input[type="checkbox"][data-group]').forEach(cb=>{
      cb.addEventListener('change', (e)=>{
        const gid = e.target.dataset.group;
        const pid = String(e.target.dataset.product);
        const set = selections.get(gid);
        const group = groups.find(g=> String(g.id)===String(gid));
        const need = Number(group?.quantity||1);
        if(e.target.checked){
          if(set.size >= need){
            e.target.checked=false;
            if(window.showToast) window.showToast(`Escolha apenas ${need} neste grupo`, 'info');
            return;
          }
          set.add(pid);
        } else {
          set.delete(pid);
        }
        renderModal();
      });
    });
  }

  renderModal();
  backdrop.classList.add('active');
  document.body.style.overflow='hidden';
  currentOfferModal = { offerId, backdrop };
}
function closeOfferSelectionModal(){
  const backdrop=document.getElementById('offerSelectionBackdrop');
  if(backdrop) backdrop.classList.remove('active');
  document.body.style.overflow='';
  currentOfferModal=null;
}

window.renderOffersSection = renderOffersSection;
window.openOfferSelectionModal = openOfferSelectionModal;
window.closeOfferSelectionModal = closeOfferSelectionModal;
