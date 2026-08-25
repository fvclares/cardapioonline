/**
 * Componente: Barra de Navegação por Categorias e Busca
 * Compatível com file:// e http://
 */

function renderCategoryNav(container, onSearch) {
  const categories = (window.appState.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  container.innerHTML = `
    <div class="sticky-nav-container">
      <div class="container">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="menuSearchInput" placeholder="Buscar pizza, sabor, bebida, sobremesa..." />
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

  const searchInput = container.querySelector('#menuSearchInput');
  if (searchInput && onSearch) {
    searchInput.addEventListener('input', (e) => {
      onSearch(e.target.value.trim().toLowerCase());
    });
  }

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
