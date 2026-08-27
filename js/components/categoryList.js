/**
 * Componente: Barra de Navegação por Categorias e Busca
 * Compatível com file:// e http://
 */

function renderCategoryNav(container, onSearch) {
  const categories = (window.appState.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const pizzaSizes = (window.appState.pizzaSizes || window.storage?.getPizzaSizes?.() || []).filter(s=>s.is_active!==false).sort((a,b)=>(a.display_order||0)-(b.display_order||0));

  container.innerHTML = `
    <div class="sticky-nav-container">
      <div class="container">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="menuSearchInput" placeholder="Buscar pizza, sabor, bebida, sobremesa..." />
        </div>
        <div style="display:flex; flex-direction:column; gap:0.6rem; margin-top:0.6rem;">
          <select id="sizeFilterSelect" style="width:100%; padding:0.6rem; border-radius:var(--radius-md); border:1px solid var(--border); background:var(--bg-input); color:var(--text-primary); font-size:0.85rem;">
            <option value="">Todos os tamanhos</option>
            ${pizzaSizes.map(s=>`<option value="${s.id}">${s.name.split('(')[0].trim()}</option>`).join('')}
          </select>
          <div style="background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.5rem 0.6rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; color:var(--text-muted); font-weight:600;">
              <span>Faixa de preço</span>
              <div style="display:flex; gap:0.4rem; align-items:center;">
                <span id="priceRangeLabel">Todos</span>
                <button id="priceClearBtn" style="display:none; font-size:0.65rem; color:var(--primary); background:none; border:none; cursor:pointer;">Limpar</button>
              </div>
            </div>
            <input type="range" id="priceRangeSlider" min="0" max="100" value="0" step="5" style="width:100%; accent-color:var(--primary); margin-top:0.4rem;">
            <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem;">
              <span>R$ 0</span><span>R$ 150</span>
            </div>
          </div>
        </div>

        <nav class="categories-scroll" id="categoriesNav">
          ${categories.map((cat, index) => `
            <button class="category-pill ${index === 0 ? 'active' : ''}" data-cat-id="${cat.id}">
              ${cat.name}
            </button>
          `).join('')}
        </nav>
      </div>
    </div>
  `;

  let priceActive = false;
  function emitFilter(){
    const q = container.querySelector('#menuSearchInput')?.value.trim().toLowerCase() || '';
    const sizeId = container.querySelector('#sizeFilterSelect')?.value || '';
    const slider = container.querySelector('#priceRangeSlider');
    const min = Number(slider?.value || 0);
    const priceRange = priceActive ? `${min}-${min+50}` : '';
    const label = container.querySelector('#priceRangeLabel');
    const clearBtn = container.querySelector('#priceClearBtn');
    if (label) label.textContent = priceRange ? `R$ ${min} – ${min+50}` : 'Todos';
    if (clearBtn) clearBtn.style.display = priceActive ? 'block' : 'none';
    if (onSearch) onSearch({ query: q, sizeId, priceRange });
  }
  const searchInput = container.querySelector('#menuSearchInput');
  if (searchInput && onSearch) searchInput.addEventListener('input', emitFilter);
  const sizeSel = container.querySelector('#sizeFilterSelect');
  if (sizeSel) sizeSel.addEventListener('change', emitFilter);
  const rangeSlider = container.querySelector('#priceRangeSlider');
  if (rangeSlider) rangeSlider.addEventListener('input', ()=>{ priceActive=true; emitFilter(); });
  const clearBtn = container.querySelector('#priceClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', ()=>{ priceActive=false; const s=container.querySelector('#priceRangeSlider'); if(s) s.value=0; emitFilter(); });

  // Smooth scroll ao clicar na categoria
  const pills = container.querySelectorAll('.category-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const catId = pill.dataset.catId;
      const targetSection = document.getElementById(`section_${catId}`);
      if (targetSection) {
        const offset = 120;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = targetSection.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  setupCategoryObserver(categories);
}

function setupCategoryObserver(categories) {
  if (typeof IntersectionObserver === 'undefined') return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const sectionId = entry.target.id.replace('section_', '');
        const pill = document.querySelector(`.category-pill[data-cat-id="${sectionId}"]`);
        if (pill) {
          document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    });
  }, {
    rootMargin: '-100px 0px -60% 0px',
    threshold: 0.1
  });

  categories.forEach(cat => {
    const el = document.getElementById(`section_${cat.id}`);
    if (el) observer.observe(el);
  });
}

window.renderCategoryNav = renderCategoryNav;
