/**
 * Componente: Renderização dos Produtos e Seções do Cardápio
 * Compatível com file:// e http://
 */

function getDisplayPrice(product){
  if (!product.is_pizza) return Number(product.price||0);
  const sizes = window.appState?.pizzaSizes || window.storage?.getPizzaSizes?.() || [];
  if (!sizes.length) return Number(product.price||0);
  const prices = window.appState?.productSizePrices || window.storage?.getProductSizePrices?.(product.id) || [];
  const myPrices = Array.isArray(prices) ? prices.filter(p=> p.product_id===product.id) : [];
  if (myPrices.length) return Math.min(...myPrices.map(p=>Number(p.price)));
  return Number(product.price||0);
}
function getSizePrices(product){
  if (!product.is_pizza) return [];
  const sizes = (window.appState?.pizzaSizes || window.storage?.getPizzaSizes?.() || []).filter(s=>s.is_active!==false).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
  if (!sizes.length) return [];
  const allPrices = window.appState?.productSizePrices || [];
  return sizes.map(s=>{
    const found = allPrices.find(p=> p.product_id===product.id && p.size_id===s.id);
    return found ? { size: s, price: Number(found.price) } : null;
  }).filter(Boolean);
}
function renderProductSections(container, searchQuery = '', onSelectProduct) {
  const categories = (window.appState.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const products = (window.appState.products || []).filter(p => p.available !== false).slice().sort((a,b)=> (a.codigo||9999)-(b.codigo||9999) || (a.order||0)-(b.order||0));
  const cs = window.customerService;

  let filteredProducts = products;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      String(p.codigo||'').includes(q)
    );
  }

  if (filteredProducts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🔍</div>
        <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-secondary);">Nenhum produto encontrado para "${searchQuery}"</p>
        <p style="font-size: 0.9rem; margin-top: 0.25rem;">Tente buscar por outro termo ou navegue pelas categorias acima.</p>
      </div>
    `;
    return;
  }

  const sectionsHtml = categories.map(cat => {
    const catProducts = filteredProducts.filter(p => p.category_id === cat.id);
    if (catProducts.length === 0) return '';

    return `
      <section class="category-section" id="section_${cat.id}">
        <h2 class="category-section-title">${cat.name}</h2>
        <div class="products-grid">
          ${catProducts.map(product => `
            <div class="product-card" data-product-id="${product.id}">
              <div class="product-card-body">
                <div>
                  <h3 class="product-title">${product.codigo ? `<span style="color:var(--primary); font-weight:800;">#${String(product.codigo).padStart(3,'0')}</span> ` : ''}${product.name}</h3>
                  <p class="product-description">${product.description || ''}</p>
                </div>
                <div class="product-price-bar">
                  <div style="flex:1;">
                    ${(()=>{
                      const sps=getSizePrices(product);
                      if(sps.length){
                        return `<div style="display:flex; flex-wrap:wrap; gap:0.35rem;">${sps.map(sp=>`<span style="background:var(--bg-input); border:1px solid var(--border); border-radius:999px; padding:0.15rem 0.5rem; font-size:0.75rem; font-weight:700;">${sp.size.name} ${cs?cs.formatCurrency(sp.price):'R$ '+sp.price}</span>`).join('')}</div>`;
                      } else {
                        return `<span class="product-price">${cs ? cs.formatCurrency(getDisplayPrice(product)) : 'R$ ' + getDisplayPrice(product)}</span>`;
                      }
                    })()}
                  </div>
                  <button class="btn-add-circle" title="Adicionar à sacola">+</button>
                </div>
              </div>
              ${product.image ? `<div class="product-image-container"><img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy" /></div>` : ''}
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');

  container.innerHTML = sectionsHtml;

  // Bind click nos cards de produto
  container.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const productId = card.dataset.productId;
      const product = window.appState.products.find(p => p.id === productId);
      if (product && onSelectProduct) {
        onSelectProduct(product);
      }
    });
  });
}

window.renderProductSections = renderProductSections;
