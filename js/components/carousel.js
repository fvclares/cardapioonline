/**
 * Componente: Carrossel de Promoções (vitrine)
 * Exibe produtos com is_featured=true antes das categorias.
 * Clique abre o mesmo productModal (experiência nativa, sem digitar).
 * Compatível com file:// e http://
 */

function getCarouselProducts(){
  const products = (window.appState?.products || window.storage?.getProducts?.() || []).filter(p=> p.available!==false && p.is_featured);
  return products.sort((a,b)=> (a.featured_order||0)-(b.featured_order||0) || (a.display_order||0)-(b.display_order||0) || (a.order||0)-(b.order||0)).slice(0,5);
}

function getCarouselDisplayPrice(product){
  if (!product.is_pizza) return Number(product.price||product.base_price||0);
  const sizes = window.appState?.pizzaSizes || window.storage?.getPizzaSizes?.() || [];
  const prices = window.appState?.productSizePrices || window.storage?.getProductSizePrices?.(product.id) || [];
  const all = Array.isArray(prices) ? prices.filter(p=> p.product_id===product.id) : [];
  if (all.length) return Math.min(...all.map(p=>Number(p.price)));
  return Number(product.price||product.base_price||0);
}

function renderCarousel(container, onSelectProduct){
  if (!container) return;
  const items = getCarouselProducts();
  if (!items.length){
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  const cs = window.customerService;

  container.innerHTML = `
    <section class="carousel-section">
      <div class="carousel-header">
        <h2 class="carousel-title">⭐ Promoções em Destaque</h2>
        <div class="carousel-dots" id="carouselDots"></div>
      </div>
      <div class="carousel-track-wrap">
        <div class="carousel-track" id="carouselTrack">
          ${items.map(product => {
            const price = getCarouselDisplayPrice(product);
            const hasImage = !!product.image;
            const shortDesc = (product.description||'').slice(0,90);
            return `
            <div class="carousel-card" data-product-id="${product.id}">
              <div class="carousel-card-image-wrap">
                ${hasImage ? `<img src="${product.image}" alt="${product.name}" class="carousel-card-image" loading="lazy" />` : `<div class="carousel-card-placeholder">🍕</div>`}
                <span class="carousel-badge">🔥 OFERTA</span>
              </div>
              <div class="carousel-card-body">
                <h3 class="carousel-card-title" title="${product.name}">${product.name}</h3>
                ${shortDesc ? `<p class="carousel-card-desc">${shortDesc}</p>` : ''}
                <div class="carousel-card-footer">
                  <span class="carousel-card-price">${cs ? cs.formatCurrency(price) : 'R$ '+ price.toFixed(2)}</span>
                  <span class="carousel-card-cta">Ver opções →</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>
  `;

  // Dots
  const track = container.querySelector('#carouselTrack');
  const dotsWrap = container.querySelector('#carouselDots');
  if (dotsWrap && track){
    dotsWrap.innerHTML = items.map((_,i)=> `<span class="carousel-dot ${i===0?'active':''}" data-index="${i}"></span>`).join('');
    const dots = dotsWrap.querySelectorAll('.carousel-dot');
    const cards = track.querySelectorAll('.carousel-card');

    function updateDots(){
      const scrollLeft = track.scrollLeft;
      const cardWidth = cards[0]?.offsetWidth + 12 || 280;
      const idx = Math.round(scrollLeft / cardWidth);
      dots.forEach((d,i)=> d.classList.toggle('active', i===idx));
    }
    track.addEventListener('scroll', updateDots, { passive: true });
    dots.forEach(d=> d.addEventListener('click', ()=>{
      const idx = Number(d.dataset.index);
      const cardWidth = cards[0]?.offsetWidth + 12 || 280;
      track.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
    }));

    // Autoplay leve (pausa no hover/touch)
    let autoplay = setInterval(()=>{
      const maxScroll = track.scrollWidth - track.clientWidth;
      const cardWidth = cards[0]?.offsetWidth + 12 || 280;
      const next = track.scrollLeft + cardWidth;
      if (next > maxScroll + 5) track.scrollTo({ left: 0, behavior: 'smooth' });
      else track.scrollTo({ left: next, behavior: 'smooth' });
    }, 4000);
    track.addEventListener('mouseenter', ()=> { clearInterval(autoplay); });
    track.addEventListener('mouseleave', ()=>{
      autoplay = setInterval(()=>{
        const maxScroll = track.scrollWidth - track.clientWidth;
        const cardWidth = cards[0]?.offsetWidth + 12 || 280;
        const next = track.scrollLeft + cardWidth;
        if (next > maxScroll + 5) track.scrollTo({ left: 0, behavior: 'smooth' });
        else track.scrollTo({ left: next, behavior: 'smooth' });
      }, 4000);
    });
    track.addEventListener('touchstart', ()=> clearInterval(autoplay), { passive: true });
  }

  // Clique abre modal do produto (mesma experiência da grade)
  container.querySelectorAll('.carousel-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const productId = card.dataset.productId;
      const product = (window.appState?.products || window.storage?.getProducts?.() || []).find(p=> p.id===productId);
      if (product && onSelectProduct) onSelectProduct(product);
    });
  });
}

window.renderCarousel = renderCarousel;
