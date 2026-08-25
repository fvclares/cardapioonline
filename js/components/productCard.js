/**
 * Componente: Renderização dos Produtos e Seções do Cardápio
 * Compatível com file:// e http://
 */

function renderProductSections(container, searchQuery = '', onSelectProduct) {
  const categories = (window.appState.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const products = (window.appState.products || []).filter(p => p.available !== false);
  const cs = window.customerService;

  let filteredProducts = products;
  if (searchQuery) {
    filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery) ||
      (p.description && p.description.toLowerCase().includes(searchQuery))
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
                  <h3 class="product-title">${product.name}</h3>
                  <p class="product-description">${product.description || ''}</p>
                </div>
                <div class="product-price-bar">
                  <div>
                    <span class="product-price-prefix">A partir de</span><br/>
                    <span class="product-price">${cs ? cs.formatCurrency(product.price) : 'R$ ' + product.price}</span>
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
